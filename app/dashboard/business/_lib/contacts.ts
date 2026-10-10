import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  computeScoreRF, computeScoreChaleur,
  type ContactFiltre, type CatalogOptions,
} from './segments'
import { totalDepense, panierMoyenLicences, nbAchatsPayants, datePlusRecente, datePlusAncienne } from '@/app/dashboard/business/_lib/ltv'
import { statutFusionne } from '@/lib/newsletter'
import { toutesLesLignes, parLots } from './requetes'
import { chargerCommandesExternesCrm } from './commandes-externes'

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

function topPref(vals: string[]): string | null {
  if (!vals.length) return null
  const counts: Record<string, number> = {}
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr)].sort()
}

export type ContactEnrichi = ContactFiltre & {
  id: string
  email: string
  nom: string
  prenom: string | null
  surnom: string | null
  nom_artiste: string | null
}

// Nom d'usage pour s'adresser au client (mêmes priorités que la fiche client CRM)
export function nomAffichage(c: Pick<ContactEnrichi, 'surnom' | 'nom_artiste' | 'prenom'>): string {
  return c.surnom ?? c.nom_artiste ?? c.prenom ?? ''
}

// Charge tous les contacts d'un beatmaker (commandes + abos + leads), enrichis
// avec scores/préférences pour les Segments, et identité pour l'affichage/l'envoi.
// Partagé par : Segments (liste + détail) et lib/mailing.ts (ciblage campagnes).
export async function chargerContactsEnrichis(beatmakerId: string): Promise<{
  contacts: ContactEnrichi[]
  catalog: CatalogOptions
}> {
  const supabase = await createClient()
  const admin    = createAdminClient()

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
  const leadsRaw = await toutesLesLignes<{ client_id: string; source: string; newsletter_statut: string; newsletter_statut_at: string | null }>((debut, fin) => supabase
    .from('leads')
    .select('client_id, source, newsletter_statut, newsletter_statut_at')
    .eq('beatmaker_id', beatmakerId)
    .order('id')
    .range(debut, fin))

  const leadMap = new Map((leadsRaw ?? []).map(l => [l.client_id, l]))

  // Commandes + abos + beats catalogue + licences catalogue en parallèle
  type CommandeCrm = {
    client_id: string | null; created_at: string | null; prix_paye: number | string | null; statut: string
    montant_rembourse_cents: number | null; type_commande: string
    commande_lignes: { beat_id: string | null; licence_id: string | null }[] | null
  }
  const [commandesNatives, commandesExternes, aboRes, beatsAllRes, licencesAllRes] = await Promise.all([
    toutesLesLignes<CommandeCrm>((debut, fin) => supabase
      .from('commandes')
      .select('client_id, created_at, prix_paye, statut, montant_rembourse_cents, type_commande, commande_lignes(beat_id, licence_id)')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null)
      .order('id')
      .range(debut, fin)),
    chargerCommandesExternesCrm(supabase, beatmakerId),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut, mensualites_payees, annulation_en_cours, created_at, date_fin')
      .eq('beatmaker_id', beatmakerId)
      .not('client_id', 'is', null),
    supabase
      .from('beats')
      .select('id, styles, type_beat, ambiances, instruments')
      .eq('beatmaker_id', beatmakerId),
    supabase
      .from('licences')
      .select('modele')
      .eq('beatmaker_id', beatmakerId),
  ])

  const commandes: CommandeCrm[] = [...commandesNatives, ...commandesExternes]
  const abos        = aboRes.data       ?? []
  const beatsAll    = beatsAllRes.data  ?? []
  const licencesAll = licencesAllRes.data ?? []

  const catalog: CatalogOptions = {
    styles:      uniq(beatsAll.flatMap(b => b.styles      ?? [])),
    typeBeat:    uniq(beatsAll.flatMap(b => b.type_beat   ?? [])),
    ambiances:   uniq(beatsAll.flatMap(b => b.ambiances   ?? [])),
    instruments: uniq(beatsAll.flatMap(b => b.instruments ?? [])),
    licences:    uniq(licencesAll.map(l => l.modele).filter(Boolean)),
  }

  const beatMap = new Map(beatsAll.map(b => [b.id, b]))

  const licenceIds = [...new Set(
    commandes.flatMap(c => (c.commande_lignes ?? []).map(l => l.licence_id)).filter((id): id is string => !!id)
  )]

  const licencesRes = licenceIds.length
    ? await supabase.from('licences').select('id, modele').in('id', licenceIds)
    : { data: [] as { id: string; modele: string }[] }
  const licenceMap = new Map((licencesRes.data ?? []).map(l => [l.id, l]))

  const clientIds = [...new Set([
    ...commandes.map(c => c.client_id as string),
    ...abos.map(a => a.client_id as string),
    ...(leadsRaw ?? []).map(l => l.client_id),
  ])]

  if (clientIds.length === 0) return { contacts: [], catalog }

  // Clients + favoris + free_downloads en parallèle
  type ClientCrm = {
    id: string; prenom: string | null; surnom: string | null; nom: string; nom_artiste: string | null; email: string
    pays: string | null; langue: string | null; instagram: string | null; spotify: string | null; youtube: string | null
    tiktok: string | null; tags: string[] | null
  }
  const [clientsData, favorisData, freeDLData] = await Promise.all([
    parLots<ClientCrm>(clientIds, lot => admin
      .from('clients')
      .select('id, prenom, surnom, nom, nom_artiste, email, pays, langue, instagram, spotify, youtube, tiktok, tags')
      .in('id', lot)),
    parLots<{ client_id: string; beat_id: string | null }>(clientIds, lot => admin
      .from('favoris')
      .select('client_id, beat_id')
      .in('client_id', lot)),
    parLots<{ client_id: string; beat_id: string | null }>(clientIds, lot => admin
      .from('free_downloads')
      .select('client_id, beat_id')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', lot)),
  ])
  const clientsRes = { data: clientsData }
  const favorisRes = { data: favorisData }
  const freeDLRes  = { data: freeDLData }

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

  const favorisCount = new Map<string, number>()
  const freeDLCount  = new Map<string, number>()
  const favorisParClient = new Map<string, string[]>()
  const freeDLParClient  = new Map<string, string[]>()
  for (const f of favorisRes.data ?? []) {
    favorisCount.set(f.client_id, (favorisCount.get(f.client_id) ?? 0) + 1)
    if (f.beat_id) favorisParClient.set(f.client_id, [...(favorisParClient.get(f.client_id) ?? []), f.beat_id])
  }
  for (const d of freeDLRes.data ?? []) {
    freeDLCount.set(d.client_id, (freeDLCount.get(d.client_id) ?? 0) + 1)
    if (d.beat_id) freeDLParClient.set(d.client_id, [...(freeDLParClient.get(d.client_id) ?? []), d.beat_id])
  }

  const contacts: ContactEnrichi[] = (clientsRes.data ?? [])
    .filter(c => !archiveIds.has(c.id))
    .map(c => {
      const cmdsBase     = commandesParClient.get(c.id) ?? []
      const cmdsArchives = (conserveArchives.get(c.id) ?? []).flatMap(aid => commandesParClient.get(aid) ?? [])
      const cmds         = [...cmdsBase, ...cmdsArchives]
      const abo          = aboParClient.get(c.id)
      const lead         = leadMap.get(c.id)

      const licenceCmds = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
      const nbAchats    = nbAchatsPayants(licenceCmds)
      const ltv         = totalDepense(cmds)
      const panierMoyen = panierMoyenLicences(licenceCmds)
      const dernierAchat = datePlusRecente(licenceCmds)
      const premierContact = datePlusAncienne(cmds) ?? new Date().toISOString()

      let statut: ContactFiltre['statut']
      if (abo && (abo.statut === 'actif' || abo.statut === 'impaye')) statut = 'abonne'
      else if (abo && abo.statut === 'annule') statut = 'ancien'
      else if (licenceCmds.length > 0) statut = 'client'
      else statut = 'lead'

      const langueEffective: 'FR' | 'EN' = ((c as Record<string, unknown>).langue as 'FR' | 'EN' | null)
        ?? (PAYS_FR.has((c.pays ?? '').toUpperCase()) ? 'FR' : 'EN')

      const stylesArr: string[] = []
      const typeBeatArr: string[] = []
      const ambiancesArr: string[] = []
      const instrumentsArr: string[] = []
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
          if ((beat as Record<string, unknown>).ambiances)   ambiancesArr.push(...((beat as Record<string, unknown>).ambiances as string[] ?? []))
          if ((beat as Record<string, unknown>).instruments) instrumentsArr.push(...((beat as Record<string, unknown>).instruments as string[] ?? []))
        }
      }
      for (const cmd of licenceCmds) {
        for (const ligne of cmd.commande_lignes ?? []) {
          ajouterPref(ligne.beat_id, 10)
          const lic = ligne.licence_id ? licenceMap.get(ligne.licence_id) : null
          if (lic?.modele) licenceArr.push(lic.modele)
        }
      }
      for (const beatId of freeDLParClient.get(c.id)  ?? []) ajouterPref(beatId, 2)
      for (const beatId of favorisParClient.get(c.id) ?? []) ajouterPref(beatId, 1)

      const nbFavoris     = favorisCount.get(c.id) ?? 0
      const nbFreeDL      = freeDLCount.get(c.id)  ?? 0
      const newsletterStatut = statutFusionne(
        [c.id, ...(conserveArchives.get(c.id) ?? [])].flatMap(id => leadMap.get(id) ?? []),
      )

      return {
        id:                 c.id,
        email:              c.email,
        nom:                c.nom,
        prenom:             c.prenom,
        surnom:             (c as Record<string, unknown>).surnom as string | null,
        nom_artiste:        (c as Record<string, unknown>).nom_artiste as string | null,
        statut,
        ltv,
        nb_achats:          nbAchats,
        panier_moyen:       panierMoyen,
        mensualites_payees: abo?.mensualites_payees ?? 0,
        dernier_achat_iso:  dernierAchat,
        premierContactISO:  premierContact,
        newsletter_consent: newsletterStatut === 'inscrit',
        newsletter_statut:  newsletterStatut,
        langue:             langueEffective,
        pays:               c.pays ?? null,
        instagram:          c.instagram ?? null,
        spotify:            c.spotify   ?? null,
        youtube:            c.youtube   ?? null,
        tiktok:             c.tiktok    ?? null,
        pref_style:         topPref(stylesArr),
        pref_type_beat:     topPref(typeBeatArr),
        pref_ambiance:      topPref(ambiancesArr),
        pref_instruments:   topPref(instrumentsArr),
        pref_licence:       topPref(licenceArr),
        tags:               ((c as Record<string, unknown>).tags as string[]) ?? [],
        source:             lead?.source ?? null,
        nb_favoris:         nbFavoris,
        nb_free_downloads:  nbFreeDL,
        score_rf:           computeScoreRF(nbAchats, dernierAchat),
        score_chaleur:      computeScoreChaleur(lead?.source ?? null, nbFavoris, nbFreeDL, newsletterStatut === 'inscrit'),
      } satisfies ContactEnrichi
    })

  return { contacts, catalog }
}
