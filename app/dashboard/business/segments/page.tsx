import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import {
  evaluerFiltres, couleurCls,
  type SegmentDB, type Condition, type ContactFiltre,
} from '../_lib/segments'
import SegmentsClient from './_components/SegmentsClient'

// ── Chargement contacts (données nécessaires aux filtres) ──────────────────────

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])

async function loadContacts(beatmakerId: string): Promise<ContactFiltre[]> {
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

  // Commandes + abos en parallèle
  const [commandesRes, aboRes] = await Promise.all([
    supabase
      .from('commandes')
      .select('client_id, created_at, prix_paye, statut, type_commande')
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

  if (clientIds.length === 0) return []

  const { data: clientsRaw } = await admin
    .from('clients')
    .select('id, prenom, pays, langue, newsletter_consent, instagram, spotify, youtube, tiktok, tags')
    .in('id', clientIds)

  if (!clientsRaw) return []

  // Maps
  const commandesParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const id  = cmd.client_id as string
    const arr = commandesParClient.get(id) ?? []
    arr.push(cmd)
    commandesParClient.set(id, arr)
  }

  const aboParClient = new Map<string, (typeof abos)[0]>()
  for (const abo of abos) {
    const id  = abo.client_id as string
    const ex  = aboParClient.get(id)
    if (!ex || new Date(abo.date_fin ?? abo.created_at) > new Date(ex.date_fin ?? ex.created_at)) {
      aboParClient.set(id, abo)
    }
  }

  return clientsRaw
    .filter(c => !archiveIds.has(c.id))
    .map(c => {
      const cmdsBase    = commandesParClient.get(c.id) ?? []
      const cmdsArchives = (conserveArchives.get(c.id) ?? []).flatMap(aid => commandesParClient.get(aid) ?? [])
      const cmds        = [...cmdsBase, ...cmdsArchives]
      const abo         = aboParClient.get(c.id)
      const lead        = leadMap.get(c.id)

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
        : c.prenom // fallback inutilisable — clients.created_at pas dans la query, on utilisera created_at si dispo

      let statut: ContactFiltre['statut']
      if (abo && (abo.statut === 'actif' || abo.statut === 'impaye')) statut = 'abonne'
      else if (abo && abo.statut === 'annule') statut = 'ancien'
      else if (nbAchats > 0) statut = 'client'
      else statut = 'lead'

      const langueEffective: 'FR' | 'EN' = (c.langue as 'FR' | 'EN' | null)
        ?? (PAYS_FR.has((c.pays ?? '').toUpperCase()) ? 'FR' : 'EN')

      return {
        statut,
        ltv,
        nb_achats:           nbAchats,
        panier_moyen:        panierMoyen,
        mensualites_payees:  abo?.mensualites_payees ?? 0,
        dernier_achat_iso:   dernierAchat,
        premierContactISO:   premierContact,
        newsletter_consent:  (c.newsletter_consent ?? false) || (lead?.newsletter_inscrit ?? false),
        langue:              langueEffective,
        pays:                c.pays ?? null,
        instagram:           c.instagram ?? null,
        spotify:             c.spotify   ?? null,
        youtube:             c.youtube   ?? null,
        tiktok:              c.tiktok    ?? null,
        pref_style:          null,
        pref_type_beat:      null,
        pref_ambiance:       null,
        pref_licence:        null,
        tags:                (c.tags as string[]) ?? [],
        source:              lead?.source ?? null,
      } satisfies ContactFiltre
    })
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

  const [{ data: segmentsRaw }, contacts] = await Promise.all([
    supabase
      .from('segments_crm')
      .select('id, nom, description, couleur, filtres, created_at')
      .eq('beatmaker_id', user.id)
      .order('created_at', { ascending: false }),
    loadContacts(user.id),
  ])

  const segments: (SegmentDB & { count: number })[] = (segmentsRaw ?? []).map(s => ({
    ...s,
    filtres: s.filtres as Condition[],
    count:   contacts.filter(c => evaluerFiltres(c, s.filtres as Condition[])).length,
  }))

  return (
    <SegmentsClient
      segments={segments}
      creerSegment={creerSegment}
      supprimerSegment={supprimerSegment}
    />
  )
}
