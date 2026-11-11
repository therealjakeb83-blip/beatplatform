import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { lierCompteClient } from '@/lib/lier-compte-client'
import { normaliserEmail } from '@/lib/email'
import { envoyerEmailCompteArtiste } from '@/lib/emails'
import { beatmakerIdDuSlug, contexteCompteArtiste, emailCompteEnvoyeRecemment } from '@/lib/compte-artiste'

export const runtime = 'nodejs'

// Inscription d'un client artiste (rang 9c, lot 3). Le compte est créé ici et
// l'email de confirmation envoyé par Sonoo : Supabase ne sait mettre dans ses
// emails qu'une adresse de sonoo.app, alors que le client peut s'inscrire
// depuis le domaine d'une boutique. generateLink n'envoie rien lui-même.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const prenom = typeof body.prenom === 'string' ? body.prenom.trim() : ''
  const nom = typeof body.nom === 'string' ? body.nom.trim() : ''
  const email = normaliserEmail(typeof body.email === 'string' ? body.email : '')
  const password = typeof body.password === 'string' ? body.password : ''

  if (!prenom || !nom || !email.includes('@')) {
    return NextResponse.json({ erreur: 'Champs manquants.' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ erreur: 'Le mot de passe doit faire au moins 8 caractères.' }, { status: 400 })
  }

  const contexte = await contexteCompteArtiste(request, body.redirect)
  if (await emailCompteEnvoyeRecemment(email, 'confirmation')) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: { data: { prenom, nom } },
  })

  if (error || !data?.user) {
    const message = error?.message?.toLowerCase() ?? ''
    if (message.includes('already') || error?.code === 'email_exists') {
      return NextResponse.json(
        { erreur: 'Un compte existe déjà avec cet email. Connecte-toi, ou utilise « Mot de passe oublié ».' },
        { status: 409 },
      )
    }
    console.error('[artiste/inscription] generateLink:', JSON.stringify(error))
    return NextResponse.json({ erreur: 'Erreur lors de la création du compte.' }, { status: 500 })
  }

  const newsletter = contexte.slug ? body.newsletter === true : undefined
  await lierCompteClient(data.user.id, email, nom, prenom, newsletter, contexte.slug)

  const params = new URLSearchParams({ token_hash: data.properties.hashed_token, redirect: contexte.redirect })
  await envoyerEmailCompteArtiste({
    type: 'confirmation',
    to: email,
    beatmakerId: await beatmakerIdDuSlug(contexte.slug),
    lien: `${contexte.origine}/artiste/confirmation?${params.toString()}`,
  })

  return NextResponse.json({ ok: true })
}
