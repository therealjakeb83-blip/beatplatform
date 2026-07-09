import { PlayerProvider } from './_components/PlayerContext'
import PlayerBar from './_components/PlayerBar'
import { CartProvider } from './_components/CartContext'
import CartDrawer from './_components/CartDrawer'

export default async function BoutiqueLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <PlayerProvider>
      <CartProvider>
        <div className="min-h-screen bg-black text-white pb-28">
          {children}
        </div>
        <PlayerBar />
        <CartDrawer slug={slug} />
      </CartProvider>
    </PlayerProvider>
  )
}
