import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DoublonsView, { DoublonPairData, ClientData, RaisonData } from './_components/DoublonsView'

// ── Algorithme de détection ────────────────────────────────────────────────────

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
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normTel(tel: string | null): string | null {
  if (!tel) return null
  const d = tel.replace(/\D/g, '')
  if (d.startsWith('33') && d.length === 11) return '0' + d.slice(2)
  return d || null
}

function comparerPaire(a: ClientData, b: ClientData): RaisonData[] {
  const raisons: RaisonData[] = []

  // Email
  const ea = a.email.toLowerCase().trim()
  const eb = b.email.toLowerCase().trim()
  if (ea === eb) {
    raisons.push({ champ: 'email', type: 'exact', score: 1 })
  } else {
    const s = sim(ea, eb)
    if (s >= 0.82) raisons.push({ champ: 'email', type: 'similaire', score: s })
  }

  // Nom complet
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

  // Téléphone
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function DoublonsPage() {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!beatmaker) redirect('/')

  const beatmakerId = user.id

  // ── Tous les client_ids de ce beatmaker ───────────────────────────────────
  const [commandesIdsRes, aboIdsRes, leadsIdsRes] = await Promise.all([
    supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null),
    supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null),
    supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId),
  ])

  const clientIds = [...new Set([
    ...(commandesIdsRes.data ?? []).map(c => c.client_id as string),
    ...(aboIdsRes.data ?? []).map(a => a.client_id as string),
    ...(leadsIdsRes.data ?? []).map(l => l.client_id as string),
  ])]

  if (clientIds.length < 2) {
    return (
      <div className="px-8 py-8 max-w-6xl mx-auto">
        <PageHeader />
        <div className="bg-gray-900 border border-gray-800 rounded-2xl py-16 text-center">
          <p className="text-4xl mb-4">✓</p>
          <p className="text-gray-500 text-sm">Pas assez de contacts pour détecter des doublons.</p>
        </div>
      </div>
    )
  }

  // ── Données clients, commandes, abos, doublons ignorés + fusionnés ─────────
  const [clientsRes, commandesRes, aboRes, ignoresRes, fusionsRes] = await Promise.all([
    admin.from('clients')
      .select('id, prenom, nom, email, pays, telephone')
      .in('id', clientIds),
    supabase.from('commandes')
      .select('client_id, prix_paye, statut, type_commande')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase.from('abonnements_boutique')
      .select('client_id, statut')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase.from('doublons_ignores')
      .select('client_id_1, client_id_2')
      .eq('beatmaker_id', beatmakerId),
    supabase.from('fusions_crm')
      .select('client_id_archive')
      .eq('beatmaker_id', beatmakerId),
  ])

  const clientsRaw  = clientsRes.data ?? []
  const commandes   = commandesRes.data ?? []
  const abos        = aboRes.data ?? []
  const ignores     = ignoresRes.data ?? []
  const archiveIds  = new Set((fusionsRes.data ?? []).map(f => f.client_id_archive))

  const ignoresSet = new Set(
    ignores.map(p => [p.client_id_1, p.client_id_2].sort().join('|'))
  )

  // LTV + nb_achats par client
  const ltvMap    = new Map<string, number>()
  const achatsMap = new Map<string, number>()
  for (const cmd of commandes) {
    const id = cmd.client_id as string
    if (cmd.statut === 'payee') ltvMap.set(id, (ltvMap.get(id) ?? 0) + (cmd.prix_paye ?? 0))
    if (cmd.type_commande === 'LICENCE') achatsMap.set(id, (achatsMap.get(id) ?? 0) + 1)
  }

  // Statut abo par client
  const aboMap = new Map<string, 'actif' | 'ancien'>()
  for (const abo of abos) {
    const id = abo.client_id as string
    if (abo.statut === 'actif' || abo.statut === 'impaye') {
      aboMap.set(id, 'actif')
    } else if (abo.statut === 'annule' && !aboMap.has(id)) {
      aboMap.set(id, 'ancien')
    }
  }

  const clients: ClientData[] = clientsRaw.filter(c => !archiveIds.has(c.id)).map(c => ({
    id:         c.id,
    prenom:     c.prenom,
    nom:        c.nom,
    email:      c.email,
    pays:       c.pays,
    telephone:  c.telephone,
    ltv:        ltvMap.get(c.id) ?? 0,
    nb_achats:  achatsMap.get(c.id) ?? 0,
    statut_abo: aboMap.get(c.id) ?? null,
  }))

  // ── Détection des doublons ─────────────────────────────────────────────────
  const paires: DoublonPairData[] = []
  for (let i = 0; i < clients.length; i++) {
    for (let j = i + 1; j < clients.length; j++) {
      const a = clients[i], b = clients[j]
      if (ignoresSet.has([a.id, b.id].sort().join('|'))) continue
      const raisons = comparerPaire(a, b)
      if (raisons.length === 0) continue
      const confiance: DoublonPairData['confiance'] =
        raisons.some(r => r.type === 'exact') || raisons.length >= 2 ? 'haute' : 'probable'
      paires.push({ a, b, raisons, confiance })
    }
  }

  paires.sort((x, y) => {
    if (x.confiance !== y.confiance) return x.confiance === 'haute' ? -1 : 1
    return y.raisons.length - x.raisons.length
  })

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <PageHeader />
      <DoublonsView paires={paires} />
    </div>
  )
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-2xl font-bold">Doublons</h1>
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/business/doublons/historique"
          className="text-xs px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          Historique des fusions
        </Link>
        <Link
          href="/dashboard/business/doublons/fusionner"
          className="text-xs px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          ⊕ Fusionner manuellement
        </Link>
      </div>
    </div>
  )
}
