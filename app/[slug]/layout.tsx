import { Suspense } from 'react'
import type { Viewport } from 'next'
import { Poppins } from 'next/font/google'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { accentPresetKey } from './_lib/theme-accent'
import { PlayerProvider } from './_components/PlayerContext'
import PlayerBar from './_components/PlayerBar'
import { CartProvider } from './_components/CartContext'
import CartDrawer from './_components/CartDrawer'
import BoutiqueHeader from './_components/BoutiqueHeader'
import BoutiqueFooter from './_components/BoutiqueFooter'
import BoutiqueThemeRoot from './_components/BoutiqueThemeRoot'
import MobileTabBar from './_components/MobileTabBar'
import './boutique-theme.css'

// Chrome du navigateur mobile (barre d'adresse/statut) alignée sur le thème
// de la boutique — sinon elle reste blanche par défaut et jure avec le fond
// sombre. 'blancNoir' est le seul preset à fond clair (voir boutique-theme.css).
export async function generateViewport({ params }: { params: Promise<{ slug: string }> }): Promise<Viewport> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data } = await admin.from('beatmakers').select('theme_couleur').eq('slug', slug).maybeSingle()
  const isLight = accentPresetKey(data?.theme_couleur ?? '#2E4CF0') === 'blancNoir'

  const bg = isLight ? '#F7F8FC' : '#05060B'

  return {
    // Safari (barre du bas en mode compact) suit parfois le mode clair/sombre
    // du système plutôt que cette valeur si elle est déclarée sans media —
    // déclarer les deux variantes avec la même couleur force l'application.
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: bg },
      { media: '(prefers-color-scheme: dark)', color: bg },
    ],
    colorScheme: isLight ? 'light' : 'dark',
  }
}

// Police du design system (tokens.css: --font: 'Poppins'), poids 400-800.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export default async function BoutiqueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  let clientUser: { prenom: string; nom: string } | null = null
  if (user) {
    const { data: client } = await admin
      .from('clients')
      .select('prenom, nom')
      .eq('id', user.id)
      .single()
    clientUser = client
  }

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('nom_artiste, logo_url, instagram_url, youtube_url, tiktok_url, abo_actif, abo_remise_pct, theme_couleur')
    .eq('slug', slug)
    .maybeSingle()

  return (
    <PlayerProvider>
      <CartProvider>
        <Suspense>
          <BoutiqueThemeRoot
            accentDb={beatmaker?.theme_couleur ?? '#2E4CF0'}
            fontClassName={poppins.variable}
          >
            {beatmaker && (
              <BoutiqueHeader
                slug={slug}
                nomArtiste={beatmaker.nom_artiste}
                logoUrl={beatmaker.logo_url}
                aboActif={beatmaker.abo_actif}
                clientUser={clientUser}
              />
            )}
            <div className="flex-1">{children}</div>
            {beatmaker && (
              <BoutiqueFooter
                slug={slug}
                nomArtiste={beatmaker.nom_artiste}
                logoUrl={beatmaker.logo_url}
                instagramUrl={beatmaker.instagram_url}
                youtubeUrl={beatmaker.youtube_url}
                tiktokUrl={beatmaker.tiktok_url}
              />
            )}
            <PlayerBar slug={slug} clientId={user?.id ?? null} />
            <MobileTabBar slug={slug} />
            <CartDrawer
              slug={slug}
              aboActif={beatmaker?.abo_actif ?? false}
              aboRemisePct={beatmaker?.abo_remise_pct ?? 0}
            />
          </BoutiqueThemeRoot>
        </Suspense>
      </CartProvider>
    </PlayerProvider>
  )
}
