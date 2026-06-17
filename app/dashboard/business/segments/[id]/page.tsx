import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { evaluerFiltres, couleurCls, type Condition } from '../../_lib/segments'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function topPreference(vals: string[]): string | null {
  if (!vals.length) return null
  const counts: Record<string, number> = {}
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

type SegmentContact = {
  id: string
  prenom: string | null
  nom: string
  email: string
  pays: string | null
  newsletter_consent: boolean
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  ltv: number
  dernier_achat_iso: string | null
  pref_style: string | null
  pref_type_beat: string | null
}

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: segmentId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  // Charger le segment
  const { data: segment } = await supabase
    .from('segments_crm')
    .select('id, nom, description, couleur, filtres')
    .eq('id', segmentId)
    .eq('beatmaker_id', beatmakerId)
    .single()

  if (!segment) notFound()

  const filtres = segment.filtres as Condition[]

  // Fusions
  const { data: fusions } = await supabase
    .from('fusions_crm')
    .select('client_id_conserve, client_id_archive')
    .eq('beatmaker_id', beatmakerId)

  const archiveIds       = new Set((fusions ?? []).map(f => f.client_id_archive))
  const conserveArchives = new Map<string, string[]>()
  for (const f of fusions ?? []) {
    const arr = conserveArchives.get(f.client_id_conserve) ?? []
    arr.push(f.client_id_archive)
    conserveArchives.set(f.client_id_conserve, arr)
  }

  // Leads
  const { data: leadsRaw } = await supabase
    .from('leads')
    .select('client_id, source, newsletter_inscrit')
    .eq('beatmaker_id', beatmakerId)

  const leadMap = new Map((leadsRaw ?? []).map(l => [l.client_id, l]))

  // Commandes + abos + clients
  const [commandesRes, aboRes] = await Promise.all([
    supabase
      .from('commandes')
      .select('client_id, beat_id, licence_id, created_at, prix_paye, statut, type_commande')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut, mensualites_payees, annulation_en_cours, created_at, date_fin')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
  ])

  const commandes = commandesRes.data ?? []
  const abos      = aboRes.data      ?? []

  const clientIds = [...new Set([
    ...commandes.map(c => c.client_id as string),
    ...abos.map(a => a.client_id as string),
    ...(leadsRaw ?? []).map(l => l.client_id),
  ])]

  if (clientIds.length === 0) {
    return <EmptyState segment={segment} />
  }

  // Beats pour préférences
  const licenceBeatIds = [...new Set(
    commandes.filter(c => c.type_commande === 'LICENCE' && c.beat_id).map(c => c.beat_id as string)
  )]

  const [clientsRes, beatsRes] = await Promise.all([
    admin.from('clients')
      .select('id, prenom, surnom, nom, email, pays, langue, newsletter_consent, instagram, spotify, youtube, tiktok, tags')
      .in('id', clientIds),
    licenceBeatIds.length
      ? supabase.from('beats').select('id, styles, type_beat').in('id', licenceBeatIds)
      : Promise.resolve({ data: [] as { id: string; styles: string[] | null; type_beat: string[] | null }[] }),
  ])

  const beatMap = new Map((beatsRes.data ?? []).map(b => [b.id, b]))

  // Maps commandes + abos
  const commandesParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const id  = cmd.client_id as string
    const arr = commandesParClient.get(id) ?? []
    arr.push(cmd)
    commandesParClient.set(id, arr)
  }

  const aboParClient = new Map<string, (typeof abos)[0]>()
  for (const abo of abos) {
    const id = abo.client_id as string
    const ex = aboParClient.get(id)
    if (!ex || new Date(abo.date_fin ?? abo.created_at) > new Date(ex.date_fin ?? ex.created_at)) {
      aboParClient.set(id, abo)
    }
  }

  // Construire contacts enrichis + filtrer
  const contacts: SegmentContact[] = (clientsRes.data ?? [])
    .filter(c => !archiveIds.has(c.id))
    .flatMap(c => {
      const cmdsBase     = commandesParClient.get(c.id) ?? []
      const cmdsArchives = (conserveArchives.get(c.id) ?? []).flatMap(aid => commandesParClient.get(aid) ?? [])
      const cmds         = [...cmdsBase, ...cmdsArchives]
      const abo          = aboParClient.get(c.id)
      const lead         = leadMap.get(c.id)

      const licenceCmds = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
      const nbAchats    = licenceCmds.length
      const payees      = cmds.filter(cmd => cmd.statut === 'payee')
      const ltv         = payees.reduce((s, cmd) => s + (cmd.prix_paye ?? 0), 0)
      const licenceLtv  = licenceCmds.filter(c => c.statut === 'payee').reduce((s, cmd) => s + (cmd.prix_paye ?? 0), 0)
      const panierMoyen = nbAchats > 0 ? Math.round(licenceLtv / nbAchats) : null
      const dernierAchat = licenceCmds.length
        ? new Date(Math.max(...licenceCmds.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
        : null
      const premierContact = cmds.length
        ? new Date(Math.min(...cmds.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
        : new Date().toISOString()

      let statut: SegmentContact['statut']
      if (abo && (abo.statut === 'actif' || abo.statut === 'impaye')) statut = 'abonne'
      else if (abo && abo.statut === 'annule') statut = 'ancien'
      else if (nbAchats > 0) statut = 'client'
      else statut = 'lead'

      const langueEffective: 'FR' | 'EN' = ((c as Record<string, unknown>).langue as 'FR' | 'EN' | null)
        ?? (PAYS_FR.has((c.pays ?? '').toUpperCase()) ? 'FR' : 'EN')

      const stylesArr: string[] = []
      const typeBeatArr: string[] = []
      for (const cmd of licenceCmds) {
        const beat = cmd.beat_id ? beatMap.get(cmd.beat_id) : null
        if (beat?.styles)    stylesArr.push(...beat.styles)
        if (beat?.type_beat) typeBeatArr.push(...beat.type_beat)
      }

      const contactFiltre = {
        statut,
        ltv,
        nb_achats:          nbAchats,
        panier_moyen:       panierMoyen,
        mensualites_payees: abo?.mensualites_payees ?? 0,
        dernier_achat_iso:  dernierAchat,
        premierContactISO:  premierContact,
        newsletter_consent: (c.newsletter_consent ?? false) || (lead?.newsletter_inscrit ?? false),
        langue:             langueEffective,
        pays:               c.pays ?? null,
        instagram:          c.instagram ?? null,
        spotify:            c.spotify   ?? null,
        youtube:            c.youtube   ?? null,
        tiktok:             c.tiktok    ?? null,
        pref_style:         topPreference(stylesArr),
        pref_type_beat:     topPreference(typeBeatArr),
        pref_ambiance:      null,
        pref_licence:       null,
        tags:               ((c as Record<string, unknown>).tags as string[]) ?? [],
        source:             lead?.source ?? null,
      }

      if (!evaluerFiltres(contactFiltre, filtres)) return []

      const surnom = (c as Record<string, unknown>).surnom as string | null
      return [{
        id:                 c.id,
        prenom:             surnom ?? c.prenom,
        nom:                c.nom,
        email:              c.email,
        pays:               c.pays,
        newsletter_consent: contactFiltre.newsletter_consent,
        statut,
        ltv,
        dernier_achat_iso: dernierAchat,
        pref_style:        topPreference(stylesArr),
        pref_type_beat:    topPreference(typeBeatArr),
      }]
    })
    .sort((a, b) => b.ltv - a.ltv)

  const fmt        = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
  const fmtDateRel = (iso: string | null) => {
    if (!iso) return '–'
    const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (j === 0) return "Aujourd'hui"
    if (j < 7)   return `Il y a ${j}j`
    if (j < 30)  return `Il y a ${Math.floor(j / 7)} sem`
    if (j < 365) return `Il y a ${Math.floor(j / 30)} mois`
    return `Il y a ${Math.floor(j / 365)} an${Math.floor(j / 365) > 1 ? 's' : ''}`
  }

  const badgeCls = couleurCls(segment.couleur)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Link href="/dashboard/business/segments" className="hover:text-white transition-colors">
            Segments
          </Link>
          <span className="text-gray-700">›</span>
          <span className="text-white">{segment.nom}</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-white">{segment.nom}</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {segment.description && <span>{segment.description} · </span>}
              <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border font-medium ${badgeCls}`}>
                {contacts.length} contact{contacts.length > 1 ? 's' : ''}
              </span>
            </p>
          </div>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600/40 rounded-xl text-sm font-semibold text-indigo-400 cursor-not-allowed opacity-60"
            title="Disponible dans le sprint Marketing"
          >
            ✉ Lancer une campagne
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-600 text-sm">
            Aucun contact ne correspond à ce segment pour l&apos;instant.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-10">NWT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Style</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier achat</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">LTV</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr
                  key={c.id}
                  className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors ${i % 2 !== 0 ? 'bg-gray-950/40' : ''}`}
                >
                  {/* NWT */}
                  <td className="px-4 py-3 text-center">
                    {c.newsletter_consent
                      ? <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                      : <span className="text-gray-700 text-xs">–</span>}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/business/contacts/${c.id}`} className="flex items-center gap-3 group">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                        {c.pays ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-indigo-300 font-bold text-xs">
                            {[c.prenom?.[0], c.nom?.[0]].filter(Boolean).join('').toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors text-xs block">
                          {[c.prenom, c.nom].filter(Boolean).join(' ') || '–'}
                        </span>
                        <span className="text-xs text-gray-500">{c.email}</span>
                      </div>
                    </Link>
                  </td>

                  {/* Statut */}
                  <td className="px-4 py-3">
                    {c.statut === 'abonne' && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">Abonné</span>}
                    {c.statut === 'ancien' && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">Ancien</span>}
                    {c.statut === 'client' && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400">Client</span>}
                    {c.statut === 'lead'   && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">Lead</span>}
                  </td>

                  {/* Style */}
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {[c.pref_style, c.pref_type_beat].filter(Boolean).join(' · ') || <span className="text-gray-700">–</span>}
                  </td>

                  {/* Dernier achat */}
                  <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                    {fmtDateRel(c.dernier_achat_iso)}
                  </td>

                  {/* LTV */}
                  <td className="px-4 py-3 text-right font-semibold text-white text-xs whitespace-nowrap">
                    {fmt(c.ltv)}
                  </td>

                  {/* Lien fiche */}
                  <td className="px-3 py-3 text-center">
                    <Link href={`/dashboard/business/contacts/${c.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function EmptyState({ segment }: { segment: { nom: string; couleur: string; description: string | null } }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          <Link href="/dashboard/business/segments" className="hover:text-white transition-colors">Segments</Link>
          <span className="text-gray-700">›</span>
          <span className="text-white">{segment.nom}</span>
        </div>
        <h1 className="text-base font-bold text-white">{segment.nom}</h1>
      </div>
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
        Aucun contact pour l&apos;instant.
      </div>
    </div>
  )
}
