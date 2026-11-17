import { utilisateurConnecte } from '@/lib/session-serveur'
import { redirect }     from 'next/navigation'
import { Suspense }     from 'react'
import AnalyticsClient  from './_components/AnalyticsClient'
import { SqueletteAnalytics } from '@/app/dashboard/_navigation/Squelettes'

export default async function AnalyticsPage() {
  const user = await utilisateurConnecte()
  if (!user) redirect('/connexion')

  return (
    <Suspense fallback={<SqueletteAnalytics />}>
      <AnalyticsClient />
    </Suspense>
  )
}
