import crypto from 'crypto'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2'
import { createAdminClient } from '@/utils/supabase/admin'
import { automatisationActive } from '@/lib/automatisations'
import { inscrireParClient } from '@/lib/newsletter'

type Admin = ReturnType<typeof createAdminClient>

const VALIDITE_LIEN_MS = 7 * 24 * 60 * 60 * 1000

// Visiteur non connecté : rien n'est enregistré avant le clic sur le lien
// reçu par email (preuve que l'adresse existe et lui appartient). Tout ce
// qu'il a saisi voyage dans ce lien signé.
export type DemandeFreeDownload = {
  beatId: string
  beatmakerId: string
  email: string
  prenom: string | null
  nom: string | null
  nomArtiste: string | null
  pays: string | null
  emisLe: number
}

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET
  if (!s) throw new Error('UNSUBSCRIBE_SECRET manquant dans les variables d\'environnement')
  return s
}

function signer(donnees: string): string {
  return crypto.createHmac('sha256', secret()).update(`free-download:${donnees}`).digest('hex')
}

export function genererJetonFreeDownload(demande: Omit<DemandeFreeDownload, 'emisLe'>): string {
  const donnees = Buffer.from(JSON.stringify({ ...demande, emisLe: Date.now() })).toString('base64url')
  return `${donnees}.${signer(donnees)}`
}

export function lireJetonFreeDownload(jeton: string): { ok: true; demande: DemandeFreeDownload } | { ok: false; raison: 'invalide' | 'expire' } {
  const [donnees, sig] = jeton.split('.')
  if (!donnees || !sig) return { ok: false, raison: 'invalide' }
  const attendu = signer(donnees)
  if (sig.length !== attendu.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(attendu))) {
    return { ok: false, raison: 'invalide' }
  }
  try {
    const demande = JSON.parse(Buffer.from(donnees, 'base64url').toString('utf8')) as DemandeFreeDownload
    if (Date.now() - demande.emisLe > VALIDITE_LIEN_MS) return { ok: false, raison: 'expire' }
    return { ok: true, demande }
  } catch {
    return { ok: false, raison: 'invalide' }
  }
}

export async function urlFichierFreeDownload(beat: { titre: string; mp3_tague_url: string }): Promise<string> {
  const PUBLIC_URL = process.env.R2_PUBLIC_URL!
  const key = beat.mp3_tague_url.replace(PUBLIC_URL + '/', '')
  return getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${beat.titre}.mp3"`,
    }),
    { expiresIn: 3600 },
  )
}

// Fiche client du visiteur, retrouvée ou créée par email (jamais d'écrasement
// d'une donnée déjà renseignée par une valeur vide).
export async function resoudreClientFreeDownload(admin: Admin, d: Pick<DemandeFreeDownload, 'email' | 'prenom' | 'nom' | 'nomArtiste' | 'pays'>): Promise<string> {
  const { data: existing } = await admin.from('clients').select('id').eq('email', d.email).maybeSingle()
  if (existing) {
    const updates: Record<string, unknown> = {}
    if (d.prenom)     updates.prenom      = d.prenom
    if (d.nom)        updates.nom         = d.nom
    if (d.nomArtiste) updates.nom_artiste = d.nomArtiste
    if (d.pays)       updates.pays        = d.pays
    if (Object.keys(updates).length > 0) await admin.from('clients').update(updates).eq('id', existing.id)
    return existing.id
  }
  const id = crypto.randomUUID()
  const nom = d.nom || d.email.split('@')[0].replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim() || d.email
  await admin.from('clients').insert({
    id, email: d.email, prenom: d.prenom || null, nom, nom_artiste: d.nomArtiste || null, pays: d.pays || null,
  })
  return id
}

// Inscription newsletter (si cochée), trace du téléchargement, relance
// automatique. `depuis` : un nouveau clic sur le même lien ne recompte pas.
export async function enregistrerFreeDownload(admin: Admin, params: {
  clientId: string
  beatmakerId: string
  beatId: string
  newsletterConsent: boolean
  depuis?: number
}): Promise<void> {
  if (params.newsletterConsent) {
    await inscrireParClient(admin, { clientId: params.clientId, beatmakerId: params.beatmakerId, origine: 'free_download', sourceLead: 'free_download' })
  }

  if (params.depuis) {
    const { count } = await admin
      .from('free_downloads')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', params.clientId)
      .eq('beat_id', params.beatId)
      .gte('downloaded_at', new Date(params.depuis).toISOString())
    if ((count ?? 0) > 0) return
  }

  const { data: freeDownload, error } = await admin.from('free_downloads').insert({
    beatmaker_id: params.beatmakerId,
    client_id:    params.clientId,
    beat_id:      params.beatId,
  }).select('id').single()
  if (error) console.error('[free-download] Insert free_downloads error:', JSON.stringify(error))

  if (freeDownload && await automatisationActive(params.beatmakerId, 'follow_up_free_download')) {
    const { error: evenementError } = await admin.from('automatisation_evenements').insert({
      beatmaker_id: params.beatmakerId,
      client_id:    params.clientId,
      type:         'follow_up_free_download',
      reference_id: freeDownload.id,
    })
    if (evenementError) console.error('[free-download] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
  }
}
