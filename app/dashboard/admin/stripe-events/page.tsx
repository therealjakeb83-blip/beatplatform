import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { tailleTableaux } from '@/lib/pagination-serveur'
import { bornerPage, lirePageAdresse } from '@/lib/pagination'
import PaginationAdresse from '../../_pagination/PaginationAdresse'

const STATUT_STYLES: Record<string, string> = {
  recu: 'bg-gray-700/30 text-gray-400 border-gray-600/30',
  traite: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  echoue: 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default async function StripeEventsPage({ searchParams }: { searchParams: Promise<{ filtre?: string; page?: string }> }) {
  const { filtre, page: pageParam } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const { data: adminRow } = await supabase.from('beatmakers').select('fuseau_horaire').eq('id', user.id).single()
  const tz = fuseauSur(adminRow?.fuseau_horaire)

  const admin = createAdminClient()

  // Plus de plafond à 100 : tout le journal, page par page
  const taille = await tailleTableaux()
  let requeteCount = admin.from('stripe_events').select('id', { count: 'exact', head: true })
  if (filtre === 'echoue') requeteCount = requeteCount.eq('statut', 'echoue')
  const { count } = await requeteCount
  const total = count ?? 0
  const page = bornerPage(lirePageAdresse(pageParam), total, taille)

  let query = admin
    .from('stripe_events')
    .select('id, stripe_event_id, type, statut, erreur, created_at, traite_at, compte_connecte')
    .order('created_at', { ascending: false })
    .order('id')
    .range((page - 1) * taille, page * taille - 1)

  if (filtre === 'echoue') query = query.eq('statut', 'echoue')

  const { data: events } = await query

  return (
    <div className="max-w-screen-lg mx-auto px-6 py-8 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Log Stripe</h1>
        <p className="text-sm text-gray-500 mt-0.5">Événements webhook reçus, du plus récent au plus ancien, pour débugger sans passer par les Runtime Logs Vercel.</p>
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

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="divide-y divide-gray-800">
        {(!events || events.length === 0) && <p className="px-4 py-6 text-sm text-gray-600 text-center">Aucun événement.</p>}
        {events?.map(ev => (
          <div key={ev.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white">
                {ev.type}
                {ev.compte_connecte && (
                  <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded border bg-indigo-500/15 text-indigo-400 border-indigo-500/30">
                    Connect · {ev.compte_connecte}
                  </span>
                )}
              </span>
              <span className={`text-[11px] px-1.5 py-0.5 rounded border ${STATUT_STYLES[ev.statut] ?? ''}`}>{ev.statut}</span>
            </div>
            <p className="text-xs text-gray-500">{new Date(ev.created_at).toLocaleString('fr-FR', { timeZone: tz })}</p>
            {ev.erreur && <p className="text-xs text-red-400">{ev.erreur}</p>}
          </div>
        ))}
      </div>
      <PaginationAdresse total={total} page={page} taille={taille} />
      </div>
    </div>
  )
}
