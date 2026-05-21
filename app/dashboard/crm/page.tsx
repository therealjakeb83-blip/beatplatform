import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function getLangue(pays: string | null | undefined): 'FR' | 'US' {
  return pays && PAYS_FR.has(pays.toUpperCase()) ? 'FR' : 'US'
}

function dateRelative(dateStr: string): string {
  const jours = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (jours === 0) return "Auj."
  if (jours === 1) return 'Hier'
  if (jours < 7) return `${jours}j`
  if (jours < 30) return `${Math.floor(jours / 7)} sem`
  if (jours < 365) return `${Math.floor(jours / 30)} mois`
  const ans = Math.floor(jours / 365)
  return `${ans} an${ans > 1 ? 's' : ''}`
}

function topValue(counts: Map<string, number>): string | null {
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

// --- RFM ---

type Segment = 'champion' | 'fidele' | 'potentiel' | 'a_risque' | 'dormant' | 'a_reactiver' | 'nouveau' | 'lead'

const SEGMENT_CONFIG: Record<Segment, { label: string; color: string }> = {
  champion:    { label: 'Champion',    color: 'bg-yellow-500/20 text-yellow-400' },
  fidele:      { label: 'Fidèle',      color: 'bg-green-500/20 text-green-400' },
  potentiel:   { label: 'Potentiel',   color: 'bg-blue-500/20 text-blue-400' },
  a_risque:    { label: 'À risque',    color: 'bg-orange-500/20 text-orange-400' },
  dormant:     { label: 'Dormant',     color: 'bg-gray-600/30 text-gray-500' },
  a_reactiver: { label: 'À réactiver', color: 'bg-red-500/20 text-red-400' },
  nouveau:     { label: 'Nouveau',     color: 'bg-teal-500/20 text-teal-400' },
  lead:        { label: 'Lead',        color: 'bg-gray-700/40 text-gray-500' },
}

function scoreR(derniere_commande: string | null): number {
  if (!derniere_commande) return 0
  const jours = (Date.now() - new Date(derniere_commande).getTime()) / 86400000
  if (jours < 7) return 5
  if (jours < 30) return 4
  if (jours < 90) return 3
  if (jours < 180) return 2
  if (jours < 365) return 1
  return 0
}

function scoreF(nb: number): number {
  if (nb >= 10) return 5
  if (nb >= 5) return 4
  if (nb >= 3) return 3
  if (nb >= 2) return 2
  if (nb >= 1) return 1
  return 0
}

function scoreM(ltv: number): number {
  if (ltv >= 500) return 5
  if (ltv >= 200) return 4
  if (ltv >= 100) return 3
  if (ltv >= 50) return 2
  if (ltv >= 1) return 1
  return 0
}

function getSegment(
  nb_achats: number,
  ltv: number,
  derniere_commande: string | null,
  statut_abo: 'abonne' | 'ancien' | 'jamais'
): { r: number; f: number; m: number; rfm: number; segment: Segment } {
  const r = scoreR(derniere_commande)
  const f = scoreF(nb_achats)
  const m = scoreM(ltv)
  const rfm = Math.round((r + f + m) / 15 * 100)

  let segment: Segment

  if (nb_achats === 0 && statut_abo === 'jamais') {
    segment = 'lead'
  } else if (statut_abo === 'ancien') {
    segment = 'a_reactiver'
  } else if (r >= 4 && f >= 4 && m >= 3) {
    segment = 'champion'
  } else if (f >= 3 && m >= 2 && r >= 2) {
    segment = 'fidele'
  } else if ((f >= 2 || m >= 3) && r <= 2) {
    segment = 'a_risque'
  } else if (r <= 1) {
    segment = 'dormant'
  } else if (nb_achats <= 2 && r >= 3 && m >= 2) {
    segment = 'potentiel'
  } else if (nb_achats >= 1 && r >= 3) {
    segment = 'nouveau'
  } else {
    segment = 'dormant'
  }

  return { r, f, m, rfm, segment }
}

// --- Types ---

type ClientCRM = {
  id: string | null
  email: string
  nom: string
  pays: string | null
  nb_achats: number
  ltv: number
  statut_abo: 'abonne' | 'ancien' | 'jamais'
  derniere_commande: string | null
  style_prefere: string | null
  type_beat_prefere: string | null
  date_premier_contact: string
  r: number
  f: number
  m: number
  rfm: number
  segment: Segment
}

function initiales(nom: string) {
  return nom.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || '?'
}

export default async function CRMPage({
  searchParams,
}: {
  searchParams: Promise<{ recherche?: string; filtre?: string }>
}) {
  const params = await searchParams
  const recherche = params.recherche?.toLowerCase() ?? ''
  const filtre = params.filtre ?? 'tous'

  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: commandes }, { data: abonnements }] = await Promise.all([
    supabase
      .from('commandes')
      .select('client_id, acheteur_email, acheteur_nom, prix_paye, statut, created_at, type_commande, beats(styles, type_beat)')
      .eq('beatmaker_id', user.id),
    supabase
      .from('abonnements_boutique')
      .select('client_id, acheteur_email, acheteur_nom, statut, created_at')
      .eq('beatmaker_id', user.id),
  ])

  const clientIds = [...new Set([
    ...(commandes ?? []).filter(c => c.client_id).map(c => c.client_id as string),
    ...(abonnements ?? []).filter(a => a.client_id).map(a => a.client_id as string),
  ])]

  const { data: clientsData } = clientIds.length > 0
    ? await admin.from('clients').select('id, email, nom, prenom, pays').in('id', clientIds)
    : { data: [] }

  const clientsById = new Map((clientsData ?? []).map(c => [c.id, c]))

  function getEmail(clientId: string | null, fallback: string | null) {
    if (clientId) return clientsById.get(clientId)?.email ?? fallback ?? ''
    return fallback ?? ''
  }

  function getNom(clientId: string | null, fallback: string | null) {
    if (clientId) {
      const c = clientsById.get(clientId)
      if (c) return `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()
    }
    return fallback ?? ''
  }

  function getPays(clientId: string | null): string | null {
    if (clientId) return clientsById.get(clientId)?.pays ?? null
    return null
  }

  type CRMEntry = Omit<ClientCRM, 'r' | 'f' | 'm' | 'rfm' | 'segment'>
  const crmMap = new Map<string, CRMEntry>()
  const stylesCount = new Map<string, Map<string, number>>()
  const typeBeatCount = new Map<string, Map<string, number>>()

  function upsert(email: string, id: string | null, nom: string, pays: string | null, date: string) {
    if (!email) return
    if (!crmMap.has(email)) {
      crmMap.set(email, {
        id, email, nom: nom || email, pays,
        nb_achats: 0, ltv: 0,
        statut_abo: 'jamais',
        derniere_commande: null,
        style_prefere: null, type_beat_prefere: null,
        date_premier_contact: date,
      })
    } else {
      const entry = crmMap.get(email)!
      if (!entry.id && id) entry.id = id
      if ((!entry.nom || entry.nom === email) && nom) entry.nom = nom
      if (!entry.pays && pays) entry.pays = pays
      if (date < entry.date_premier_contact) entry.date_premier_contact = date
    }
  }

  for (const cmd of commandes ?? []) {
    const email = getEmail(cmd.client_id, cmd.acheteur_email)
    const nom = getNom(cmd.client_id, cmd.acheteur_nom)
    const pays = getPays(cmd.client_id)
    if (!email) continue
    upsert(email, cmd.client_id, nom, pays, cmd.created_at)
    const entry = crmMap.get(email)!
    if (cmd.statut === 'payee') {
      const estRnvt = (cmd as any).type_commande === 'RENOUVELLEMENT'
      entry.ltv += cmd.prix_paye
      if (!estRnvt) {
        entry.nb_achats++
        if (!entry.derniere_commande || cmd.created_at > entry.derniere_commande) {
          entry.derniere_commande = cmd.created_at
        }
      }
      const beat = (cmd as any).beats
      if (beat?.styles?.length) {
        if (!stylesCount.has(email)) stylesCount.set(email, new Map())
        for (const s of beat.styles as string[]) {
          const m = stylesCount.get(email)!
          m.set(s, (m.get(s) ?? 0) + 1)
        }
      }
      if (beat?.type_beat?.length) {
        if (!typeBeatCount.has(email)) typeBeatCount.set(email, new Map())
        for (const t of beat.type_beat as string[]) {
          const m = typeBeatCount.get(email)!
          m.set(t, (m.get(t) ?? 0) + 1)
        }
      }
    }
  }

  for (const abo of abonnements ?? []) {
    const email = getEmail(abo.client_id, abo.acheteur_email)
    const nom = getNom(abo.client_id, abo.acheteur_nom)
    const pays = getPays(abo.client_id)
    if (!email) continue
    upsert(email, abo.client_id, nom, pays, abo.created_at)
    const entry = crmMap.get(email)!
    if (abo.statut === 'actif') {
      entry.statut_abo = 'abonne'
    } else if (entry.statut_abo !== 'abonne') {
      entry.statut_abo = 'ancien'
    }
  }

  for (const [email, entry] of crmMap) {
    const sc = stylesCount.get(email)
    if (sc) entry.style_prefere = topValue(sc)
    const tc = typeBeatCount.get(email)
    if (tc) entry.type_beat_prefere = topValue(tc)
  }

  const tous: ClientCRM[] = Array.from(crmMap.values())
    .sort((a, b) => new Date(b.date_premier_contact).getTime() - new Date(a.date_premier_contact).getTime())
    .map(c => {
      const { r, f, m, rfm, segment } = getSegment(c.nb_achats, c.ltv, c.derniere_commande, c.statut_abo)
      return { ...c, r, f, m, rfm, segment }
    })

  const pretAboCount = tous.filter(c => c.nb_achats >= 3 && c.statut_abo === 'jamais').length

  const stats = {
    total: tous.length,
    abonnes: tous.filter(c => c.statut_abo === 'abonne').length,
    anciens: tous.filter(c => c.statut_abo === 'ancien').length,
    ltv: tous.reduce((s, c) => s + c.ltv, 0),
    ltvMoyenne: tous.length > 0 ? Math.round(tous.reduce((s, c) => s + c.ltv, 0) / tous.length) : 0,
    champions: tous.filter(c => c.segment === 'champion').length,
    fideles: tous.filter(c => c.segment === 'fidele').length,
    a_risque: tous.filter(c => c.segment === 'a_risque').length,
    dormants: tous.filter(c => c.segment === 'dormant').length,
  }

  let clients = tous
  if (recherche) clients = clients.filter(c => c.nom.toLowerCase().includes(recherche) || c.email.toLowerCase().includes(recherche))
  if (filtre === 'abonne') clients = clients.filter(c => c.statut_abo === 'abonne')
  if (filtre === 'ancien') clients = clients.filter(c => c.statut_abo === 'ancien')
  if (filtre === 'jamais') clients = clients.filter(c => c.statut_abo === 'jamais')
  if (filtre === 'leads') clients = clients.filter(c => c.nb_achats === 0 && c.statut_abo === 'jamais')
  if (filtre === 'champion') clients = clients.filter(c => c.segment === 'champion')
  if (filtre === 'fidele') clients = clients.filter(c => c.segment === 'fidele')
  if (filtre === 'potentiel') clients = clients.filter(c => c.segment === 'potentiel')
  if (filtre === 'a_risque') clients = clients.filter(c => c.segment === 'a_risque')
  if (filtre === 'dormant') clients = clients.filter(c => c.segment === 'dormant')
  if (filtre === 'a_reactiver') clients = clients.filter(c => c.segment === 'a_reactiver')
  if (filtre === 'pret_abo') clients = clients.filter(c => c.nb_achats >= 3 && c.statut_abo === 'jamais')

  const FILTRES_STATUT = [
    { key: 'tous', label: 'Tous' },
    { key: 'abonne', label: 'Abonnés' },
    { key: 'ancien', label: 'Anciens abonnés' },
    { key: 'jamais', label: 'Jamais abonnés' },
    { key: 'leads', label: 'Leads' },
  ]

  const FILTRES_SEGMENT = [
    { key: 'champion', label: 'Champions' },
    { key: 'fidele', label: 'Fidèles' },
    { key: 'potentiel', label: 'Potentiels' },
    { key: 'a_risque', label: 'À risque' },
    { key: 'dormant', label: 'Dormants' },
    { key: 'a_reactiver', label: 'À réactiver' },
  ]

  const filtreActif = (key: string) => filtre === key
    ? 'bg-indigo-600 text-white'
    : 'bg-gray-900 text-gray-400 hover:text-white border border-gray-800'

  const filtreUrl = (key: string) =>
    `/dashboard/crm?filtre=${key}${recherche ? `&recherche=${encodeURIComponent(recherche)}` : ''}`

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-300 mb-2 block">← Dashboard</Link>
            <h1 className="text-2xl font-bold">Mon CRM</h1>
          </div>
          <div className="flex gap-2">
            <a
              href="/api/dashboard/crm/export-newsletter"
              className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              Exporter newsletter
            </a>
            <Link
              href="/dashboard/crm/doublons"
              className="text-sm px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors"
            >
              Doublons
            </Link>
          </div>
        </div>

        {/* Stats Row 1 — contacts & revenus */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Contacts', value: stats.total },
            { label: 'Abonnés actifs', value: stats.abonnes },
            { label: 'LTV totale', value: `${stats.ltv.toLocaleString('fr-FR')} €` },
            { label: 'LTV moyenne', value: `${stats.ltvMoyenne.toLocaleString('fr-FR')} €` },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
              <p className="text-2xl font-black text-white">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Stats Row 2 — segments cliquables */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {([
            { label: 'Champions',  value: stats.champions, color: 'text-yellow-400', key: 'champion' },
            { label: 'Fidèles',    value: stats.fideles,   color: 'text-green-400',  key: 'fidele'   },
            { label: 'À risque',   value: stats.a_risque,  color: 'text-orange-400', key: 'a_risque' },
            { label: 'Dormants',   value: stats.dormants,  color: 'text-gray-500',   key: 'dormant'  },
          ] as const).map(s => (
            <Link
              key={s.label}
              href={filtreUrl(s.key)}
              className={`bg-gray-900 border rounded-xl p-4 hover:border-gray-700 transition-colors ${
                filtre === s.key ? 'border-indigo-600' : 'border-gray-800'
              }`}
            >
              <p className="text-gray-500 text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </Link>
          ))}
        </div>

        {/* Vues métier */}
        {(stats.dormants > 0 || stats.a_risque > 0 || pretAboCount > 0) && (
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Actions recommandées</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.dormants > 0 && (
                <Link
                  href={filtreUrl('dormant')}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Clients à relancer</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stats.dormants} inactif{stats.dormants > 1 ? 's' : ''} depuis 3+ mois</p>
                  </div>
                  <span className="text-gray-600 ml-4">→</span>
                </Link>
              )}
              {stats.a_risque > 0 && (
                <Link
                  href={filtreUrl('a_risque')}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-orange-900/40 rounded-xl hover:border-orange-800/60 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Risque de partir</p>
                    <p className="text-xs text-gray-500 mt-0.5">{stats.a_risque} bon{stats.a_risque > 1 ? 's' : ''} client{stats.a_risque > 1 ? 's' : ''} qui se désengagent</p>
                  </div>
                  <span className="text-orange-700 ml-4">→</span>
                </Link>
              )}
              {pretAboCount > 0 && (
                <Link
                  href={filtreUrl('pret_abo')}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">Prêts à s&apos;abonner</p>
                    <p className="text-xs text-gray-500 mt-0.5">{pretAboCount} client{pretAboCount > 1 ? 's' : ''} avec 3+ achats, pas encore abonné{pretAboCount > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-gray-600 ml-4">→</span>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Recherche + filtres statut */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          <form className="flex-1">
            {filtre !== 'tous' && <input type="hidden" name="filtre" value={filtre} />}
            <input
              type="text"
              name="recherche"
              defaultValue={recherche}
              placeholder="Rechercher par nom ou email…"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </form>
          <div className="flex gap-2 flex-wrap">
            {FILTRES_STATUT.map(f => (
              <Link
                key={f.key}
                href={filtreUrl(f.key)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${filtreActif(f.key)}`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Filtres segments */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTRES_SEGMENT.map(f => (
            <Link
              key={f.key}
              href={filtreUrl(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap ${
                filtre === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-900 text-gray-500 hover:text-white border border-gray-800'
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {/* Liste */}
        {clients.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <p className="text-lg mb-2">
              {recherche ? 'Aucun résultat pour cette recherche.' : 'Aucun client pour l\'instant.'}
            </p>
            {!recherche && (
              <p className="text-sm text-gray-700">
                Tes clients apparaîtront ici après leurs premiers achats ou abonnements.
              </p>
            )}
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {clients.map((c, i) => {
              const seg = SEGMENT_CONFIG[c.segment]
              return (
                <div
                  key={c.email}
                  className={`flex items-center gap-4 px-5 py-4 ${
                    i < clients.length - 1 ? 'border-b border-gray-800' : ''
                  } ${c.id ? 'hover:bg-gray-800/40 transition-colors' : ''}`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-indigo-900/60 flex items-center justify-center text-indigo-300 font-bold text-sm flex-shrink-0">
                    {initiales(c.nom)}
                  </div>

                  {/* Nom + email + badges abo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-white truncate">{c.nom !== c.email ? c.nom : '—'}</p>
                      {c.statut_abo === 'abonne' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium whitespace-nowrap">Abonné</span>
                      )}
                      {c.statut_abo === 'ancien' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium whitespace-nowrap">Ancien abonné</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.email}</p>
                  </div>

                  {/* Segment RFM */}
                  <div className="hidden md:block flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${seg.color}`}>
                      {seg.label}
                    </span>
                  </div>

                  {/* Langue */}
                  <div className="text-center w-8 hidden lg:block">
                    <span className="text-xs text-gray-500">{getLangue(c.pays)}</span>
                  </div>

                  {/* Achats */}
                  <div className="text-right w-14 hidden sm:block">
                    <p className="font-semibold text-white">{c.nb_achats}</p>
                    <p className="text-xs text-gray-600">achat{c.nb_achats > 1 ? 's' : ''}</p>
                  </div>

                  {/* LTV */}
                  <div className="text-right w-20 hidden sm:block">
                    <p className="font-semibold text-white">{c.ltv.toLocaleString('fr-FR')} €</p>
                    <p className="text-xs text-gray-600">LTV</p>
                  </div>

                  {/* Dernière commande */}
                  <div className="text-right w-20 hidden md:block">
                    {c.derniere_commande ? (
                      <p className="text-xs text-gray-400">{dateRelative(c.derniere_commande)}</p>
                    ) : (
                      <p className="text-xs text-gray-700">—</p>
                    )}
                    <p className="text-xs text-gray-600">dernière cmd</p>
                  </div>

                  {/* Style · Type beat */}
                  <div className="text-right w-32 hidden xl:block">
                    {c.style_prefere || c.type_beat_prefere ? (
                      <p className="text-xs text-gray-400 truncate">
                        {[c.style_prefere, c.type_beat_prefere].filter(Boolean).join(' · ')}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-700">—</p>
                    )}
                  </div>

                  {/* Lien fiche */}
                  {c.id ? (
                    <Link
                      href={`/dashboard/crm/${c.id}`}
                      className="text-gray-600 hover:text-indigo-400 transition-colors text-lg flex-shrink-0"
                      title="Voir la fiche"
                    >
                      →
                    </Link>
                  ) : (
                    <div className="w-5 flex-shrink-0" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
