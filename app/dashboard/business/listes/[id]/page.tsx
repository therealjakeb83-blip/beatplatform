import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ListeDetailClient, { type MembreRow, type ContactLight } from './_components/ListeDetailClient'

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ListeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: listeId } = await params
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  const { data: liste } = await supabase
    .from('listes_crm')
    .select('id, nom, description')
    .eq('id', listeId)
    .eq('beatmaker_id', beatmakerId)
    .single()

  if (!liste) notFound()

  // ── Server actions (closures sur listeId + beatmakerId) ───────────────────

  async function ajouterContacts(formData: FormData) {
    'use server'
    const s = await createClient()
    const { data: { user: u } } = await s.auth.getUser()
    if (!u) return
    const clientIds = JSON.parse(formData.get('client_ids') as string ?? '[]') as string[]
    if (!clientIds.length) return
    await s.from('listes_crm_contacts').upsert(
      clientIds.map(clientId => ({ liste_id: listeId, client_id: clientId })),
      { onConflict: 'liste_id,client_id', ignoreDuplicates: true }
    )
    revalidatePath(`/dashboard/business/listes/${listeId}`)
    revalidatePath('/dashboard/business/listes')
  }

  async function retirerContact(formData: FormData) {
    'use server'
    const s = await createClient()
    const { data: { user: u } } = await s.auth.getUser()
    if (!u) return
    const clientId = formData.get('client_id') as string
    await s.from('listes_crm_contacts')
      .delete()
      .eq('liste_id', listeId)
      .eq('client_id', clientId)
    revalidatePath(`/dashboard/business/listes/${listeId}`)
    revalidatePath('/dashboard/business/listes')
  }

  // ── Données ───────────────────────────────────────────────────────────────

  const { data: membresRaw } = await supabase
    .from('listes_crm_contacts')
    .select('client_id')
    .eq('liste_id', listeId)

  const membreIds = (membresRaw ?? []).map(m => m.client_id)
  const membreSet = new Set(membreIds)

  // Tous les IDs clients du beatmaker
  const [cmdIdsRes, leadIdsRes, aboIdsRes] = await Promise.all([
    supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null),
    supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId),
    supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null),
  ])

  const allClientIds = [...new Set([
    ...(cmdIdsRes.data  ?? []).map(c => c.client_id as string),
    ...(leadIdsRes.data ?? []).map(l => l.client_id),
    ...(aboIdsRes.data  ?? []).map(a => a.client_id as string),
  ])]

  if (allClientIds.length === 0) {
    return (
      <ListeDetailClient
        liste={liste}
        membres={[]}
        tousContacts={[]}
        ajouterContacts={ajouterContacts}
        retirerContact={retirerContact}
      />
    )
  }

  // Infos clients (admin) + commandes + abos + leads membres en parallèle
  const [clientsRes, commandesRes, abosRes, leadsRes] = await Promise.all([
    admin
      .from('clients')
      .select('id, prenom, nom, surnom, nom_artiste, email, pays, telephone, instagram, spotify, youtube, tiktok, newsletter_consent')
      .in('id', allClientIds),
    membreIds.length > 0
      ? supabase
          .from('commandes')
          .select('client_id, prix_paye, type_commande, statut, created_at')
          .eq('beatmaker_id', beatmakerId)
          .in('client_id', membreIds)
          .not('client_id', 'is', null)
      : Promise.resolve({ data: [] as { client_id: unknown; prix_paye: number; type_commande: string | null; statut: string; created_at: string }[] }),
    membreIds.length > 0
      ? supabase
          .from('abonnements_boutique')
          .select('client_id, statut')
          .eq('beatmaker_id', beatmakerId)
          .in('client_id', membreIds)
          .not('client_id', 'is', null)
      : Promise.resolve({ data: [] as { client_id: unknown; statut: string }[] }),
    membreIds.length > 0
      ? supabase
          .from('leads')
          .select('client_id, newsletter_inscrit, source, created_at')
          .eq('beatmaker_id', beatmakerId)
          .in('client_id', membreIds)
      : Promise.resolve({ data: [] as {
          client_id: string; newsletter_inscrit: boolean; source: string; created_at: string
        }[] }),
  ])

  const clients   = clientsRes.data   ?? []
  const commandes = commandesRes.data ?? []
  const abos      = abosRes.data      ?? []
  const leads     = leadsRes.data     ?? []

  // Maps
  const aboParClient = new Map<string, string>()
  for (const abo of abos) {
    if (!aboParClient.has(abo.client_id as string)) aboParClient.set(abo.client_id as string, abo.statut)
  }
  const cmdsParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const id  = cmd.client_id as string
    const arr = cmdsParClient.get(id) ?? []
    arr.push(cmd)
    cmdsParClient.set(id, arr)
  }
  type LeadData = { newsletter_inscrit: boolean; source: string; created_at: string }
  const leadParClient = new Map<string, LeadData>()
  for (const l of leads) {
    if (!leadParClient.has(l.client_id)) leadParClient.set(l.client_id, l)
  }

  function contactLabel(c: Record<string, unknown>): string {
    return (c.surnom as string | null) ?? (c.nom_artiste as string | null) ?? (c.prenom as string | null) ?? ''
  }

  // Membres avec données complètes
  const membres: MembreRow[] = clients
    .filter(c => membreSet.has(c.id))
    .map(c => {
      const raw      = c as Record<string, unknown>
      const cmds     = cmdsParClient.get(c.id) ?? []
      const payees   = cmds.filter(cmd => cmd.statut === 'payee')
      const ltv      = payees.reduce((s, cmd) => s + (cmd.prix_paye ?? 0), 0)
      const licences = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
      const nb_achats = licences.length
      const dernierAchat = licences.length
        ? new Date(Math.max(...licences.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
        : null
      const premiereCommande = cmds.length > 0
        ? new Date(Math.min(...cmds.map(cmd => new Date(cmd.created_at).getTime()))).toISOString()
        : null
      const aboStatut = aboParClient.get(c.id)
      const leadData  = leadParClient.get(c.id)
      let statut: MembreRow['statut']
      if (aboStatut === 'actif' || aboStatut === 'impaye') statut = 'abonne'
      else if (aboStatut === 'annule')                     statut = 'ancien'
      else if (licences.length > 0)                        statut = 'client'
      else                                                 statut = 'lead'

      const premiereContactISO = (() => {
        const candidates = [leadData?.created_at, premiereCommande].filter(Boolean) as string[]
        if (!candidates.length) return null
        return candidates.reduce((min, d) => d < min ? d : min)
      })()
      const dernierContactISO = (() => {
        const candidates = [dernierAchat].filter(Boolean) as string[]
        if (!candidates.length) return null
        return candidates.reduce((max, d) => d > max ? d : max)
      })()

      return {
        id:                   c.id,
        label:                contactLabel(raw),
        nom:                  c.nom ?? '',
        email:                c.email ?? '',
        pays:                 c.pays ?? null,
        statut,
        statut_abo_detail:    aboStatut ?? null,
        nb_achats,
        ltv,
        panier_moyen:         nb_achats > 0 ? ltv / nb_achats : 0,
        dernier_achat_iso:    dernierAchat,
        premiere_contact_iso: premiereContactISO,
        dernier_contact_iso:  dernierContactISO,
        newsletter_consent:   ((raw.newsletter_consent as boolean | null) ?? false) || (leadData?.newsletter_inscrit ?? false),
        lead_source:          leadData?.source ?? null,
        lead_nb_favoris:      0,
        lead_nb_free_dl:      0,
        pref_style:           null,
        pref_type_beat:       null,
        pref_ambiance:        null,
        instagram:            (c as Record<string, string | null>).instagram ?? null,
        spotify:              (c as Record<string, string | null>).spotify ?? null,
        youtube:              (c as Record<string, string | null>).youtube ?? null,
        tiktok:               (c as Record<string, string | null>).tiktok ?? null,
        telephone:            (c as Record<string, string | null>).telephone ?? null,
      }
    })
    .sort((a, b) => b.ltv - a.ltv)

  // Tous les contacts hors membres (pour la modale)
  const tousContacts: ContactLight[] = clients
    .filter(c => !membreSet.has(c.id))
    .map(c => {
      const raw = c as Record<string, unknown>
      return {
        id:    c.id,
        label: contactLabel(raw),
        nom:   c.nom ?? '',
        email: c.email ?? '',
        pays:  c.pays ?? null,
      }
    })
    .sort((a, b) => `${a.label} ${a.nom}`.localeCompare(`${b.label} ${b.nom}`, 'fr'))

  return (
    <ListeDetailClient
      liste={liste}
      membres={membres}
      tousContacts={tousContacts}
      ajouterContacts={ajouterContacts}
      retirerContact={retirerContact}
    />
  )
}
