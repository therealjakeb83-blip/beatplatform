import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { normaliserEmail } from '@/lib/email'
import { envoyerEmailCompteArtiste } from '@/lib/emails'
import { beatmakerIdDuSlug, contexteCompteArtiste, emailCompteEnvoyeRecemment } from '@/lib/compte-artiste'

export const runtime = 'nodejs'

// Mot de passe oublié d'un client artiste (rang 9c, lot 3), envoyé par Sonoo
// avec un lien vers le site où se trouve le client. Réponse toujours
// identique, que l'adresse ait un compte ou non.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const email = normaliserEmail(typeof body.email === 'string' ? body.email : '')
  if (!email.includes('@')) return NextResponse.json({ erreur: 'Email invalide.' }, { status: 400 })

  const contexte = await contexteCompteArtiste(request, body.redirect)
  if (await emailCompteEnvoyeRecemment(email, 'mot_de_passe')) return NextResponse.json({ ok: true })

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: 'recovery', email })
  if (error || !data?.properties?.hashed_token) return NextResponse.json({ ok: true })

  const params = new URLSearchParams({
    token_hash: data.properties.hashed_token,
    type: 'recovery',
    redirect: contexte.redirect,
  })
  await envoyerEmailCompteArtiste({
    type: 'mot_de_passe',
    to: email,
    beatmakerId: await beatmakerIdDuSlug(contexte.slug),
    lien: `${contexte.origine}/artiste/nouveau-mot-de-passe?${params.toString()}`,
  })

  return NextResponse.json({ ok: true })
}
