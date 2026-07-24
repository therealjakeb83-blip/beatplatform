import Link from 'next/link'
import { createAdminClient } from '@/utils/supabase/admin'

const STATUT_STYLES: Record<string, string> = {
  recu: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  traite: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  echoue: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default async function StripeEventsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('stripe_events')
    .select('id, stripe_event_id, type, statut, erreur, created_at, traite_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (filtre === 'echoue') query = query.eq('statut', 'echoue')

  const { data: events } = await query

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Log Stripe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Derniers événements webhook reçus (100 max), pour débugger sans passer par les Runtime Logs Vercel.</p>
      </div>

      <div className="flex gap-2">
        <Link
          href="/dashboard/admin/stripe-events"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!filtre ? 'bg-indigo-600 text-white' : 'bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'}`}
        >
          Tous
        </Link>
        <Link
          href="/dashboard/admin/stripe-events?filtre=echoue"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtre === 'echoue' ? 'bg-red-600 text-white' : 'bg-gray-900 border border-gray-800 text-red-400 hover:text-red-300 hover:border-gray-700'}`}
        >
          Échecs uniquement
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden divide-y divide-gray-800">
        {(!events || events.length === 0) && <p className="px-4 py-6 text-sm text-gray-600 text-center">Aucun événement.</p>}
        {events?.map(ev => (
          <div key={ev.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">{ev.type}</span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUT_STYLES[ev.statut] ?? ''}`}>{ev.statut}</span>
            </div>
            <p className="text-xs text-gray-500">{new Date(ev.created_at).toLocaleString('fr-FR')}</p>
            {ev.erreur && <p className="text-xs text-red-400">{ev.erreur}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
