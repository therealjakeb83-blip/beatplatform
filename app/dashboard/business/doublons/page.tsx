import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DoublonsView, { DoublonPairData, ClientData, RaisonData } from './_components/DoublonsView'
import { montantDepense } from '@/app/dashboard/business/_lib/ltv'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'
import { chargerCommandesExternesCrm } from '@/app/dashboard/business/_lib/commandes-externes'
import { sim } from '@/lib/similarite'

// ── Algorithme de détection ────────────────────────────────────────────────────

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

type Cles = { email: string; nom: string; tel: string | null }
const clesCache = new WeakMap<ClientData, Cles>()
function cles(c: ClientData): Cles {
  let k = clesCache.get(c)
  if (!k) {
    k = { email: c.email.toLowerCase().trim(), nom: norm(`${c.prenom ?? ''} ${c.nom ?? ''}`), tel: normTel(c.telephone) }
    clesCache.set(c, k)
  }
  return k
}

function comparerPaire(a: ClientData, b: ClientData): RaisonData[] {
  const raisons: RaisonData[] = []
  const ka = cles(a), kb = cles(b)

  // Email
  const ea = ka.email
  const eb = kb.email
  if (ea === eb) {
    raisons.push({ champ: 'email', type: 'exact', score: 1 })
  } else {
    const s = sim(ea, eb, 0.82)
    if (s >= 0.82) raisons.push({ champ: 'email', type: 'similaire', score: s })
  }

  // Nom complet
  const nomA = ka.nom
  const nomB = kb.nom
  if (nomA.length > 2 && nomB.length > 2) {
    if (nomA === nomB) {
      raisons.push({ champ: 'nom', type: 'exact', score: 1 })
    } else {
      const s = sim(nomA, nomB, 0.80)
      if (s >= 0.80) raisons.push({ champ: 'nom', type: 'similaire', score: s })
    }
  }

  // Téléphone
  const telA = ka.tel
  const telB = kb.tel
  if (telA && telB) {
    if (telA === telB) {
      raisons.push({ champ: 'telephone', type: 'exact', score: 1 })
    } else {
      const s = sim(telA, telB, 0.88)
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
  type AvecClient = { client_id: string }
  const [commandesIds, aboIds, leadsIds] = await Promise.all([
    toutesLesLignes<AvecClient>((d, f) => supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null).order('id').range(d, f)),
    toutesLesLignes<AvecClient>((d, f) => supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null).order('id').range(d, f)),
    toutesLesLignes<AvecClient>((d, f) => supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId).order('id').range(d, f)),
  ])

  const clientIds = [...new Set([
    ...commandesIds.map(c => c.client_id),
    ...aboIds.map(a => a.client_id),
    ...leadsIds.map(l => l.client_id),
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
  type CommandeDoublon = { client_id: string; prix_paye: number | string | null; statut: string; montant_rembourse_cents: number | null; type_commande: string }
  const [clientsData, commandesNatives, commandesExternes, aboRes, ignoresRes, fusionsRes] = await Promise.all([
    parLots<{ id: string; prenom: string; nom: string; email: string; pays: string | null; telephone: string | null }>(clientIds, lot => admin.from('clients')
      .select('id, prenom, nom, email, pays, telephone')
      .in('id', lot)),
    toutesLesLignes<CommandeDoublon>((d, f) => supabase.from('commandes')
      .select('client_id, prix_paye, statut, montant_rembourse_cents, type_commande')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null)
      .order('id')
      .range(d, f)),
    chargerCommandesExternesCrm(supabase, beatmakerId),
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

  const clientsRaw  = clientsData
  const commandes: CommandeDoublon[] = [...commandesNatives, ...commandesExternes]
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
    ltvMap.set(id, (ltvMap.get(id) ?? 0) + montantDepense(cmd))
    if (cmd.type_commande === 'LICENCE' && montantDepense(cmd) > 0) achatsMap.set(id, (achatsMap.get(id) ?? 0) + 1)
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
          href="/dashboard/business/doublons/ignores"
          className="text-xs px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          Paires ignorées
        </Link>
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
