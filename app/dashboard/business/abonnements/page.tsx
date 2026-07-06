import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AbonnementsClient from './_components/AbonnementsClient'

export type AboRow = {
  id: string
  client_id: string | null
  beatmaker_id: string
  created_at: string
  plan: string
  periode: string
  prix: number
  devise: string
  statut: 'actif' | 'annule' | 'impaye'
  date_debut: string
  date_fin: string
  date_annulation: string | null
  methode_paiement: string
  annulation_en_cours: boolean
  mensualites_payees: number | null
  mois_consecutifs: number
  acheteur_email: string | null
  acheteur_nom: string | null
  stripe_subscription_id: string | null
  clients: {
    id: string
    prenom: string | null
    nom: string
    email: string
    pays: string | null
  } | null
  derniere_commande: string | null
}

export default async function AbonnementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const [{ data: abos }, { data: cmdsDerniere }] = await Promise.all([
    admin
      .from('abonnements_boutique')
      .select(`
        id, client_id, beatmaker_id, created_at,
        plan, periode, prix, devise,
        statut, date_debut, date_fin, date_annulation,
        methode_paiement, annulation_en_cours,
        mensualites_payees, mois_consecutifs,
        acheteur_email, acheteur_nom, stripe_subscription_id,
        clients (id, prenom, nom, email, pays)
      `)
      .eq('beatmaker_id', user.id)
      .order('date_debut', { ascending: false })
      .limit(300),

    admin
      .from('commandes')
      .select('client_id, created_at')
      .eq('beatmaker_id', user.id)
      .in('type_commande', ['CREATION_ABONNEMENT', 'RENOUVELLEMENT'])
      .order('created_at', { ascending: false }),
  ])

  // Map client_id → dernière commande d'abonnement
  const derniereMap = new Map<string, string>()
  for (const cmd of cmdsDerniere ?? []) {
    if (cmd.client_id && !derniereMap.has(cmd.client_id)) {
      derniereMap.set(cmd.client_id, cmd.created_at)
    }
  }

  const rows: AboRow[] = (abos ?? []).map(a => ({
    ...(a as unknown as AboRow),
    derniere_commande: a.client_id
      ? (derniereMap.get(a.client_id) ?? a.date_debut)
      : a.date_debut,
  }))

  return <AbonnementsClient abonnements={rows} />
}
