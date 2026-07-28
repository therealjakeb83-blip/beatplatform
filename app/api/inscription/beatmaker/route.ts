import { createAdminClient } from '@/utils/supabase/admin'
import { envoyerConfirmationEmailPlateforme } from '@/lib/emails'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// Inscription beatmaker passée côté serveur (pas supabase.auth.signUp() côté
// client) pour pouvoir envoyer nous-mêmes l'email de confirmation — sinon
// Supabase envoie automatiquement son propre email générique, non brandé et
// hors de notre système (email_logs, /dashboard/admin/mails-plateforme).
// admin.generateLink({ type: 'signup' }) crée le compte (déclenche le
// trigger Postgres handle_new_beatmaker comme un signUp() normal) et renvoie
// un token à vérifier, SANS jamais déclencher l'envoi automatique de
// Supabase — voir ROADMAP.md (2026-07-28) pour le diagnostic du bug corrigé
// par ce chantier.
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)
  const { email, password, nomArtiste } = await request.json()

  if (!email || !password || !nomArtiste) {
    return NextResponse.json({ erreur: 'Champs manquants.' }, { status: 400 })
  }

  const emailNorm = String(email).toLowerCase().trim()
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email: emailNorm,
    password,
    options: { data: { nom_artiste: nomArtiste, role: 'beatmaker' } },
  })

  if (error || !data?.user) {
    const dejaUtilise = error?.message?.toLowerCase().includes('already')
    return NextResponse.json(
      { erreur: dejaUtilise ? 'Un compte existe déjà avec cet email.' : 'Erreur lors de la création du compte.' },
      { status: 400 },
    )
  }

  // Même pattern que le lien de récupération dans connecterAutomatiquementApresAbonnement
  // (app/api/stripe/abonnement/succes/route.ts) : token_hash vérifié côté
  // navigateur (supabase.auth.verifyOtp), plus fiable ici qu'un échange de
  // code côté serveur — voir /confirmation-compte.
  const lienConfirmation = `${origin}/confirmation-compte?token_hash=${data.properties.hashed_token}`

  await envoyerConfirmationEmailPlateforme({
    to: emailNorm,
    beatmakerId: data.user.id,
    lienConfirmation,
  })

  return NextResponse.json({ ok: true })
}
