import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2'
import { telechargementGratuit } from '@/lib/emails'
import { automatisationActive } from '@/lib/automatisations'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const body = await req.json()
  const { beatId, slug, email, prenom, nom, nomArtiste, pays, newsletterConsent = false } = body

  if (!beatId || !slug) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
  }

  const admin    = createAdminClient()
  const supabase = await createClient()

  // 1. Récupérer beatmaker + beat
  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste')
    .eq('slug', slug)
    .single()

  if (!beatmaker) return NextResponse.json({ error: 'Boutique introuvable.' }, { status: 404 })

  const { data: beat } = await admin
    .from('beats')
    .select('id, titre, mp3_tague_url, free_download_actif, beatmaker_id')
    .eq('id', beatId)
    .eq('beatmaker_id', beatmaker.id)
    .single()

  if (!beat?.free_download_actif) {
    return NextResponse.json({ error: 'Téléchargement gratuit non disponible.' }, { status: 403 })
  }
  if (!beat.mp3_tague_url) {
    return NextResponse.json({ error: 'Fichier non disponible.' }, { status: 404 })
  }

  // 2. Résoudre le client
  const { data: { user } } = await supabase.auth.getUser()
  let clientId: string
  let clientEmail: string

  if (user) {
    // Vérifier que cet user a bien un compte clients (pas un beatmaker)
    const { data: clientRecord } = await admin
      .from('clients')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (clientRecord) {
      clientId    = user.id
      clientEmail = user.email!
    } else {
      // L'user connecté est un beatmaker, pas un client → traiter comme visiteur anonyme
      const emailNorm = (user.email ?? '').toLowerCase().trim()
      const { data: existing } = await admin.from('clients').select('id').eq('email', emailNorm).maybeSingle()
      if (existing) {
        clientId = existing.id
      } else {
        const newId = crypto.randomUUID()
        const nom   = emailNorm.split('@')[0].replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim() || emailNorm
        await admin.from('clients').insert({ id: newId, email: emailNorm, nom, newsletter_consent: false })
        clientId = newId
      }
      clientEmail = emailNorm
    }
  } else {
    // Non connecté — email obligatoire
    const emailNorm = (email ?? '').toLowerCase().trim()
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
    }

    const { data: existing } = await admin
      .from('clients')
      .select('id')
      .eq('email', emailNorm)
      .maybeSingle()

    if (existing) {
      clientId = existing.id
      const updates: Record<string, unknown> = {}
      if (newsletterConsent) updates.newsletter_consent = true
      if (prenom)     updates.prenom      = prenom
      if (nom)        updates.nom         = nom
      if (nomArtiste) updates.nom_artiste = nomArtiste
      if (pays)       updates.pays        = pays
      if (Object.keys(updates).length > 0) {
        await admin.from('clients').update(updates).eq('id', clientId)
      }
    } else {
      const newId  = crypto.randomUUID()
      const nomVal = nom || emailNorm.split('@')[0].replace(/[._+\-]/g, ' ').replace(/\s+/g, ' ').trim() || emailNorm
      await admin.from('clients').insert({
        id:                 newId,
        email:              emailNorm,
        prenom:             prenom   || null,
        nom:                nomVal,
        nom_artiste:        nomArtiste || null,
        pays:               pays       || null,
        newsletter_consent: newsletterConsent,
      })
      clientId = newId
    }
    clientEmail = emailNorm
  }

  const beatmakerId = beatmaker.id

  // 3. Upsert lead (source conservée si lead existant)
  const { data: existingLead } = await admin
    .from('leads')
    .select('id, newsletter_inscrit')
    .eq('client_id', clientId)
    .eq('beatmaker_id', beatmakerId)
    .maybeSingle()

  if (!existingLead) {
    await admin.from('leads').insert({
      client_id:          clientId,
      beatmaker_id:       beatmakerId,
      source:             'free_download',
      newsletter_inscrit: newsletterConsent,
    })
  } else if (newsletterConsent && !existingLead.newsletter_inscrit) {
    await admin.from('leads').update({ newsletter_inscrit: true }).eq('id', existingLead.id)
  }

  // 4. Log free_download
  const { data: freeDownload, error: dlError } = await admin.from('free_downloads').insert({
    beatmaker_id: beatmakerId,
    client_id:    clientId,
    beat_id:      beatId,
  }).select('id').single()
  if (dlError) console.error('[free-download] Insert free_downloads error:', JSON.stringify(dlError))

  if (freeDownload && await automatisationActive(beatmakerId, 'follow_up_free_download')) {
    const { error: evenementError } = await admin.from('automatisation_evenements').insert({
      beatmaker_id: beatmakerId,
      client_id:    clientId,
      type:         'follow_up_free_download',
      reference_id: freeDownload.id,
    })
    if (evenementError) console.error('[free-download] Erreur insert automatisation_evenements:', JSON.stringify(evenementError))
  }

  // 5. Signed URL R2 (1h, force-download)
  const PUBLIC_URL = process.env.R2_PUBLIC_URL!
  const key        = beat.mp3_tague_url.replace(PUBLIC_URL + '/', '')
  const filename   = `${beat.titre}.mp3`

  const downloadUrl = await getSignedUrl(
    r2,
    new GetObjectCommand({
      Bucket:                      R2_BUCKET,
      Key:                         key,
      ResponseContentDisposition:  `attachment; filename="${filename}"`,
    }),
    { expiresIn: 3600 }
  )

  // 6. Email avec le lien (branding boutique, personnalisable — Phase 6.9)
  await telechargementGratuit({
    to: clientEmail,
    beatmakerId,
    clientId,
    titreBeat: beat.titre,
    downloadUrl,
  })

  return NextResponse.json({ downloadUrl, beatTitre: beat.titre })
}
