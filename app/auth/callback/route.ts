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
    // Lien valide mais ouvert dans un autre navigateur que celui de
    // l'inscription : le compte est activé, mais pas de session ici.
    return NextResponse.redirect(`${origin}/artiste/connexion?confirmation=activee&redirect=${encodeURIComponent(pageDeDepart(next, origin))}`)
  }

  // Lien expiré ou déjà utilisé : Supabase met l'erreur dans le fragment (#error_code=…),
  // conservé par le navigateur à travers cette redirection et lu par la page de connexion.
  return NextResponse.redirect(`${origin}/artiste/connexion?redirect=${encodeURIComponent(pageDeDepart(next, origin))}`)
}

// next = page de départ ("/slug") ou, pour les liens envoyés avant le
// 2026-10-08, "/artiste/connexion?redirect=/slug".
function pageDeDepart(next: string, origin: string): string {
  try {
    const url = new URL(next, origin)
    if (url.pathname.startsWith('/artiste/')) return url.searchParams.get('redirect') ?? '/mon-compte'
    return url.pathname + url.search
  } catch {
    return '/mon-compte'
  }
}

// Brandé à la boutique de départ (slug dans ?redirect=/{slug} imbriqué dans
// next) plutôt qu'un générique My Producer — voir confirmationCompteArtiste
// dans lib/emails.ts. Si aucune boutique n'est identifiable (lien générique
// sans contexte boutique), aucun email n'est envoyé (décision Jake, 2026-07-17).
async function envoyerConfirmationCompteArtiste(email: string | undefined, next: string, origin: string) {
  if (!email) return

  const segments = pageDeDepart(next, origin).split('?')[0].split('/').filter(Boolean)
  const slug = (segments[0] === 'paiement' ? segments[1] : segments[0]) ?? null
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
