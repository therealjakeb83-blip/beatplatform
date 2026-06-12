import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import ContactsClient, { ContactRow } from './_components/ContactsClient'

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

  // Fetch via RLS (beatmaker_id = auth.uid())
  const [commandesRes, aboRes, leadsRes, listesRes] = await Promise.all([
    // Toutes les commandes (pas de filtre type) pour ne manquer aucun client_id
    supabase
      .from('commandes')
      .select('client_id, created_at, prix_paye, type_commande')
      .eq('beatmaker_id', user.id)
      .not('client_id', 'is', null),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut, mensualites_payees, annulation_en_cours, created_at, date_fin')
      .eq('beatmaker_id', user.id)
      .not('client_id', 'is', null),
    supabase
      .from('leads')
      .select('client_id, created_at, newsletter_inscrit')
      .eq('beatmaker_id', user.id),
    supabase
      .from('listes_contacts')
      .select('id, nom')
      .eq('beatmaker_id', user.id),
  ])

  const commandes = commandesRes.data ?? []
  const abos      = aboRes.data      ?? []
  const leads     = leadsRes.data    ?? []
  const listesRaw = listesRes.data   ?? []

  // Union de tous les client_ids
  const clientIds = [...new Set([
    ...commandes.map(c => c.client_id as string),
    ...abos.map(a => a.client_id as string),
    ...leads.map(l => l.client_id),
  ])]

  if (clientIds.length === 0) {
    return <ContactsClient contacts={[]} listes={[]} vue={vue} />
  }

  // Clients via admin (RLS = auth.uid() = id, pas de lecture beatmaker→client possible)
  const { data: clientsData } = await admin
    .from('clients')
    .select('id, prenom, nom, nom_artiste, email, pays, telephone, created_at, instagram, spotify, youtube, tiktok, newsletter_consent')
    .in('id', clientIds)

  const clientsRaw = clientsData ?? []

  // Maps pour accès rapide
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

  const leadParClient = new Map<string, (typeof leads)[0]>()
  for (const lead of leads) leadParClient.set(lead.client_id, lead)

  const contacts: ContactRow[] = clientsRaw.map(c => {
    const cmds     = commandesParClient.get(c.id) ?? []
    const abo      = aboParClient.get(c.id)
    const lead     = leadParClient.get(c.id)
    // nb_achats = licences uniquement
    const nbAchats = cmds.filter(cmd => cmd.type_commande === 'LICENCE').length

    // Statut
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

    // 1ère action avec ce beatmaker
    const candidatsPrem: Date[] = []
    if (lead)               candidatsPrem.push(new Date(lead.created_at))
    if (abo)                candidatsPrem.push(new Date(abo.created_at))
    for (const cmd of cmds) candidatsPrem.push(new Date(cmd.created_at))
    const premierContactISO = candidatsPrem.length
      ? new Date(Math.min(...candidatsPrem.map(d => d.getTime()))).toISOString()
      : c.created_at

    let type1ereAction = 'Inscription'
    if (abo && nbAchats > 0) {
      const aboDate  = new Date(abo.created_at)
      const licences = cmds.filter(cmd => cmd.type_commande === 'LICENCE')
      const firstCmd = new Date(Math.min(...licences.map(cmd => new Date(cmd.created_at).getTime())))
      type1ereAction = firstCmd < aboDate ? 'Achat' : 'Abonnement'
    } else if (abo) {
      type1ereAction = 'Abonnement'
    } else if (nbAchats > 0) {
      type1ereAction = 'Achat'
    }

    // Dernière action avec ce beatmaker
    const candidatsDern: Date[] = []
    if (lead)               candidatsDern.push(new Date(lead.created_at))
    if (abo)                candidatsDern.push(new Date(abo.created_at))
    for (const cmd of cmds) candidatsDern.push(new Date(cmd.created_at))
    const dernierContactISO = candidatsDern.length
      ? new Date(Math.max(...candidatsDern.map(d => d.getTime()))).toISOString()
      : c.created_at

    let typeDerniereAction = 'Inscription'
    if (candidatsDern.length > 0) {
      const aboDate  = abo ? new Date(abo.created_at) : null
      const lastCmd  = cmds.length
        ? new Date(Math.max(...cmds.map(cmd => new Date(cmd.created_at).getTime())))
        : null
      if (lastCmd && (!aboDate || lastCmd >= aboDate)) {
        typeDerniereAction = 'Commande'
      } else if (aboDate) {
        typeDerniereAction = 'Abonnement'
      }
    }

    return {
      id:                 c.id,
      prenom:             c.prenom,
      nom:                c.nom,
      nom_artiste:        c.nom_artiste,
      email:              c.email,
      pays:               c.pays,
      telephone:          c.telephone,
      instagram:          c.instagram,
      spotify:            c.spotify,
      youtube:            c.youtube,
      tiktok:             c.tiktok,
      newsletter_consent: (c.newsletter_consent ?? false) || (lead?.newsletter_inscrit ?? false),
      statut,
      statut_abo_detail:  statutAboDetail,
      nb_achats:          nbAchats,
      mensualites_payees: abo?.mensualites_payees ?? 0,
      premierContactISO,
      dernierContactISO,
      type1ereAction,
      typeDerniereAction,
    }
  })

  const listes = listesRaw.map(l => ({ id: l.id, nom: l.nom, nb: 0 }))

  return <ContactsClient contacts={contacts} listes={listes} vue={vue} />
}
