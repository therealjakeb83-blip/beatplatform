import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import DeconnexionButton from '../DeconnexionButton'

export default async function DashboardSuspenduPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()
  const { data: beatmaker } = await admin.from('beatmakers').select('statut, suspendu_raison').eq('id', user.id).single()

  if (beatmaker?.statut !== 'suspendu') redirect('/dashboard')

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Compte suspendu</h1>
        <p className="text-gray-400 mb-1">Ton accès à My Producer est temporairement suspendu.</p>
        {beatmaker.suspendu_raison && (
          <p className="text-sm text-gray-500 mb-4">Motif : {beatmaker.suspendu_raison}</p>
        )}
        <p className="text-sm text-gray-500 mb-8">Contacte-nous pour en savoir plus ou débloquer ton compte.</p>
        <DeconnexionButton />
      </div>
    </main>
  )
}
