import { createClient } from '@/utils/supabase/server'
import { redirect }     from 'next/navigation'
import { Suspense }     from 'react'
import AnalyticsClient  from './_components/AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return (
    <Suspense>
      <AnalyticsClient />
    </Suspense>
  )
}
