import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import ContactsClient, { ContactRow } from './_components/ContactsClient'
import type { LeadRow } from './_components/LeadsView'
import type { NewsletterRow } from './_components/NewsletterView'

function topPreference(vals: string[]): string | null {
  if (vals.length === 0) return null
  const counts: Record<string, number> = {}
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>
}) {
  const { vue = '' } = await searchParams

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

  // ── 0. Fusions — nécessaire pour filtrer les archivés dans leads ──────────
  const { data: fusionsEarly } = await supabase
    .from('fusions_crm')
    .select('client_id_conserve, client_id_archive, champs_conserves')
    .eq('beatmaker_id', beatmakerId)

  const archiveIds = new Set((fusionsEarly ?? []).map(f => f.client_id_archive))
  const conserveToArchives = new Map<string, string[]>()
  const champsOverrideMap = new Map<string, Record<string, string>>()
  for (const f of fusionsEarly ?? []) {
    const arr = conserveToArchives.get(f.client_id_conserve) ?? []
    arr.push(f.client_id_archive)
    conserveToArchives.set(f.client_id_conserve, arr)
    const existing = champsOverrideMap.get(f.client_id_conserve) ?? {}
    champsOverrideMap.set(f.client_id_conserve, { ...existing, ...((f.champs_conserves as Record<string, string>) ?? {}) })
  }

  // ── 1. Leads — fetch indépendant AVANT le return anticipé ─────────────────
  // Utilise supabase (client authentifié) car leads n'a pas GRANT service_role
  const leadsRes = await supabase
    .from('leads')
    .select('client_id, source, created_at, newsletter_inscrit')
    .eq('beatmaker_id', beatmakerId)

  const leadsRaw      = leadsRes.data ?? []
  const leadClientIds = leadsRaw.map(l => l.client_id)

  type LeadClient = { id: string; prenom: string | null; nom: string; pays: string | null; newsletter_consent: boolean | null }
  type FavBeat    = { styles: string[] | null; type_beat: string[] | null; ambiances: string[] | null }

  let leadClientMap    = new Map<string, LeadClient>()
  let favorisBeatMap   = new Map<string, FavBeat[]>()
  let freeDLCountMap   = new Map<string, number>()
  let leadDerniereMap  = new Map<string, { at: string; type: string }>()

  if (leadClientIds.length > 0) {
    const [leadClientsRes, leadFavorisRes, freeDLsRes] = await Promise.all([
      admin.from('clients')
        .select('id, prenom, nom, pays, newsletter_consent')
        .in('id', leadClientIds),
      admin.from('favoris')
        .select('client_id, created_at, beats(styles, type_beat, ambiances)')
        .in('client_id', leadClientIds),
      admin.from('free_downloads')
        .select('client_id, downloaded_at')
        .eq('beatmaker_id', beatmakerId)
        .in('client_id', leadClientIds),
    ])
    for (const c of leadClientsRes.data ?? []) leadClientMap.set(c.id, c as LeadClient)

    const leadFavDatesMap = new Map<string, Date[]>()
    for (const fav of leadFavorisRes.data ?? []) {
      const arr = favorisBeatMap.get(fav.client_id) ?? []
      arr.push(fav.beats as unknown as FavBeat)
      favorisBeatMap.set(fav.client_id, arr)
      const dates = leadFavDatesMap.get(fav.client_id) ?? []
      dates.push(new Date(fav.created_at))
      leadFavDatesMap.set(fav.client_id, dates)
    }

    const leadDLDatesMap = new Map<string, Date[]>()
    for (const dl of freeDLsRes.data ?? []) {
      freeDLCountMap.set(dl.client_id, (freeDLCountMap.get(dl.client_id) ?? 0) + 1)
      const dates = leadDLDatesMap.get(dl.client_id) ?? []
      dates.push(new Date(dl.downloaded_at))
      leadDLDatesMap.set(dl.client_id, dates)
    }

    for (const l of leadsRaw) {
      const evts: { date: Date; type: string }[] = []
      const src = l.source === 'free_download' ? 'Free DL'
        : l.source === 'newsletter' ? 'Inscription NWT'
        : l.source === 'visite'     ? 'Visite'
        : 'Inscription'
      evts.push({ date: new Date(l.created_at), type: src })
      for (const d of leadFavDatesMap.get(l.client_id) ?? []) evts.push({ date: d, type: 'Favori' })
      for (const d of leadDLDatesMap.get(l.client_id) ?? [])  evts.push({ date: d, type: 'Free DL' })
      evts.sort((a, b) => b.date.getTime() - a.date.getTime())
      leadDerniereMap.set(l.client_id, { at: evts[0].date.toISOString(), type: evts[0].type })
    }
  }

  // ── 2. Commandes + abos + listes ─────────────────────────────────────────
  const [commandesRes, aboRes, listesRes] = await Promise.all([
    supabase
      .from('commandes')
      .select('client_id, created_at, prix_paye, statut, type_commande, commande_lignes(beat_id, licence_id)')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut, mensualites_payees, annulation_en_cours, created_at, date_fin')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase
      .from('listes_crm')
      .select('id, nom, listes_crm_contacts(count)')
      .eq('beatmaker_id', beatmakerId)
      .order('nom'),
  ])

  const commandes = commandesRes.data ?? []
  const abos      = aboRes.data      ?? []
  const listesRaw = listesRes.data   ?? []

  // Un lead qui a depuis passé commande ou pris un abonnement (même annulé)
  // n'est plus un lead — l'onglet Leads doit être strictement réservé aux
  // contacts qui n'ont jamais rien acheté (bug remonté par Jake, 2026-07-16).
  const clientsAvecCommandeOuAbo = new Set([
    ...commandes.map(c => c.client_id as string),
    ...abos.map(a => a.client_id as string),
  ])

  const leadsData: LeadRow[] = leadsRaw
    .filter(l => !archiveIds.has(l.client_id) && !clientsAvecCommandeOuAbo.has(l.client_id))
    .flatMap(l => {
    const client  = leadClientMap.get(l.client_id)
    if (!client) return []
    const beats   = favorisBeatMap.get(l.client_id) ?? []
    const derniere = leadDerniereMap.get(l.client_id) ?? { at: l.created_at, type: 'Inscription' }
    const stylesA = beats.flatMap(b => b?.styles    ?? [])
    const typeA   = beats.flatMap(b => b?.type_beat  ?? [])
    const ambA    = beats.flatMap(b => b?.ambiances  ?? [])
    return [{
      id:                   l.client_id,
      prenom:               client.prenom,
      nom:                  client.nom,
      pays:                 client.pays,
      newsletter_consent:   (client.newsletter_consent ?? false) || (l.newsletter_inscrit ?? false),
      source:               (l.source as string) ?? 'visite',
      lead_created_at:      l.created_at,
      derniere_action_at:   derniere.at,
      derniere_action_type: derniere.type,
      nb_favoris:           beats.length,
      nb_free_downloads:    freeDLCountMap.get(l.client_id) ?? 0,
      pref_style:           topPreference(stylesA),
      pref_type_beat:       topPreference(typeA),
      pref_ambiance:        topPreference(ambA),
    }]
  })

  const listes = (listesRaw ?? []).map(l => ({
    id:  l.id,
    nom: l.nom,
    nb:  ((l.listes_crm_contacts ?? []) as { count: number }[])[0]?.count ?? 0,
  }))

  // Client IDs (pour onglet Tous/Clients)
  const clientIds = [...new Set([
    ...commandes.map(c => c.client_id as string),
    ...abos.map(a => a.client_id as string),
    ...leadsRaw.map(l => l.client_id),
  ])]

  if (clientIds.length === 0) {
    return <ContactsClient contacts={[]} listes={listes} leadsData={leadsData} newsletterData={[]} vue={vue} />
  }

  // Beat IDs & Licence IDs from LICENCE commandes (via commande_lignes — voir phase2c_panier.sql)
  const licenceCmdsAll = commandes.filter(c => c.type_commande === 'LICENCE')
  const lignesAll  = licenceCmdsAll.flatMap(c => c.commande_lignes ?? [])
  const beatIds    = [...new Set(lignesAll.map(l => l.beat_id).filter(Boolean) as string[])]
  const licenceIds = [...new Set(lignesAll.map(l => l.licence_id).filter(Boolean) as string[])]

  const [clientsRes, licencesRes, favorisClientsRes, freeDLsClientsRes, envoisNewsletterRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, prenom, surnom, nom, nom_artiste, email, pays, telephone, created_at, instagram, spotify, youtube, tiktok, newsletter_consent')
      .in('id', clientIds),
    licenceIds.length > 0
      ? supabase.from('licences').select('id, modele').in('id', licenceIds)
      : Promise.resolve({ data: [] as { id: string; modele: string }[] }),
    admin.from('favoris')
      .select('client_id, beat_id, created_at')
      .in('client_id', clientIds),
    admin.from('free_downloads')
      .select('client_id, beat_id, downloaded_at')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', clientIds),
    // RLS : visible seulement pour les campagnes de ce beatmaker — inclut les archivés (fusion)
    // pour rattacher l'historique newsletter d'avant-fusion au contact conservé
    supabase
      .from('campagne_envois')
      .select('client_id, envoye_at, ouvert_at, clique_at, converti_at')
      .in('client_id', [...clientIds, ...archiveIds]),
  ])

  const clientsRaw = clientsRes.data ?? []
  const licenceMap = new Map((licencesRes.data ?? []).map(l => [l.id, l]))

  // Beats du catalogue nécessaires aux préférences pondérées — achats +
  // favoris + free downloads, pas seulement les achats (voir plus bas).
  const beatIdsFavoris = [...new Set((favorisClientsRes.data ?? []).map(f => f.beat_id).filter(Boolean) as string[])]
  const beatIdsFreeDL  = [...new Set((freeDLsClientsRes.data ?? []).map(d => d.beat_id).filter(Boolean) as string[])]
  const beatIdsPourPrefs = [...new Set([...beatIds, ...beatIdsFavoris, ...beatIdsFreeDL])]
  const { data: beatsData } = beatIdsPourPrefs.length > 0
    ? await supabase.from('beats').select('id, styles, type_beat, ambiances').in('id', beatIdsPourPrefs)
    : { data: [] as { id: string; styles: string[] | null; type_beat: string[] | null; ambiances: string[] | null }[] }
  const beatMap = new Map((beatsData ?? []).map(b => [b.id, b]))

  type EnvoiNwt = { client_id: string; envoye_at: string; ouvert_at: string | null; clique_at: string | null; converti_at: string | null }
  const envoisParClient = new Map<string, EnvoiNwt[]>()
  for (const e of (envoisNewsletterRes.data ?? []) as EnvoiNwt[]) {
    const arr = envoisParClient.get(e.client_id) ?? []
    arr.push(e)
    envoisParClient.set(e.client_id, arr)
  }

  const commandesParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const id = cmd.client_id as string
    const arr = commandesParClient.get(id) ?? []
    arr.push(cmd)
    commandesParClient.set(id, arr)
  }

  const aboParClient = new Map<string, (typeof abos)[0]>()
  for (const abo of abos) {
    const id = abo.client_id as string
    const existing = aboParClient.get(id)
    if (!existing || new Date(abo.date_fin ?? abo.created_at) > new Date(existing.date_fin ?? existing.created_at)) {
      aboParClient.set(id, abo)
    }
  }

  const leadParClient = new Map<string, (typeof leadsRaw)[0]>()
  for (const lead of leadsRaw) leadParClient.set(lead.client_id, lead)

  // Map d'événements extra (favoris + free_downloads) par client
  type ExtraEvent = { date: Date; type: string }
  const extraEventsParClient = new Map<string, ExtraEvent[]>()
  const favorisBeatIdsParClient = new Map<string, string[]>()
  const freeDLBeatIdsParClient  = new Map<string, string[]>()
  for (const fav of favorisClientsRes.data ?? []) {
    const arr = extraEventsParClient.get(fav.client_id) ?? []
    arr.push({ date: new Date(fav.created_at), type: 'Favori' })
    extraEventsParClient.set(fav.client_id, arr)
    if (fav.beat_id) favorisBeatIdsParClient.set(fav.client_id, [...(favorisBeatIdsParClient.get(fav.client_id) ?? []), fav.beat_id])
  }
  for (const dl of freeDLsClientsRes.data ?? []) {
    const arr = extraEventsParClient.get(dl.client_id) ?? []
    arr.push({ date: new Date(dl.downloaded_at), type: 'Free DL' })
    extraEventsParClient.set(dl.client_id, arr)
    if (dl.beat_id) freeDLBeatIdsParClient.set(dl.client_id, [...(freeDLBeatIdsParClient.get(dl.client_id) ?? []), dl.beat_id])
  }

  function leadSourceLabel(source: string | null): string {
    if (source === 'free_download') return 'Free DL'
    if (source === 'newsletter')   return 'Inscription NWT'
    if (source === 'visite')       return 'Visite'
    if (source === 'manuel')       return 'Ajout manuel'
    return 'Inscription'
  }

  const contacts: ContactRow[] = clientsRaw
  .filter(c => !archiveIds.has(c.id))
  .map(c => {
    // Fusionner les commandes des contacts archivés si ce contact est un conservé
    const cmdsBase = commandesParClient.get(c.id) ?? []
    const cmdsArchives = (conserveToArchives.get(c.id) ?? []).flatMap(aid => commandesParClient.get(aid) ?? [])
    const cmds     = [...cmdsBase, ...cmdsArchives]
    const abo      = aboParClient.get(c.id)
    const lead     = leadParClient.get(c.id)

    const licenceCmds = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
    const nbAchats    = licenceCmds.length

    let statut: ContactRow['statut']
    let statutAboDetail: ContactRow['statut_abo_detail'] = null
    if (abo && (abo.statut === 'actif' || abo.statut === 'impaye')) {
      statut = 'abonne'
      statutAboDetail = abo.annulation_en_cours ? 'annulation_en_cours' : abo.statut as 'actif' | 'impaye'
    } else if (abo && abo.statut === 'annule') {
      statut = 'ancien'
      statutAboDetail = 'ancien'
    } else if (nbAchats > 0) {
      statut = 'client'
    } else {
      statut = 'lead'
    }

    // Tous les événements triés chronologiquement
    const events: ExtraEvent[] = []
    if (lead) events.push({ date: new Date(lead.created_at), type: leadSourceLabel(lead.source) })
    if (abo)  events.push({ date: new Date(abo.created_at),  type: 'Abonnement' })
    for (const cmd of licenceCmds) events.push({ date: new Date(cmd.created_at), type: 'Commande' })
    for (const ev of extraEventsParClient.get(c.id) ?? []) events.push(ev)
    events.sort((a, b) => a.date.getTime() - b.date.getTime())

    const premierContactISO  = events.length ? events[0].date.toISOString() : c.created_at
    const type1ereAction     = events[0]?.type ?? 'Inscription'
    const dernierContactISO  = events.length ? events[events.length - 1].date.toISOString() : c.created_at
    const typeDerniereAction = events[events.length - 1]?.type ?? 'Inscription'

    const ltv = cmds.filter(cmd => cmd.statut === 'payee').reduce((sum, cmd) => sum + (cmd.prix_paye ?? 0), 0)
    const dernier_achat_iso = licenceCmds.length
      ? new Date(Math.max(...licenceCmds.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
      : null
    const licenceLtv   = licenceCmds.reduce((sum, cmd) => sum + (cmd.prix_paye ?? 0), 0)
    const panier_moyen = nbAchats > 0 ? Math.round(licenceLtv / nbAchats) : null

    const stylesArr: string[] = []
    const typeBeatArr: string[] = []
    const ambiancesArr: string[] = []
    const licenceArr: string[] = []
    // Pondéré par signal — achat ×10, free download ×2, favori ×1 (décision
    // Jake, 2026-07-16) : un achat engage vraiment, un free download est une
    // simple curiosité qui ne débouche pas forcément sur un achat.
    function ajouterPref(beatId: string | null, poids: number) {
      const beat = beatId ? beatMap.get(beatId) : null
      if (!beat) return
      for (let i = 0; i < poids; i++) {
        if (beat.styles)    stylesArr.push(...beat.styles)
        if (beat.type_beat) typeBeatArr.push(...beat.type_beat)
        if ((beat as any).ambiances) ambiancesArr.push(...(beat as any).ambiances)
      }
    }
    for (const cmd of licenceCmds) {
      for (const ligne of cmd.commande_lignes ?? []) {
        ajouterPref(ligne.beat_id, 10)
        const lic = ligne.licence_id ? licenceMap.get(ligne.licence_id) : null
        if (lic?.modele) licenceArr.push(lic.modele)
      }
    }
    for (const beatId of freeDLBeatIdsParClient.get(c.id)  ?? []) ajouterPref(beatId, 2)
    for (const beatId of favorisBeatIdsParClient.get(c.id) ?? []) ajouterPref(beatId, 1)

    const override = champsOverrideMap.get(c.id) ?? {}
    return {
      id:                 c.id,
      prenom:             (c as Record<string, unknown>).surnom as string | null ?? c.prenom,
      nom:                c.nom,
      nom_artiste:        (override.nom_artiste ?? c.nom_artiste) as string | null,
      email:              c.email,
      pays:               (override.pays        ?? c.pays)        as string | null,
      telephone:          (override.telephone   ?? c.telephone)   as string | null,
      instagram:          (override.instagram   ?? c.instagram)   as string | null,
      spotify:            (override.spotify     ?? c.spotify)     as string | null,
      youtube:            (override.youtube     ?? c.youtube)     as string | null,
      tiktok:             (override.tiktok      ?? c.tiktok)      as string | null,
      newsletter_consent: (c.newsletter_consent ?? false) || (lead?.newsletter_inscrit ?? false),
      statut,
      statut_abo_detail:  statutAboDetail,
      nb_achats:          nbAchats,
      mensualites_payees: abo?.mensualites_payees ?? 0,
      premierContactISO,
      dernierContactISO,
      type1ereAction,
      typeDerniereAction,
      ltv,
      dernier_achat_iso,
      panier_moyen,
      pref_style:     topPreference(stylesArr),
      pref_type_beat: topPreference(typeBeatArr),
      pref_ambiance:  topPreference(ambiancesArr),
      pref_licence:   topPreference(licenceArr),
    }
  })

  // ── Newsletter — historique conservé même après désinscription ────────────
  const newsletterData: NewsletterRow[] = contacts.flatMap(c => {
    const lead = leadParClient.get(c.id)
    const envois = [
      ...(envoisParClient.get(c.id) ?? []),
      ...(conserveToArchives.get(c.id) ?? []).flatMap(aid => envoisParClient.get(aid) ?? []),
    ]
    const inscriptionISO = lead?.source === 'newsletter' ? lead.created_at : null

    if (!c.newsletter_consent && envois.length === 0 && !inscriptionISO) return []

    const envoyes     = envois.length
    const ouverts     = envois.filter(e => e.ouvert_at).length
    const clics       = envois.filter(e => e.clique_at).length
    const conversions = envois.filter(e => e.converti_at).length

    const premiers: { at: string; type: string }[] = []
    if (inscriptionISO) premiers.push({ at: inscriptionISO, type: 'Inscription' })
    for (const e of envois) premiers.push({ at: e.envoye_at, type: 'Envoyée' })
    premiers.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
    const premier = premiers[0] ?? { at: c.premierContactISO, type: 'Inscription' }

    const derniers: { at: string; type: string }[] = []
    if (inscriptionISO) derniers.push({ at: inscriptionISO, type: 'Inscription' })
    for (const e of envois) {
      derniers.push({ at: e.envoye_at, type: 'Envoyée' })
      if (e.ouvert_at)   derniers.push({ at: e.ouvert_at,   type: 'Ouverture' })
      if (e.clique_at)   derniers.push({ at: e.clique_at,   type: 'Clic' })
      if (e.converti_at) derniers.push({ at: e.converti_at, type: 'Conversion' })
    }
    derniers.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    const dernier = derniers[0] ?? premier

    return [{
      id:                 c.id,
      prenom:             c.prenom,
      nom:                c.nom,
      nom_artiste:        c.nom_artiste,
      pays:               c.pays,
      newsletter_consent: c.newsletter_consent,
      premier_nwt_iso:    premier.at,
      premier_nwt_type:   premier.type,
      dernier_nwt_iso:    dernier.at,
      dernier_nwt_type:   dernier.type,
      envoyes, ouverts, clics, conversions,
    }]
  })

  return <ContactsClient contacts={contacts} listes={listes} leadsData={leadsData} newsletterData={newsletterData} vue={vue} />
}
