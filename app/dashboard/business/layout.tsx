import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { estRoleAdmin } from '@/lib/admin'
import { aUnAbonnementPlateformeActif } from '@/lib/acces-plan'
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
    .select('nom_artiste, role, abonnement_exempte')
    .eq('id', user.id)
    .single()

  if (!beatmaker) redirect('/')

  const nomArtiste = beatmaker.nom_artiste ?? user.email ?? 'Beatmaker'

  // Plan Free (Phase 12 lot 2) — même calcul que le gate de proxy.ts, juste
  // pour griser dans le menu ce qui est de toute façon bloqué à la
  // navigation (l'accès réel reste tranché par proxy.ts, jamais par ce seul
  // affichage).
  const gateExempte = estRoleAdmin(beatmaker.role) || beatmaker.abonnement_exempte
  const abonnementActif = gateExempte || await aUnAbonnementPlateformeActif(supabase, user.id)
  const planFree = !abonnementActif

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">
      <Sidebar nomArtiste={nomArtiste} planFree={planFree} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
