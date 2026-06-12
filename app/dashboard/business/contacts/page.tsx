import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ContactsClient, { ContactRow } from './_components/ContactsClient'

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>
}) {
  const { vue = '' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const { data: beatmaker } = await supabase
    .from('beatmakers')
    .select('id')
    .eq('id', user.id)
    .single()
  if (!beatmaker) redirect('/')

  const [clientsRes, commandesRes, aboRes, listesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, prenom, nom, nom_artiste, email, pays, telephone, created_at, instagram, spotify, youtube, tiktok, newsletter_consent, notes')
      .eq('beatmaker_id', user.id),
    supabase
      .from('commandes')
      .select('client_id, created_at, prix_paye, type_commande')
      .eq('beatmaker_id', user.id)
      .eq('type_commande', 'LICENCE'),
    supabase
      .from('abonnements_boutique')
      .select('client_id, statut, mensualites_payees, annulation_en_cours, created_at, date_fin')
      .eq('beatmaker_id', user.id),
    supabase
      .from('listes_contacts')
      .select('id, nom')
      .eq('beatmaker_id', user.id),
  ])

  const clients   = clientsRes.data   ?? []
  const commandes = commandesRes.data ?? []
  const abos      = aboRes.data       ?? []
  const listesRaw = listesRes.data    ?? []

  // Maps pour accès rapide
  const commandesParClient = new Map<string, typeof commandes>()
  for (const cmd of commandes) {
    const arr = commandesParClient.get(cmd.client_id) ?? []
    arr.push(cmd)
    commandesParClient.set(cmd.client_id, arr)
  }

  const aboParClient = new Map<string, (typeof abos)[0]>()
  for (const abo of abos) {
    const existing = aboParClient.get(abo.client_id)
    if (!existing || new Date(abo.date_fin ?? abo.created_at) > new Date(existing.date_fin ?? existing.created_at)) {
      aboParClient.set(abo.client_id, abo)
    }
  }

  const contacts: ContactRow[] = clients.map(c => {
    const cmds   = commandesParClient.get(c.id) ?? []
    const abo    = aboParClient.get(c.id)
    const nbAchats = cmds.length

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

    // 1ère action
    const premierContactISO = c.created_at
    let type1ereAction = 'Inscription'
    if (abo && nbAchats > 0) {
      const aboDate  = new Date(abo.created_at ?? c.created_at)
      const cmdDates = cmds.map(cmd => new Date(cmd.created_at))
      const firstCmd = cmdDates.length ? new Date(Math.min(...cmdDates.map(d => d.getTime()))) : null
      type1ereAction = firstCmd && firstCmd < aboDate ? 'Achat' : 'Abonnement'
    } else if (abo) {
      type1ereAction = 'Abonnement'
    } else if (nbAchats > 0) {
      type1ereAction = 'Achat'
    }

    // Dernière action
    const candidats: Date[] = [new Date(c.created_at)]
    if (abo) candidats.push(new Date(abo.created_at))
    for (const cmd of cmds) candidats.push(new Date(cmd.created_at))
    const dernierDate = new Date(Math.max(...candidats.map(d => d.getTime())))
    const dernierContactISO = dernierDate.toISOString()

    let typeDerniereAction = 'Inscription'
    if (candidats.length > 1) {
      const aboDate  = abo ? new Date(abo.created_at) : null
      const cmdDates = cmds.map(cmd => new Date(cmd.created_at))
      const lastCmd  = cmdDates.length ? new Date(Math.max(...cmdDates.map(d => d.getTime()))) : null
      if (lastCmd && (!aboDate || lastCmd >= aboDate)) {
        typeDerniereAction = 'Commande'
      } else if (aboDate) {
        typeDerniereAction = 'Abonnement'
      }
    }

    return {
      id:                c.id,
      prenom:            c.prenom,
      nom:               c.nom,
      nom_artiste:       c.nom_artiste,
      email:             c.email,
      pays:              c.pays,
      telephone:         c.telephone,
      instagram:         c.instagram,
      spotify:           c.spotify,
      youtube:           c.youtube,
      tiktok:            c.tiktok,
      newsletter_consent: c.newsletter_consent ?? false,
      statut,
      statut_abo_detail: statutAboDetail,
      nb_achats:         nbAchats,
      mensualites_payees: abo?.mensualites_payees ?? 0,
      premierContactISO,
      dernierContactISO,
      type1ereAction,
      typeDerniereAction,
    }
  })

  const listes = listesRaw.map(l => ({ id: l.id, nom: l.nom, nb: 0 }))

  return (
    <ContactsClient
      contacts={contacts}
      listes={listes}
      vue={vue}
    />
  )
}
