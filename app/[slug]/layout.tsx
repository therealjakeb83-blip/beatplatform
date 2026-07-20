import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { PlayerProvider } from './_components/PlayerContext'
import PlayerBar from './_components/PlayerBar'
import { CartProvider } from './_components/CartContext'
import CartDrawer from './_components/CartDrawer'
import BoutiqueNavBar from './_components/BoutiqueNavBar'
import BoutiqueFooter from './_components/BoutiqueFooter'

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
    .select('nom_artiste, instagram_url, youtube_url, tiktok_url')
    .eq('slug', slug)
    .maybeSingle()

  return (
    <PlayerProvider>
      <CartProvider>
        <div className="min-h-screen bg-black text-white pb-28 flex flex-col">
          <BoutiqueNavBar slug={slug} clientUser={clientUser} />
          <div className="flex-1">{children}</div>
          {beatmaker && (
            <BoutiqueFooter
              slug={slug}
              nomArtiste={beatmaker.nom_artiste}
              instagramUrl={beatmaker.instagram_url}
              youtubeUrl={beatmaker.youtube_url}
              tiktokUrl={beatmaker.tiktok_url}
            />
          )}
        </div>
        <PlayerBar />
        <CartDrawer slug={slug} />
      </CartProvider>
    </PlayerProvider>
  )
}
