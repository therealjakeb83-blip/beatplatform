import { createClient } from '@/utils/supabase/server'
import { redirect }     from 'next/navigation'
import { Suspense }     from 'react'
import AnalyticsClient  from './_components/AnalyticsClient'

export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <AnalyticsClient />
    </Suspense>
  )
}
