import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import ListeDetailClient, { type MembreRow, type ContactLight } from './_components/ListeDetailClient'
import { totalDepense, panierMoyenLicences, nbAchatsPayants, datePlusRecente, datePlusAncienne } from '@/app/dashboard/business/_lib/ltv'
import { toutesLesLignes, parLots } from '@/app/dashboard/business/_lib/requetes'
import { chargerCommandesExternesCrm } from '@/app/dashboard/business/_lib/commandes-externes'
import { libellePlateforme } from '@/lib/import-externe/plateformes'
import { statutFusionne } from '@/lib/newsletter'

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

  const membresRaw = await toutesLesLignes<{ client_id: string }>((debut, fin) => supabase
    .from('listes_crm_contacts')
    .select('client_id')
    .eq('liste_id', listeId)
    .order('client_id')
    .range(debut, fin))

  const membreIds = (membresRaw ?? []).map(m => m.client_id)
  const membreSet = new Set(membreIds)

  // Tous les IDs clients du beatmaker
  type AvecClient = { client_id: string }
  const [cmdIds, leadIds, aboIds] = await Promise.all([
    toutesLesLignes<AvecClient>((d, f) => supabase.from('commandes').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null).order('id').range(d, f)),
    toutesLesLignes<AvecClient>((d, f) => supabase.from('leads').select('client_id').eq('beatmaker_id', beatmakerId).order('id').range(d, f)),
    toutesLesLignes<AvecClient>((d, f) => supabase.from('abonnements_boutique').select('client_id').eq('beatmaker_id', beatmakerId).not('client_id', 'is', null).order('id').range(d, f)),
  ])

  const allClientIds = [...new Set([
    ...cmdIds.map(c => c.client_id),
    ...leadIds.map(l => l.client_id),
    ...aboIds.map(a => a.client_id),
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
  type ClientListe = {
    id: string; prenom: string | null; nom: string; surnom: string | null; nom_artiste: string | null; email: string
    pays: string | null; telephone: string | null; instagram: string | null; spotify: string | null; youtube: string | null; tiktok: string | null
  }
  type CommandeListe = { client_id: string; prix_paye: number | string | null; type_commande: string | null; statut: string; montant_rembourse_cents: number | null; created_at: string | null }
  type LeadListe = { client_id: string; newsletter_statut: string; newsletter_statut_at: string | null; source: string; source_plateforme: string | null; created_at: string }
  const [clients, commandesNatives, commandesExternes, abos, leads] = await Promise.all([
    parLots<ClientListe>(allClientIds, lot => admin
      .from('clients')
      .select('id, prenom, nom, surnom, nom_artiste, email, pays, telephone, instagram, spotify, youtube, tiktok')
      .in('id', lot)),
    parLots<CommandeListe>(membreIds, lot => supabase
      .from('commandes')
      .select('client_id, prix_paye, type_commande, statut, montant_rembourse_cents, created_at')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', lot)),
    chargerCommandesExternesCrm(supabase, beatmakerId, membreIds),
    parLots<{ client_id: string; statut: string }>(membreIds, lot => supabase
      .from('abonnements_boutique')
      .select('client_id, statut')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', lot)),
    parLots<LeadListe>(membreIds, lot => supabase
      .from('leads')
      .select('client_id, newsletter_statut, newsletter_statut_at, source, source_plateforme, created_at')
      .eq('beatmaker_id', beatmakerId)
      .in('client_id', lot)),
  ])
  const commandes: CommandeListe[] = [...commandesNatives, ...commandesExternes]

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
  type LeadData = LeadListe
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
      const ltv      = totalDepense(cmds)
      const licences = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
      const nb_achats = nbAchatsPayants(licences)
      const dernierAchat = datePlusRecente(licences)
      const premiereCommande = datePlusAncienne(cmds)
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
        panier_moyen:         panierMoyenLicences(licences) ?? 0,
        dernier_achat_iso:    dernierAchat,
        premiere_contact_iso: premiereContactISO,
        dernier_contact_iso:  dernierContactISO,
        newsletter_consent:   statutFusionne(leadData ? [leadData] : []) === 'inscrit',
        lead_source:          leadData?.source === 'import' ? `Import — ${libellePlateforme(leadData.source_plateforme)}` : leadData?.source ?? null,
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
