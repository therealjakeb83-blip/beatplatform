import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DesignorerButton from './_components/DesignorerButton'

// ── Algorithme de détection (miroir de doublons/page.tsx) ─────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

function sim(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ')
}

function normTel(tel: string | null): string | null {
  if (!tel) return null
  const d = tel.replace(/\D/g, '')
  if (d.startsWith('33') && d.length === 11) return '0' + d.slice(2)
  return d || null
}

type RaisonData = { champ: string; type: 'exact' | 'similaire'; score: number }
type ClientMin  = { id: string; prenom: string | null; nom: string | null; email: string; pays: string | null; telephone: string | null }

function comparerPaire(a: ClientMin, b: ClientMin): RaisonData[] {
  const raisons: RaisonData[] = []
  const ea = a.email.toLowerCase().trim()
  const eb = b.email.toLowerCase().trim()
  if (ea === eb) {
    raisons.push({ champ: 'email', type: 'exact', score: 1 })
  } else {
    const s = sim(ea, eb)
    if (s >= 0.82) raisons.push({ champ: 'email', type: 'similaire', score: s })
  }
  const nomA = norm(`${a.prenom ?? ''} ${a.nom ?? ''}`)
  const nomB = norm(`${b.prenom ?? ''} ${b.nom ?? ''}`)
  if (nomA.length > 2 && nomB.length > 2) {
    if (nomA === nomB) {
      raisons.push({ champ: 'nom', type: 'exact', score: 1 })
    } else {
      const s = sim(nomA, nomB)
      if (s >= 0.80) raisons.push({ champ: 'nom', type: 'similaire', score: s })
    }
  }
  const telA = normTel(a.telephone)
  const telB = normTel(b.telephone)
  if (telA && telB) {
    if (telA === telB) {
      raisons.push({ champ: 'telephone', type: 'exact', score: 1 })
    } else {
      const s = sim(telA, telB)
      if (s >= 0.88) raisons.push({ champ: 'telephone', type: 'similaire', score: s })
    }
  }
  return raisons
}

function formatLtv(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DoublonsIgnoresPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const beatmakerId = user.id

  const { data: ignoresRaw } = await supabase
    .from('doublons_ignores')
    .select('id, client_id_1, client_id_2, created_at')
    .eq('beatmaker_id', beatmakerId)
    .order('created_at', { ascending: false })

  const ignores = ignoresRaw ?? []

  const allClientIds = [...new Set(ignores.flatMap(p => [p.client_id_1, p.client_id_2]))]

  const clientMap = new Map<string, ClientMin>()
  const ltvMap    = new Map<string, number>()

  if (allClientIds.length > 0) {
    const [clientsRes, commandesRes] = await Promise.all([
      admin.from('clients')
        .select('id, prenom, nom, email, pays, telephone')
        .in('id', allClientIds),
      supabase.from('commandes')
        .select('client_id, prix_paye, statut')
        .eq('beatmaker_id', beatmakerId)
        .in('client_id', allClientIds),
    ])
    for (const c of clientsRes.data ?? []) clientMap.set(c.id, c)
    for (const cmd of commandesRes.data ?? []) {
      if (cmd.statut === 'payee') {
        const id = cmd.client_id as string
        ltvMap.set(id, (ltvMap.get(id) ?? 0) + (cmd.prix_paye ?? 0))
      }
    }
  }

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link href="/dashboard/business/doublons" className="hover:text-white transition-colors">Doublons</Link>
        <span className="text-gray-700">›</span>
        <span className="text-white">Paires ignorées</span>
      </div>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Paires ignorées</h1>
          <p className="text-sm text-gray-500 mt-1">
            {ignores.length} paire{ignores.length > 1 ? 's' : ''} ignorée{ignores.length > 1 ? 's' : ''} — désignore pour la faire réapparaître dans la liste, ou fusionne si tu changes d&apos;avis.
          </p>
        </div>
      </div>

      {ignores.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center text-gray-600 text-sm">
          Aucune paire ignorée pour l&apos;instant.
        </div>
      ) : (
        <div className="space-y-3">
          {ignores.map(pair => {
            const c1 = clientMap.get(pair.client_id_1)
            const c2 = clientMap.get(pair.client_id_2)
            if (!c1 || !c2) return null

            const ltv1 = ltvMap.get(c1.id) ?? 0
            const ltv2 = ltvMap.get(c2.id) ?? 0

            // Pour le lien fusion : LTV la plus haute = conservé
            const [conserve, archive] = ltv1 >= ltv2 ? [c1, c2] : [c2, c1]
            const raisons = comparerPaire(c1, c2)

            const fusionUrl = `/dashboard/business/doublons/fusionner?conserve=${conserve.id}&archive=${archive.id}&raisons=${encodeURIComponent(JSON.stringify(raisons))}`

            return (
              <div key={pair.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
                <div className="grid grid-cols-[1fr_40px_1fr_auto] items-center gap-4 px-5 py-4">

                  {/* Contact 1 */}
                  <ContactCard client={c1} ltv={ltv1} />

                  <div className="text-gray-700 text-lg text-center">↔</div>

                  {/* Contact 2 */}
                  <ContactCard client={c2} ltv={ltv2} />

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-gray-600">{formatDate(pair.created_at)}</p>
                    {raisons.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end">
                        {raisons.map((r, i) => (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.type === 'exact'
                              ? 'bg-orange-500/15 text-orange-400'
                              : 'bg-yellow-500/10 text-yellow-600'
                          }`}>
                            {r.champ} {r.type === 'similaire' ? `${Math.round(r.score * 100)}%` : 'exact'}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <DesignorerButton ignoreId={pair.id} />
                      <Link
                        href={fusionUrl}
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        Fusionner
                      </Link>
                    </div>
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

function ContactCard({ client, ltv }: { client: ClientMin; ltv: number }) {
  const initiales = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
        {client.pays ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`https://flagcdn.com/w40/${client.pays.toLowerCase()}.png`} alt={client.pays} className="w-full h-full object-cover" />
        ) : (
          <span className="text-[10px] text-indigo-300 font-bold">{initiales}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white truncate">{client.prenom} {client.nom}</p>
        <p className="text-xs text-gray-500 truncate">{client.email}</p>
        <p className="text-xs text-gray-600 mt-0.5">LTV {formatLtv(ltv)}</p>
      </div>
    </div>
  )
}
