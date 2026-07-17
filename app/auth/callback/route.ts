import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { confirmationCompteArtiste } from '@/lib/emails'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Awaité (pas fire-and-forget) : une promesse non attendue en toute
      // dernière instruction avant une réponse HTTP risque de se faire tuer
      // par l'environnement serverless avant d'avoir fini (bug identifié en
      // Phase 6, voir ROADMAP.md) — .catch() seul pour ne jamais faire
      // échouer la redirection si l'email plante.
      await envoyerConfirmationCompteArtiste(data.user?.email, next, origin).catch(err =>
        console.error('[auth/callback] Erreur envoi confirmation compte:', err)
      )
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/artiste/connexion`)
}

// Brandé à la boutique de départ (slug dans ?redirect=/{slug} imbriqué dans
// next) plutôt qu'un générique My Producer — voir confirmationCompteArtiste
// dans lib/emails.ts. Si aucune boutique n'est identifiable (lien générique
// sans contexte boutique), aucun email n'est envoyé (décision Jake, 2026-07-17).
async function envoyerConfirmationCompteArtiste(email: string | undefined, next: string, origin: string) {
  if (!email) return

  let slug: string | null = null
  try {
    const nextUrl = new URL(next, origin)
    const redirectParam = nextUrl.searchParams.get('redirect') ?? ''
    slug = redirectParam.split('/').filter(Boolean)[0] ?? null
  } catch {
    return
  }
  if (!slug) return

  const admin = createAdminClient()
  const emailNorm = email.toLowerCase().trim()
  const [{ data: beatmaker }, { data: client }] = await Promise.all([
    admin.from('beatmakers').select('id').eq('slug', slug).maybeSingle(),
    admin.from('clients').select('id').eq('email', emailNorm).maybeSingle(),
  ])
  if (!beatmaker) return

  await confirmationCompteArtiste({
    to: emailNorm,
    beatmakerId: beatmaker.id,
    clientId: client?.id ?? null,
    lienCompte: `${origin}${next}`,
  })
}
