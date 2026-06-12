import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from './_components/Sidebar'

export default async function BusinessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('nom_artiste')
    .eq('id', user.id)
    .single()

  if (!beatmaker) redirect('/')

  const nomArtiste = beatmaker.nom_artiste ?? user.email ?? 'Beatmaker'

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar nomArtiste={nomArtiste} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
