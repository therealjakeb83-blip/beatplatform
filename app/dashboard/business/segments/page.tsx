import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import {
  evaluerFiltres,
  computeScoreRF, computeScoreChaleur,
  type SegmentDB, type Condition, type ContactFiltre, type CatalogOptions,
} from '../_lib/segments'
import SegmentsClient from './_components/SegmentsClient'

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Chargement contacts ────────────────────────────────────────────────────────

async function loadContactsEtCatalogue(beatmakerId: string) {
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
  const { data: leadsRaw } = await supabase
    .from('leads')
    .select('client_id, source, newsletter_inscrit')
    .eq('beatmaker_id', beatmakerId)

  const leadMap = new Map((leadsRaw ?? []).map(l => [l.client_id, l]))

  // Commandes + abos + beats catalogue + licences catalogue en parallèle
  const [commandesRes, aboRes, beatsAllRes, licencesAllRes] = await Promise.all([
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
    supabase
      .from('beats')
      .select('id, styles, type_beat, ambiances, instruments')
      .eq('beatmaker_id', beatmakerId),
    supabase
      .from('licences')
      .select('modele')
      .eq('beatmaker_id', beatmakerId),
  ])

  const commandes   = commandesRes.data ?? []
  const abos        = aboRes.data       ?? []
  const beatsAll    = beatsAllRes.data  ?? []
  const licencesAll = licencesAllRes.data ?? []

  // Catalogue pour le filter builder
  const catalog: CatalogOptions = {
    styles:      uniq(beatsAll.flatMap(b => b.styles      ?? [])),
    typeBeat:    uniq(beatsAll.flatMap(b => b.type_beat   ?? [])),
    ambiances:   uniq(beatsAll.flatMap(b => b.ambiances   ?? [])),
    instruments: uniq(beatsAll.flatMap(b => b.instruments ?? [])),
    licences:    uniq(licencesAll.map(l => l.modele).filter(Boolean)),
  }

  // Beat map (id → données)
  const beatMap = new Map(beatsAll.map(b => [b.id, b]))

  // Licences map (id → modele) — si on a les IDs dans commandes
  const licenceBeatIds = [...new Set(
    commandes.filter(c => c.type_commande === 'LICENCE' && c.beat_id).map(c => c.beat_id as string)
  )]
  const licenceIds = [...new Set(
    commandes.filter(c => c.licence_id).map(c => c.licence_id as string)
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

  if (clientIds.length === 0) return { contacts: [] as ContactFiltre[], catalog }

  // Clients + favoris + free_downloads en parallèle
  const [clientsRes, favorisRes, freeDLRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, pays, langue, newsletter_consent, instagram, spotify, youtube, tiktok, tags')
      .in('id', clientIds),
    admin
      .from('favoris')
      .select('client_id')
      .in('client_id', clientIds),
    admin
      .from('free_downloads')
      .select('client_id')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', clientIds),
  ])

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

  // Maps favoris + free_downloads (compteurs)
  const favorisCount  = new Map<string, number>()
  const freeDLCount   = new Map<string, number>()
  for (const f of favorisRes.data  ?? []) favorisCount.set(f.client_id,  (favorisCount.get(f.client_id)  ?? 0) + 1)
  for (const d of freeDLRes.data   ?? []) freeDLCount.set(d.client_id,   (freeDLCount.get(d.client_id)   ?? 0) + 1)

  const contacts: ContactFiltre[] = (clientsRes.data ?? [])
    .filter(c => !archiveIds.has(c.id))
    .map(c => {
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

      let statut: ContactFiltre['statut']
      if (abo && (abo.statut === 'actif' || abo.statut === 'impaye')) statut = 'abonne'
      else if (abo && abo.statut === 'annule') statut = 'ancien'
      else if (nbAchats > 0) statut = 'client'
      else statut = 'lead'

      const langueEffective: 'FR' | 'EN' = ((c as Record<string, unknown>).langue as 'FR' | 'EN' | null)
        ?? (PAYS_FR.has((c.pays ?? '').toUpperCase()) ? 'FR' : 'EN')

      const stylesArr: string[] = []
      const typeBeatArr: string[] = []
      const ambiancesArr: string[] = []
      const instrumentsArr: string[] = []
      const licenceArr: string[] = []
      for (const cmd of licenceCmds) {
        const beat = cmd.beat_id ? beatMap.get(cmd.beat_id) : null
        if (beat?.styles)      stylesArr.push(...beat.styles)
        if (beat?.type_beat)   typeBeatArr.push(...beat.type_beat)
        if ((beat as Record<string, unknown>)?.ambiances)   ambiancesArr.push(...((beat as Record<string, unknown>).ambiances as string[] ?? []))
        if ((beat as Record<string, unknown>)?.instruments) instrumentsArr.push(...((beat as Record<string, unknown>).instruments as string[] ?? []))
        const lic = cmd.licence_id ? licenceMap.get(cmd.licence_id) : null
        if (lic?.modele) licenceArr.push(lic.modele)
      }

      const nbFavoris     = favorisCount.get(c.id)  ?? 0
      const nbFreeDL      = freeDLCount.get(c.id)   ?? 0
      const newsletterConsent = (c.newsletter_consent ?? false) || (lead?.newsletter_inscrit ?? false)

      return {
        statut,
        ltv,
        nb_achats:          nbAchats,
        panier_moyen:       panierMoyen,
        mensualites_payees: abo?.mensualites_payees ?? 0,
        dernier_achat_iso:  dernierAchat,
        premierContactISO:  premierContact,
        newsletter_consent: newsletterConsent,
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
        score_chaleur:      computeScoreChaleur(lead?.source ?? null, nbFavoris, nbFreeDL, newsletterConsent),
      } satisfies ContactFiltre
    })

  return { contacts, catalog }
}

// ── Server actions ─────────────────────────────────────────────────────────────

async function creerSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('segments_crm').insert({
    beatmaker_id: user.id,
    nom:          (formData.get('nom')         as string).trim(),
    description:  (formData.get('description') as string).trim() || null,
    couleur:      (formData.get('couleur')     as string) || 'indigo',
    filtres:      JSON.parse((formData.get('filtres') as string) || '[]'),
  })
  revalidatePath('/dashboard/business/segments')
}

async function modifierSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('segments_crm').update({
    nom:         (formData.get('nom')         as string).trim(),
    description: (formData.get('description') as string).trim() || null,
    couleur:     (formData.get('couleur')     as string) || 'indigo',
    filtres:     JSON.parse((formData.get('filtres') as string) || '[]'),
  }).eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/segments')
}

async function supprimerSegment(formData: FormData) {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const id = formData.get('id') as string
  await supabase.from('segments_crm').delete().eq('id', id).eq('beatmaker_id', user.id)
  revalidatePath('/dashboard/business/segments')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function SegmentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).single()
  if (!bm) redirect('/')

  const [{ data: segmentsRaw }, { contacts, catalog }] = await Promise.all([
    supabase
      .from('segments_crm')
      .select('id, nom, description, couleur, filtres, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    loadContactsEtCatalogue(user.id),
  ])

  const segments: (SegmentDB & { count: number })[] = (segmentsRaw ?? []).map(s => ({
    ...s,
    filtres: s.filtres as Condition[],
    count:   contacts.filter(c => evaluerFiltres(c, s.filtres as Condition[])).length,
  }))

  return (
    <SegmentsClient
      segments={segments}
      catalog={catalog}
      creerSegment={creerSegment}
      modifierSegment={modifierSegment}
      supprimerSegment={supprimerSegment}
    />
  )
}
