import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DefusionnerButton from './_components/DefusionnerButton'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatLtv(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

export default async function HistoriquePage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: fusions } = await supabase
    .from('fusions_crm')
    .select('id, client_id_conserve, client_id_archive, emails_archives, snapshot_archive, raisons, created_at')
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })

  const fusionsData = fusions ?? []

  // Charger les données du contact conservé pour chaque fusion
  const conserveIds = [...new Set(fusionsData.map(f => f.client_id_conserve))]
  const conserveMap = new Map<string, { prenom: string | null; nom: string | null; email: string; pays: string | null }>()

  if (conserveIds.length > 0) {
    const { data: conserves } = await admin
      .from('clients')
      .select('id, prenom, nom, email, pays')
      .in('id', conserveIds)
    for (const c of conserves ?? []) conserveMap.set(c.id, c)
  }

  // LTV des contacts conservés
  const ltvMap = new Map<string, number>()
  if (conserveIds.length > 0) {
    const { data: cmds } = await supabase
      .from('commandes')
      .select('client_id, prix_paye, statut')
      .eq('beatmaker_id', user.id)
      .in('client_id', conserveIds)
    for (const cmd of cmds ?? []) {
      if (cmd.statut === 'payee') ltvMap.set(cmd.client_id as string, (ltvMap.get(cmd.client_id as string) ?? 0) + (cmd.prix_paye ?? 0))
    }
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link href="/dashboard/business/doublons" className="hover:text-white transition-colors">Doublons</Link>
        <span className="text-gray-700">›</span>
        <span className="text-white">Historique des fusions</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Historique des fusions</h1>
          <p className="text-sm text-gray-500 mt-1">
            {fusionsData.length} fusion{fusionsData.length > 1 ? 's' : ''} effectuée{fusionsData.length > 1 ? 's' : ''} — défusionnable à tout moment.
          </p>
        </div>
      </div>

      {fusionsData.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center text-gray-600 text-sm">
          Aucune fusion effectuée pour l'instant.
        </div>
      ) : (
        <div className="space-y-3">
          {fusionsData.map(f => {
            const conserve = conserveMap.get(f.client_id_conserve)
            const snap     = f.snapshot_archive as { prenom?: string; nom?: string; email?: string; ltv?: number; nb_achats?: number; pays?: string } | null

            return (
              <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_40px_1fr_auto] items-center gap-4 px-5 py-4">

                  {/* Contact conservé */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {conserve?.pays ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://flagcdn.com/w40/${conserve.pays.toLowerCase()}.png`} alt={conserve.pays} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-indigo-300 font-bold">
                          {[conserve?.prenom?.[0], conserve?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-green-500/20 text-green-400">CONSERVÉ</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{conserve?.prenom} {conserve?.nom}</p>
                      <p className="text-xs text-gray-500 truncate">{conserve?.email}</p>
                      <p className="text-xs text-gray-600 mt-0.5">LTV {formatLtv(ltvMap.get(f.client_id_conserve) ?? 0)}</p>
                    </div>
                  </div>

                  {/* Flèche */}
                  <div className="text-gray-700 text-lg text-center">←</div>

                  {/* Contact archivé (depuis snapshot) */}
                  <div className="flex items-center gap-3 min-w-0 opacity-60">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                      {snap?.pays ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://flagcdn.com/w40/${snap.pays.toLowerCase()}.png`} alt={snap.pays} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-gray-500 font-bold">
                          {[snap?.prenom?.[0], snap?.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400">ARCHIVÉ</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{snap?.prenom} {snap?.nom}</p>
                      <p className="text-xs text-gray-500 truncate">{snap?.email}</p>
                      <p className="text-xs text-gray-600 mt-0.5">LTV {formatLtv(snap?.ltv ?? 0)}</p>
                    </div>
                  </div>

                  {/* Méta + défusion */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-gray-600">{formatDate(f.created_at)}</p>
                    <Link
                      href={`/dashboard/business/contacts/${f.client_id_conserve}`}
                      className="text-xs text-gray-600 hover:text-indigo-400 transition-colors"
                    >
                      Voir la fiche →
                    </Link>
                    <DefusionnerButton fusionId={f.id} />
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
