import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { PlayerProvider } from './_components/PlayerContext'
import PlayerBar from './_components/PlayerBar'
import { CartProvider } from './_components/CartContext'
import CartDrawer from './_components/CartDrawer'
import BoutiqueNavBar from './_components/BoutiqueNavBar'

export default async function BoutiqueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let clientUser: { prenom: string; nom: string } | null = null
  if (user) {
    const admin = createAdminClient()
    const { data: client } = await admin
      .from('clients')
      .select('prenom, nom')
      .eq('id', user.id)
      .single()
    clientUser = client
  }

  return (
    <PlayerProvider>
      <CartProvider>
        <div className="min-h-screen bg-black text-white pb-28">
          <BoutiqueNavBar slug={slug} clientUser={clientUser} />
          {children}
        </div>
        <PlayerBar />
        <CartDrawer slug={slug} />
      </CartProvider>
    </PlayerProvider>
  )
}
