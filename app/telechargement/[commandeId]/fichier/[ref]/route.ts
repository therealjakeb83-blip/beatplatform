import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { accesCommande, UUID } from '@/lib/telechargement-acces'
import { lienSigneR2, estPrive, cleR2, fichierAppartientAuBeat } from '@/lib/r2'
import { audioInclus, CHAMP_AUDIO, EXTENSION, LABEL, type TypeAudio } from '@/lib/livraison'
import { urlPdfAvoir } from '@/lib/avoirs'

export const runtime = 'nodejs'

// Rang 9f, Lot 1 (décisions 3 et 4) : adresse Sonoo PERMANENTE de chaque
// fichier d'une commande — facture, facture d'une part, avoir, contrat, MP3 /
// WAV / stems. L'accès est vérifié à chaque clic, côté serveur ; le journal
// n'enregistre que l'acheteur (jamais le vendeur ni l'admin) ; le fichier
// s'ouvre ensuite par un lien de quelques minutes vers l'espace privé.
// ref = facture | facture-{tranche} | avoir-{avoir} | contrat-{ligne} | mp3-{ligne} | wav-{ligne} | stems-{ligne}

const DUREE_LIEN = 300

function versPage(request: Request, commandeId: string, ref?: string) {
  const url = new URL(`/telechargement/${commandeId}`, request.url)
  if (ref) url.searchParams.set('suite', ref)
  return NextResponse.redirect(url, 303)
}

function pdfDeLaCommande(url: string, cles: string[]): boolean {
  if (!estPrive(url)) return true
  const cle = cleR2(url)
  return cles.some(c => cle.startsWith(`commandes/${c}/`))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ commandeId: string; ref: string }> }
) {
  const { commandeId, ref } = await params
  if (!UUID.test(commandeId)) return new NextResponse('Introuvable', { status: 404 })
  const m = ref.match(/^(facture|avoir|contrat|mp3|wav|stems)(?:-([0-9a-f-]{36}))?$/i)
  if (!m || (m[1] !== 'facture' && !m[2]) || (m[2] && !UUID.test(m[2]))) return new NextResponse('Introuvable', { status: 404 })
  const type = m[1].toLowerCase()
  const cible = m[2] ?? null

  const admin = createAdminClient()
  const { data: commande } = await admin
    .from('commandes')
    .select('id, beatmaker_id, client_id, acheteur_email, numero_facture, facture_pdf_url, licence_annulee_at')
    .eq('id', commandeId)
    .maybeSingle()
  if (!commande) return new NextResponse('Introuvable', { status: 404 })

  const acces = await accesCommande(commande)
  if (!acces.autorise) return versPage(request, commandeId, ref)

  let url: string | null = null
  let nomFichier = ''
  let libelleJournal = ''
  let ligneId: string | null = null

  if (type === 'facture' && !cible) {
    url = commande.facture_pdf_url
    nomFichier = `Facture ${commande.numero_facture ?? ''}.pdf`
    libelleJournal = `Facture ${commande.numero_facture ?? ''}`.trim()
    if (url && !pdfDeLaCommande(url, [commandeId])) url = null
  } else if (type === 'facture') {
    const { data: t } = await admin.from('commande_tranches').select('facture_numero, facture_pdf_url').eq('id', cible!).eq('commande_id', commandeId).maybeSingle()
    url = t?.facture_pdf_url ?? null
    nomFichier = `Facture ${t?.facture_numero ?? ''}.pdf`
    libelleJournal = `Facture ${t?.facture_numero ?? ''}`.trim()
    if (url && !pdfDeLaCommande(url, [commandeId])) url = null
  } else if (type === 'avoir') {
    const { data: a } = await admin.from('avoirs').select('id, commande_id, numero, pdf_url').eq('id', cible!).eq('commande_id', commandeId).maybeSingle()
    url = a ? await urlPdfAvoir(admin, a) : null
    nomFichier = `Avoir ${a?.numero ?? ''}.pdf`
    libelleJournal = `Avoir ${a?.numero ?? ''}`.trim()
    if (url && !pdfDeLaCommande(url, [commandeId])) url = null
  } else {
    // Contrat et fichiers audio : fermés dès que la licence est tombée.
    if (commande.licence_annulee_at) return versPage(request, commandeId)
    const { data: ligne } = await admin
      .from('commande_lignes')
      .select('id, beat_id, licence_id, licence_modele, contrat_pdf_url')
      .eq('id', cible!)
      .eq('commande_id', commandeId)
      .maybeSingle()
    if (!ligne) return new NextResponse('Introuvable', { status: 404 })
    ligneId = ligne.id
    if (type === 'contrat') {
      url = ligne.contrat_pdf_url
      const { data: beat } = await admin.from('beats').select('titre').eq('id', ligne.beat_id).maybeSingle()
      nomFichier = `Contrat - ${beat?.titre ?? 'beat'}.pdf`
      libelleJournal = 'Contrat PDF'
      if (url && !pdfDeLaCommande(url, [commandeId, ligne.id])) url = null
    } else {
      const audio = type as TypeAudio
      const [{ data: beat }, { data: licence }] = await Promise.all([
        admin.from('beats').select('id, beatmaker_id, titre, mp3_propre_url, wav_url, stems_url').eq('id', ligne.beat_id).maybeSingle(),
        admin.from('licences').select('modele').eq('id', ligne.licence_id).maybeSingle(),
      ])
      const modele = ligne.licence_modele ?? licence?.modele ?? 'mp3'
      if (!beat || !audioInclus(modele, audio)) return new NextResponse('Introuvable', { status: 404 })
      const champ = CHAMP_AUDIO[audio]
      url = beat[champ]
      if (url && !fichierAppartientAuBeat(url, beat)) url = null
      nomFichier = `${beat.titre ?? 'beat'}.${EXTENSION[champ]}`
      libelleJournal = LABEL[champ]
    }
  }

  // Fichier pas encore prêt (PDF à régénérer) : la page s'en charge.
  if (!url) return versPage(request, commandeId)

  if (acces.qui === 'acheteur') {
    const forwarded = request.headers.get('x-forwarded-for')
    const { error } = await admin.from('licence_downloads').insert({
      commande_id: commandeId,
      commande_ligne_id: ligneId,
      beatmaker_id: commande.beatmaker_id,
      client_id: commande.client_id ?? null,
      fichier: libelleJournal,
      ip_address: forwarded ? forwarded.split(',')[0].trim() : null,
      origine: acces.origine,
    })
    if (error) console.error('[telechargement/fichier] journal non enregistré pour la commande', commandeId, JSON.stringify(error))
  }

  const lien = await lienSigneR2(url, {
    secondes: DUREE_LIEN,
    nomFichier,
    ...(nomFichier.endsWith('.pdf') ? { contentType: 'application/pdf' } : {}),
  })
  return NextResponse.redirect(lien, 302)
}
