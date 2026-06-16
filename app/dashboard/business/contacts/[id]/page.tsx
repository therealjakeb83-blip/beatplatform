import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import SocialIcon from '../../_components/SocialIcon'

// ── Helpers ──────────────────────────────────────────────────────────────────

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function getLangue(pays: string | null | undefined): string {
  return pays && PAYS_FR.has(pays.toUpperCase()) ? 'Français' : 'Anglophone'
}

function topN(counts: Map<string, number>, n: number): string[] {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([v]) => v)
}

type BeatPrefs = {
  styles: string[] | null
  type_beat: string[] | null
  ambiances: string[] | null
  instruments: string[] | null
} | null

function accumPrefs(
  counts: {
    styles: Map<string, number>
    typeBeat: Map<string, number>
    ambiances: Map<string, number>
    instruments: Map<string, number>
  },
  beat: BeatPrefs,
  weight: number
) {
  if (!beat) return
  for (const s of beat.styles      ?? []) counts.styles.set(s,      (counts.styles.get(s)      ?? 0) + weight)
  for (const t of beat.type_beat   ?? []) counts.typeBeat.set(t,    (counts.typeBeat.get(t)    ?? 0) + weight)
  for (const a of beat.ambiances   ?? []) counts.ambiances.set(a,   (counts.ambiances.get(a)   ?? 0) + weight)
  for (const i of beat.instruments ?? []) counts.instruments.set(i, (counts.instruments.get(i) ?? 0) + weight)
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-800 last:border-0 gap-4">
      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-xs text-gray-200 text-right">{value}</span>
    </div>
  )
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Commande = {
  id: string
  beat_id: string | null
  created_at: string
  prix_paye: number
  statut: string
  type_commande: string | null
  plateforme_source: string | null
  beats: {
    titre: string
    image_url: string | null
    styles: string[] | null
    type_beat: string[] | null
    ambiances: string[] | null
    instruments: string[] | null
  } | null
  licences: { nom: string } | null
}

// ── Onglets ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'identite',    label: 'Identité'    },
  { key: 'abonnement',  label: 'Abonnement'  },
  { key: 'commandes',   label: 'Commandes'   },
  { key: 'preferences', label: 'Préférences' },
  { key: 'newsletter',  label: 'Newsletter'  },
  { key: 'catalogue',   label: 'Activité'    },
  { key: 'morceaux',    label: 'Morceaux'    },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FicheClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { id: clientId }        = await params
  const { onglet = 'identite' } = await searchParams

  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  // Client — admin car RLS clients = acheteurs seulement
  const { data: client } = await admin
    .from('clients')
    .select('id, email, nom, prenom, nom_artiste, created_at, pays, langue, telephone, adresse, ville, code_postal, instagram, spotify, youtube, tiktok, newsletter_consent, notes, tags')
    .eq('id', clientId)
    .single()

  if (!client) redirect('/dashboard/business/contacts')

  // Fusion virtuelle — ce contact est-il un conservé ?
  const { data: fusionRows } = await supabase
    .from('fusions_crm')
    .select('client_id_archive, emails_archives, champs_conserves')
    .eq('beatmaker_id', beatmakerId)
    .eq('client_id_conserve', clientId)

  const fusions        = fusionRows ?? []
  const archiveIds     = fusions.map(f => f.client_id_archive)
  const emailsSecondaires: string[] = fusions.flatMap(f => (f.emails_archives as string[]) ?? [])
  const champsOverride = fusions.reduce((acc, f) => ({ ...acc, ...(f.champs_conserves as Record<string, string>) }), {} as Record<string, string>)

  // Appliquer les overrides sur les champs en conflit
  const clientDisplay = {
    ...client,
    telephone:   (champsOverride.telephone   ?? client.telephone)   as string | null,
    pays:        (champsOverride.pays         ?? client.pays)        as string | null,
    instagram:   (champsOverride.instagram    ?? client.instagram)   as string | null,
    spotify:     (champsOverride.spotify      ?? client.spotify)     as string | null,
    youtube:     (champsOverride.youtube      ?? client.youtube)     as string | null,
    tiktok:      (champsOverride.tiktok       ?? client.tiktok)      as string | null,
    notes:       (champsOverride.notes        ?? client.notes)       as string | null,
    nom_artiste: (champsOverride.nom_artiste  ?? client.nom_artiste) as string | null,
  }

  // Construire les clauses OR pour inclure les archivés
  const allClientIds  = [clientId, ...archiveIds]
  const allEmails     = [client.email, ...emailsSecondaires]
  const orCommandes   = allClientIds.map(id => `client_id.eq.${id}`)
    .concat(allEmails.map(e => `acheteur_email.eq.${e}`))
    .join(',')

  // Toutes les données en parallèle
  const [
    { data: commandesRaw },
    { data: abonnement },
    { data: favorisRaw },
    { data: morceauxRaw },
    { data: freeDLRaw },
    { data: archivesDateRaw },
  ] = await Promise.all([
    supabase
      .from('commandes')
      .select(`
        id, beat_id, created_at, prix_paye, statut, plateforme_source, type_commande,
        beats(titre, image_url, styles, type_beat, ambiances, instruments),
        licences(nom)
      `)
      .eq('beatmaker_id', beatmakerId)
      .or(orCommandes)
      .order('created_at', { ascending: false }),
    supabase
      .from('abonnements_boutique')
      .select('statut, date_debut, date_fin, en_essai, annulation_en_cours, plan, prix, mensualites_payees')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', allClientIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from('favoris')
      .select('beat_id, beats(titre, image_url)')
      .in('client_id', allClientIds),
    supabase
      .from('morceaux_clients')
      .select('id, titre, lien_spotify, created_at')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', allClientIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('free_downloads')
      .select('beat_id, downloaded_at, beats(titre)')
      .in('client_id', allClientIds)
      .eq('beatmaker_id', beatmakerId)
      .order('downloaded_at', { ascending: false }),
    archiveIds.length > 0
      ? admin.from('clients').select('created_at').in('id', archiveIds)
      : Promise.resolve({ data: [] as { created_at: string }[] }),
  ])

  type FreeDL = { beat_id: string; downloaded_at: string; beats: { titre: string } | null }

  const commandes = (commandesRaw ?? []) as unknown as Commande[]
  const favoris   = (favorisRaw   ?? []) as unknown as Array<{ beat_id: string; beats: { titre?: string; image_url?: string } | null }>
  const morceaux  = morceauxRaw ?? []
  const freeDLs   = (freeDLRaw   ?? []) as unknown as FreeDL[]

  // "Client depuis" = date la plus ancienne parmi conservé + archivés
  const allDates  = [client.created_at, ...(archivesDateRaw ?? []).map(a => a.created_at)]
  const clientDepuis = allDates.sort()[0]

  // Métriques
  const payees         = commandes.filter(c => c.statut === 'payee')
  const achats         = payees.filter(c => c.type_commande !== 'RENOUVELLEMENT')
  const licencesPayees = payees.filter(c => c.type_commande === 'LICENCE')
  const nbAchats       = licencesPayees.length
  const ltv            = payees.reduce((s, c) => s + c.prix_paye, 0)
  const licenceLtv     = licencesPayees.reduce((s, c) => s + c.prix_paye, 0)
  const panierMoyen    = nbAchats > 0 ? Math.round(licenceLtv / nbAchats) : null
  const derniereCmd    = licencesPayees.map(c => c.created_at).sort().at(-1) ?? null
  const moisAboCommandes = commandes.filter(
    c => c.type_commande === 'RENOUVELLEMENT' || c.type_commande === 'CREATION_ABONNEMENT'
  ).length

  const statut_abo: 'abonne' | 'ancien' | 'jamais' = !abonnement
    ? 'jamais'
    : (abonnement.statut === 'actif' || abonnement.statut === 'impaye') ? 'abonne' : 'ancien'

  const moisRegles = abonnement?.en_essai
    ? 0
    : (abonnement?.mensualites_payees ?? 0) > 0
    ? (abonnement?.mensualites_payees ?? 0)
    : moisAboCommandes || 0

  // Préférences (achats ×2, favoris ×1)
  const prefCounts = {
    styles:      new Map<string, number>(),
    typeBeat:    new Map<string, number>(),
    ambiances:   new Map<string, number>(),
    instruments: new Map<string, number>(),
  }
  for (const c of payees) accumPrefs(prefCounts, c.beats, 2)

  const topStyles      = topN(prefCounts.styles,      5)
  const topTypeBeat    = topN(prefCounts.typeBeat,    3)
  const topAmbiances   = topN(prefCounts.ambiances,   5)
  const topInstruments = topN(prefCounts.instruments, 5)
  const topLicences    = (() => {
    const m = new Map<string, number>()
    for (const c of licencesPayees) {
      const nom = c.licences?.nom
      if (nom) m.set(nom, (m.get(nom) ?? 0) + 1)
    }
    return topN(m, 3)
  })()

  // ── Server actions ─────────────────────────────────────────────────────────

  async function sauvegarderNotes(formData: FormData) {
    'use server'
    const a = createAdminClient()
    await a.from('clients').update({
      notes: (formData.get('notes') as string ?? '').trim() || null,
    }).eq('id', clientId)
    revalidatePath(`/dashboard/business/contacts/${clientId}`)
  }

  async function ajouterTag(formData: FormData) {
    'use server'
    const a   = createAdminClient()
    const tag = (formData.get('tag') as string ?? '').trim()
    if (!tag) return
    const { data: current } = await a.from('clients').select('tags').eq('id', clientId).single()
    const tags = current?.tags ?? []
    if (!tags.includes(tag)) {
      await a.from('clients').update({ tags: [...tags, tag] }).eq('id', clientId)
    }
    revalidatePath(`/dashboard/business/contacts/${clientId}`)
  }

  async function supprimerTag(formData: FormData) {
    'use server'
    const a   = createAdminClient()
    const tag = (formData.get('tag') as string ?? '').trim()
    const { data: current } = await a.from('clients').select('tags').eq('id', clientId).single()
    const tags = (current?.tags ?? []).filter((t: string) => t !== tag)
    await a.from('clients').update({ tags }).eq('id', clientId)
    revalidatePath(`/dashboard/business/contacts/${clientId}`)
  }

  async function sauvegarderSociaux(formData: FormData) {
    'use server'
    const a = createAdminClient()
    await a.from('clients').update({
      instagram: (formData.get('instagram') as string ?? '').trim() || null,
      spotify:   (formData.get('spotify')   as string ?? '').trim() || null,
      youtube:   (formData.get('youtube')   as string ?? '').trim() || null,
      tiktok:    (formData.get('tiktok')    as string ?? '').trim() || null,
    }).eq('id', clientId)
    revalidatePath(`/dashboard/business/contacts/${clientId}`)
  }

  async function ajouterMorceau(formData: FormData) {
    'use server'
    const a     = createAdminClient()
    const titre = (formData.get('titre') as string ?? '').trim()
    const lien  = (formData.get('lien')  as string ?? '').trim()
    if (!titre) return
    await a.from('morceaux_clients').insert({
      beatmaker_id: beatmakerId,
      client_id:    clientId,
      titre,
      lien_spotify: lien || null,
    })
    revalidatePath(`/dashboard/business/contacts/${clientId}?onglet=morceaux`)
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  const nomComplet  = `${client.prenom ?? ''} ${client.nom ?? ''}`.trim()
  const initiales   = [client.prenom?.[0], client.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'
  const statutLabel = statut_abo === 'abonne' ? 'Abonné' : nbAchats > 0 ? 'Client' : 'Lead'
  const statutCls   = statut_abo === 'abonne'
    ? 'bg-green-500/20 text-green-400'
    : nbAchats > 0 ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-700 text-gray-400'

  const fmt        = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const fmtDate    = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtDateRel = (iso: string | null) => {
    if (!iso) return '–'
    const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (j === 0) return "Aujourd'hui"
    if (j === 1) return 'Hier'
    if (j < 7)   return `Il y a ${j}j`
    if (j < 30)  return `Il y a ${Math.floor(j / 7)} sem`
    if (j < 365) return `Il y a ${Math.floor(j / 30)} mois`
    return `Il y a ${Math.floor(j / 365)} an${Math.floor(j / 365) > 1 ? 's' : ''}`
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-800 text-sm flex-shrink-0">
        <Link href="/dashboard/business/contacts" className="text-gray-500 hover:text-white transition-colors">
          Contacts
        </Link>
        <span className="text-gray-700">›</span>
        <span className="text-white font-semibold">{nomComplet || client.email}</span>
      </div>

      <div className="max-w-3xl mx-auto w-full px-6 py-8 space-y-4">

        {/* ── En-tête ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                {clientDisplay.pays ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w80/${clientDisplay.pays.toLowerCase()}.png`}
                    alt={clientDisplay.pays}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-indigo-300 font-bold text-xl">{initiales}</span>
                )}
              </div>
              <div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-tight">{nomComplet || client.email}</h1>
                  {clientDisplay.nom_artiste && (
                    <span className="text-sm text-gray-500 italic">{clientDisplay.nom_artiste}</span>
                  )}
                </div>
                <a
                  href={`mailto:${client.email}`}
                  className="text-indigo-400 text-xs mt-0.5 hover:text-indigo-300 transition-colors block"
                >
                  {client.email}
                </a>
                {emailsSecondaires.map(e => (
                  <a key={e} href={`mailto:${e}`} className="text-gray-600 text-xs hover:text-gray-400 transition-colors block">
                    {e} <span className="text-gray-700 text-[10px]">· archivé</span>
                  </a>
                ))}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutCls}`}>
                    {statutLabel}
                  </span>
                  {abonnement?.annulation_en_cours && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-medium">
                      Annulation en cours
                    </span>
                  )}
                  {client.newsletter_consent ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400 border border-gray-700">
                      NWT ✓
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-600 border border-gray-800">
                      NWT ✗
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Icônes réseaux en haut à droite */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {(['instagram', 'spotify', 'youtube', 'tiktok'] as const).map(p => {
                const val = (clientDisplay as Record<string, unknown>)[p] as string | null
                return (
                  <div
                    key={p}
                    className={`p-2 rounded-xl border transition-colors ${val ? 'bg-gray-800 border-gray-700 hover:border-gray-500' : 'border-gray-800 opacity-20'}`}
                  >
                    <SocialIcon platform={p} value={val} size={16} />
                  </div>
                )
              })}
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-xs text-gray-500 mb-1">LTV</p>
              <p className="text-2xl font-black">{fmt(ltv)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Achats</p>
              <p className="text-2xl font-black">{nbAchats}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
              <p className="text-2xl font-black">{panierMoyen ? fmt(panierMoyen) : '–'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Dernier achat</p>
              <p className="text-sm font-semibold text-gray-300 mt-1">{fmtDateRel(derniereCmd)}</p>
            </div>
          </div>
        </div>

        {/* ── Tags ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-600 font-semibold uppercase tracking-wide flex-shrink-0 mr-1">Tags</span>
            {(client.tags ?? []).map((tag: string) => (
              <form key={tag} action={supprimerTag}>
                <input type="hidden" name="tag" value={tag} />
                <button type="submit" className="text-xs px-2.5 py-1 rounded-full bg-gray-800 border border-gray-700 text-gray-300 flex items-center gap-1.5 hover:border-red-500/50 hover:text-red-400 transition-colors">
                  {tag}
                  <span className="text-gray-600 leading-none">✕</span>
                </button>
              </form>
            ))}
            <details className="group relative">
              <summary className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer select-none list-none flex items-center gap-1 px-2.5 py-1 rounded-full border border-indigo-500/30 hover:border-indigo-400/50 transition-colors">
                + Ajouter
              </summary>
              <form action={ajouterTag} className="absolute mt-2 flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-xl p-2 shadow-xl z-10">
                <input
                  name="tag"
                  type="text"
                  placeholder="Nouveau tag..."
                  className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors w-40"
                />
                <button type="submit" className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors whitespace-nowrap">
                  OK
                </button>
              </form>
            </details>
          </div>
        </div>

        {/* ── Onglets ── */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map(tab => (
            <Link
              key={tab.key}
              href={`/dashboard/business/contacts/${clientId}?onglet=${tab.key}`}
              className={`text-xs px-4 py-2 rounded-xl border transition-all font-medium ${
                onglet === tab.key
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* IDENTITÉ                                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'identite' && (
          <div className="space-y-4">
            {/* Infos */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-sm mb-3">Identité</h2>
              <Row label="Prénom de contact" value={client.prenom ?? '–'} />
              <Row label="Nom d'artiste"     value={clientDisplay.nom_artiste ?? '–'} />
              <Row label="Pays"              value={clientDisplay.pays?.toUpperCase() ?? '–'} />
              <Row label="Langue"            value={client.langue ? (client.langue === 'FR' ? 'Français' : 'Anglophone') : getLangue(clientDisplay.pays)} />
              <Row label="Téléphone"         value={clientDisplay.telephone ?? '–'} />
              <Row label="Adresse"           value={[client.adresse, client.ville, client.code_postal].filter(Boolean).join(', ') || '–'} />
              <Row label="Client depuis"     value={fmtDate(clientDepuis)} />

              {/* Accordion réseaux sociaux */}
              <details className="group mt-1">
                <summary className="flex items-center gap-1 py-2 text-xs text-gray-600 hover:text-gray-400 cursor-pointer select-none list-none border-b border-gray-800">
                  Réseaux sociaux
                  <span className="group-open:rotate-180 transition-transform duration-150 ml-1">▾</span>
                </summary>
                <form action={sauvegarderSociaux} className="pt-2 space-y-0">
                  {(['instagram', 'spotify', 'youtube', 'tiktok'] as const).map(r => (
                    <div key={r} className="flex items-center justify-between py-1.5 border-b border-gray-800 last:border-0 gap-3">
                      <span className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0 w-24 capitalize">
                        <SocialIcon platform={r} value={(clientDisplay as Record<string, unknown>)[r] as string | null} size={12} />
                        {r}
                      </span>
                      <input
                        name={r}
                        type="text"
                        defaultValue={(clientDisplay as Record<string, unknown>)[r] as string ?? ''}
                        placeholder={`@${r}`}
                        className="flex-1 text-xs bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    className="mt-3 text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                  >
                    Enregistrer
                  </button>
                </form>
              </details>

              {/* Notes */}
              <div className="pt-3">
                <p className="text-xs text-gray-500 mb-1.5">Notes</p>
                <form action={sauvegarderNotes}>
                  <textarea
                    name="notes"
                    defaultValue={clientDisplay.notes ?? ''}
                    placeholder="Notes internes..."
                    rows={3}
                    className="w-full text-xs text-gray-200 bg-gray-800/60 border border-gray-700 hover:border-gray-600 focus:border-indigo-500 focus:bg-indigo-950/20 rounded-lg px-3 py-2.5 outline-none cursor-text transition-colors leading-relaxed resize-none"
                  />
                  <button
                    type="submit"
                    className="mt-1.5 text-xs px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Sauvegarder
                  </button>
                </form>
              </div>
            </div>

            {/* Emails */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h2 className="font-bold text-sm mb-3">Emails</h2>
              <div className="flex items-center gap-3 py-2 border-b border-gray-800">
                <span className="flex-1 text-xs text-gray-200 truncate">{client.email}</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-medium flex-shrink-0">
                  Principal
                </span>
              </div>
              <details className="mt-3 group">
                <summary className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer select-none list-none flex items-center gap-1 w-fit">
                  <span className="text-base leading-none">+</span> Ajouter une adresse
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="nouvelle@email.com"
                    className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
                  />
                  <button className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold transition-colors whitespace-nowrap">
                    Ajouter
                  </button>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ABONNEMENT                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'abonnement' && (
          <div className="space-y-4">
            {abonnement ? (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <h2 className="font-bold text-sm mb-3">
                  {abonnement.statut === 'actif' ? 'Abonnement actif' : 'Dernier abonnement'}
                </h2>
                <Row label="Statut" value={
                  abonnement.statut === 'actif'
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">
                        Actif{abonnement.annulation_en_cours ? ' · Annulation en cours' : ''}
                      </span>
                    : abonnement.statut === 'impaye'
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">Impayé</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700/60 text-gray-500 font-medium">Annulé</span>
                } />
                <Row label="Plan"   value={<span className="capitalize">{abonnement.plan}</span>} />
                <Row label={abonnement.statut === 'actif' ? 'Depuis' : 'Débuté'} value={fmtDate(abonnement.date_debut)} />
                {abonnement.en_essai && <Row label="Essai gratuit" value="Oui" />}
                {(abonnement.prix ?? 0) > 0 && (
                  <Row
                    label="Prix"
                    value={`${((abonnement.prix ?? 0) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €/mois`}
                  />
                )}
                <Row
                  label="Mois réglés"
                  value={moisRegles > 0
                    ? `${moisRegles} mois${!abonnement.mensualites_payees ? ' (approx.)' : ''}`
                    : '–'}
                />
                {abonnement.date_fin && abonnement.statut === 'actif' && (
                  <Row label="Prochain renouvellement" value={fmtDate(abonnement.date_fin)} />
                )}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center py-10">
                <p className="text-gray-600 text-sm">Pas d&apos;abonnement</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* COMMANDES                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'commandes' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {achats.length === 0 ? (
              <div className="py-10 text-center text-gray-600 text-sm">Aucune commande.</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beat</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Licence</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {achats.map((a, i) => {
                    const isBs  = a.plateforme_source === 'beatstars'
                    const titre = a.beats?.titre ?? (isBs ? 'Import BeatStars' : 'Beat supprimé')
                    return (
                      <tr
                        key={a.id}
                        className={`${i < achats.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/40 transition-colors`}
                      >
                        <td className="px-5 py-3 font-medium text-white">{titre}</td>
                        <td className="px-5 py-3 text-xs text-gray-400">
                          {a.type_commande === 'CREATION_ABONNEMENT'
                            ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 font-medium">Abonnement</span>
                            : isBs ? '–' : a.licences?.nom ?? 'Inconnue'}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                        <td className="px-5 py-3 text-right font-semibold text-white whitespace-nowrap">{fmt(a.prix_paye)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PRÉFÉRENCES                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'preferences' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h2 className="font-bold text-sm mb-3">Préférences musicales</h2>
            <Row label="Style"       value={topStyles[0]      ?? '–'} />
            <Row label="Type beat"   value={topTypeBeat[0]    ?? '–'} />
            <Row label="Ambiance"    value={topAmbiances[0]   ?? '–'} />
            <Row label="Instruments" value={topInstruments[0] ?? '–'} />
            <Row label="Licence"     value={topLicences[0]    ?? '–'} />

            {(topStyles.length > 1 || topTypeBeat.length > 1 || topAmbiances.length > 0 || topInstruments.length > 0) && (
              <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
                {topStyles.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Tous les styles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topStyles.map(s => (
                        <span key={s} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {topTypeBeat.length > 1 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Types beat</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topTypeBeat.map(t => (
                        <span key={t} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {topAmbiances.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Ambiances</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topAmbiances.map(a => (
                        <span key={a} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {topInstruments.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">Instruments</p>
                    <div className="flex flex-wrap gap-1.5">
                      {topInstruments.map(ins => (
                        <span key={ins} className="text-xs px-2 py-1 rounded-md bg-gray-800 text-gray-400">{ins}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* NEWSLETTER                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'newsletter' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-sm">Engagement newsletter</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                client.newsletter_consent ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {client.newsletter_consent ? 'Inscrit' : 'Non inscrit'}
              </span>
            </div>
            {client.newsletter_consent ? (
              <>
                <div className="h-1.5 rounded-full bg-gray-800 mb-5 overflow-hidden">
                  <div className="h-full rounded-full bg-gray-700 w-0" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Ouverture',  val: '–', sub: 'Non disponible' },
                    { label: 'Clics',      val: '–', sub: 'Non disponible' },
                    { label: 'Conversion', val: '–', sub: 'Non disponible' },
                    { label: 'Réponses',   val: '–', sub: 'Non disponible' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-800/60 rounded-xl p-3">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{m.label}</p>
                      <p className="text-sm font-bold text-white">{m.val}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{m.sub}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-4">
                  Les statistiques d&apos;engagement seront disponibles dans Analytics — Marketing.
                </p>
              </>
            ) : (
              <div className="py-6 text-center text-gray-600 text-sm">
                Ce contact n&apos;est pas inscrit à la newsletter.
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CATALOGUE / ACTIVITÉ                                              */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'catalogue' && (
          <div className="space-y-4">
            {/* Free downloads */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-bold text-sm">Free downloads</h2>
                <span className="text-xs text-gray-500">
                  {freeDLs.length} téléchargement{freeDLs.length > 1 ? 's' : ''}
                </span>
              </div>
              {freeDLs.length === 0 ? (
                <div className="py-8 text-center text-gray-600 text-xs">Aucun free download.</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {freeDLs.map((dl, i) => {
                    const beatAchete = licencesPayees.some(c => c.beat_id === dl.beat_id)
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                          <span className="text-sm text-white">{dl.beats?.titre ?? 'Beat supprimé'}</span>
                          {beatAchete && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                              Acheté ✓
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-4">
                          {fmtDateRel(dl.downloaded_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Favoris */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-bold text-sm">Favoris</h2>
                <span className="text-xs text-gray-500">
                  {favoris.length} beat{favoris.length > 1 ? 's' : ''}
                </span>
              </div>
              {favoris.length === 0 ? (
                <div className="py-8 text-center text-gray-600 text-xs">Aucun favori.</div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {favoris.map((fav, i) => {
                    const beatAchete = licencesPayees.some(c => c.beat_id === fav.beat_id)
                    return (
                      <div key={i} className="flex items-center justify-between px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 flex-shrink-0" />
                          <span className="text-sm text-white">{fav.beats?.titre ?? 'Beat supprimé'}</span>
                          {beatAchete && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium">
                              Acheté ✓
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MORCEAUX                                                          */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {onglet === 'morceaux' && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
              <h2 className="font-bold text-sm">Morceaux publiés</h2>
              <span className="text-xs text-gray-500">
                {morceaux.length} morceau{morceaux.length > 1 ? 'x' : ''}
              </span>
            </div>

            {morceaux.length === 0 ? (
              <div className="py-10 text-center text-gray-600 text-sm">Aucun morceau ajouté.</div>
            ) : (
              <div className="divide-y divide-gray-800">
                {morceaux.map(m => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-400 text-xs">♪</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{m.titre}</p>
                        <p className="text-xs text-gray-600">{fmtDate(m.created_at)}</p>
                      </div>
                    </div>
                    {m.lien_spotify && (
                      <a
                        href={m.lien_spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors flex-shrink-0 ml-4"
                      >
                        Spotify →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Formulaire accordéon "Ajouter" */}
            <div className="px-5 py-4 border-t border-gray-800">
              <details className="group">
                <summary className="text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer select-none list-none flex items-center gap-1 w-fit">
                  <span className="text-base leading-none">+</span> Ajouter un morceau
                </summary>
                <form action={ajouterMorceau} className="mt-3 flex items-center gap-2">
                  <input
                    name="titre"
                    type="text"
                    required
                    placeholder="Titre du morceau"
                    className="flex-1 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
                  />
                  <input
                    name="lien"
                    type="url"
                    placeholder="Lien Spotify"
                    className="flex-1 bg-gray-800 border border-gray-700 focus:border-green-500 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors whitespace-nowrap"
                  >
                    Ajouter
                  </button>
                </form>
              </details>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
