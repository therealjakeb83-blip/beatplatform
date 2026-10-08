import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { telechargementGratuit } from '@/lib/emails'
import { lireStatutNewsletter } from '@/lib/newsletter'
import { normaliserEmail } from '@/lib/email'
import {
  genererJetonFreeDownload, urlFichierFreeDownload, resoudreClientFreeDownload, enregistrerFreeDownload,
} from '@/lib/free-download'

export const runtime = 'nodejs'

const MESSAGE_NEWSLETTER = 'Pour télécharger gratuitement, inscris-toi à la newsletter de cette boutique.'

export async function POST(req: Request) {
  const body = await req.json()
  const { beatId, slug, email, prenom, nom, nomArtiste, pays, newsletterConsent = false, disclaimerAccepte = false } = body

  if (!beatId || !slug) {
    return NextResponse.json({ error: 'Paramètres manquants.' }, { status: 400 })
  }
  if (disclaimerAccepte !== true) {
    return NextResponse.json({ error: "Coche la case pour accepter les conditions d'utilisation du téléchargement gratuit." }, { status: 400 })
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

  const beatmakerId = beatmaker.id
  const { data: { user } } = await supabase.auth.getUser()

  // 2a. Visiteur non connecté : rien n'est enregistré ici. Le lien envoyé par
  // email confirme l'adresse ; l'inscription et le téléchargement sont
  // enregistrés au clic (/[slug]/telechargement-gratuit).
  if (!user) {
    if (newsletterConsent !== true) {
      return NextResponse.json({ error: MESSAGE_NEWSLETTER }, { status: 400 })
    }
    const emailNorm = normaliserEmail(email ?? '')
    if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
      return NextResponse.json({ error: 'Email invalide.' }, { status: 400 })
    }

    const jeton = genererJetonFreeDownload({
      beatId, beatmakerId, email: emailNorm,
      prenom: prenom || null, nom: nom || null, nomArtiste: nomArtiste || null, pays: pays || null,
    })
    const lien = `${new URL(req.url).origin}/${slug}/telechargement-gratuit?t=${encodeURIComponent(jeton)}`

    const envoye = await telechargementGratuit({
      to: emailNorm, beatmakerId, titreBeat: beat.titre, downloadUrl: lien, lienDeConfirmation: true,
    })
    if (!envoye) {
      return NextResponse.json({ error: "L'email n'a pas pu être envoyé. Vérifie ton adresse et réessaie." }, { status: 502 })
    }
    return NextResponse.json({ emailEnvoye: true, email: emailNorm })
  }

  // 2b. Connecté : email déjà confirmé à la création du compte → téléchargement direct
  let clientId: string
  let clientEmail: string
  const { data: clientRecord } = await admin.from('clients').select('id').eq('id', user.id).maybeSingle()
  if (clientRecord) {
    clientId    = user.id
    clientEmail = user.email!
  } else {
    // Compte beatmaker connecté : fiche client retrouvée/créée par son email
    clientEmail = normaliserEmail(user.email ?? '')
    clientId    = await resoudreClientFreeDownload(admin, { email: clientEmail, prenom: null, nom: null, nomArtiste: null, pays: null })
  }

  // 3. Free download = inscription à la newsletter de CETTE boutique,
  // obligatoire même connecté (déjà inscrit : rien à cocher de plus).
  if (newsletterConsent !== true && (await lireStatutNewsletter(admin, clientId, beatmakerId)) !== 'inscrit') {
    return NextResponse.json({ error: MESSAGE_NEWSLETTER }, { status: 400 })
  }

  await enregistrerFreeDownload(admin, { clientId, beatmakerId, beatId, newsletterConsent: newsletterConsent === true })

  const downloadUrl = await urlFichierFreeDownload({ titre: beat.titre, mp3_tague_url: beat.mp3_tague_url })

  // Email avec le lien (branding boutique, personnalisable — Phase 6.9)
  await telechargementGratuit({ to: clientEmail, beatmakerId, clientId, titreBeat: beat.titre, downloadUrl })

  return NextResponse.json({ downloadUrl, beatTitre: beat.titre })
}
