import { PlayerProvider } from './_components/PlayerContext'
import PlayerBar from './_components/PlayerBar'

export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="min-h-screen bg-gray-950 text-white pb-28">
        {children}
      </div>
      <PlayerBar />
    </PlayerProvider>
  )
}
