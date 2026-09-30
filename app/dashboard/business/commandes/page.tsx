import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { redirect } from 'next/navigation'
import CommandesClient from './_components/CommandesClient'

export type CommandeRow = {
  id: string
  created_at: string
  prix_paye: number
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige' | 'creee' | 'expiree' | 'echouee'
  code_promo: string | null
  reduction_montant: number | null
  fichiers_livres: boolean | null
  source_marketing: string | null
  type_transaction: string | null
  type_commande: string | null
  plateforme_source: string | null
  methode_paiement: string | null
  acheteur_email: string | null
  acheteur_nom: string | null
  clients: {
    id: string
    prenom: string | null
    nom: string
    email: string
    pays: string | null
  } | null
  /** 1er article du panier — pour l'affichage compact de la liste */
  beats: { titre: string; image_url: string | null } | null
  licences: { nom: string; modele: string } | null
  /** Nombre total d'articles du panier (1 la plupart du temps) */
  nbArticles: number
  /** Titres de tous les articles — pour la recherche par beat sur un panier multi-articles */
  tousBeatsTitres: string[]
  /** Distingue une vraie commande (avec page détail/facture) d'une tentative de paiement */
  _type: 'commande' | 'tentative'
  /** Vente en collaboration sur la boutique d'un autre (Phase 13) : nom de
   *  cette boutique, et numéro de MA facture comme identifiant. */
  venduePar?: string | null
  numeroFactureVendeur?: string | null
}

export default async function CommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; type?: string }>
}) {
  const { clientId, type } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  // Admin client pour bypasser la RLS de la table clients (join)
  const admin = createAdminClient()

  const { data } = await admin
    .from('commandes')
    .select(
      `id, created_at, prix_paye, statut,
       code_promo, reduction_montant, fichiers_livres,
       source_marketing, type_commande, plateforme_source,
       acheteur_email, acheteur_nom, methode_paiement,
       clients (id, prenom, nom, email, pays),
       commande_lignes (beat_id, licence_id, type_transaction, beats (titre, image_url), licences (nom, modele))`
    )
    .eq('beatmaker_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500)

  // Tentatives non abouties (une tentative réussie devient une vraie commande
  // ci-dessus — inutile de l'afficher deux fois)
  const { data: tentatives } = await admin
    .from('tentatives_paiement')
    .select(
      `id, created_at, prix, code_promo, source_marketing, email, statut, type,
       clients (id, prenom, nom, email, pays),
       tentatives_paiement_lignes (beat_id, licence_id, beats (titre, image_url), licences (nom, modele))`
    )
    .eq('beatmaker_id', user.id)
    .neq('statut', 'complete')
    .order('created_at', { ascending: false })
    .limit(500)

  type LigneJointe = {
    beat_id: string
    licence_id: string
    type_transaction?: string | null
    beats: { titre: string; image_url: string | null } | null
    licences: { nom: string; modele: string } | null
  }

  type CommandeRawRow = {
    id: string
    created_at: string
    prix_paye: number
    statut: CommandeRow['statut']
    code_promo: string | null
    reduction_montant: number | null
    fichiers_livres: boolean | null
    source_marketing: string | null
    type_commande: string | null
    plateforme_source: string | null
    acheteur_email: string | null
    acheteur_nom: string | null
    methode_paiement: string | null
    clients: CommandeRow['clients']
    commande_lignes: LigneJointe[]
  }

  type TentativeRow = {
    id: string
    created_at: string
    prix: number
    code_promo: string | null
    source_marketing: string | null
    email: string | null
    statut: 'creee' | 'expiree' | 'echouee'
    type: 'achat_beat' | 'renouvellement_abonnement'
    clients: CommandeRow['clients']
    tentatives_paiement_lignes: LigneJointe[]
  }

  /** Dérive les champs d'affichage compact (1er article + total) depuis les lignes d'un panier */
  function resumeLignes(lignes: LigneJointe[]) {
    const premiere = lignes[0]
    return {
      beats: premiere?.beats ?? null,
      licences: premiere?.licences ?? null,
      nbArticles: lignes.length,
      tousBeatsTitres: lignes.map(l => l.beats?.titre).filter((t): t is string => !!t),
      type_transaction: lignes.some(l => l.type_transaction === 'upgrade') ? 'upgrade' : (premiere?.type_transaction ?? null),
    }
  }

  const commandes: CommandeRow[] = ((data ?? []) as unknown as CommandeRawRow[]).map(c => {
    const { commande_lignes, ...rest } = c
    return { ...rest, ...resumeLignes(commande_lignes ?? []), _type: 'commande' as const }
  })

  const tentativesRows: CommandeRow[] = ((tentatives ?? []) as unknown as TentativeRow[]).map(t => ({
    id: t.id,
    created_at: t.created_at,
    prix_paye: t.prix,
    statut: t.statut,
    code_promo: t.code_promo,
    reduction_montant: null,
    fichiers_livres: null,
    source_marketing: t.source_marketing,
    type_commande: t.type === 'renouvellement_abonnement' ? 'RENOUVELLEMENT' : null,
    plateforme_source: 'my_producer',
    methode_paiement: 'stripe',
    acheteur_email: t.email,
    acheteur_nom: null,
    clients: t.clients,
    ...resumeLignes(t.tentatives_paiement_lignes ?? []),
    _type: 'tentative' as const,
  }))

  // Ventes où je suis vendeur sur la boutique d'un autre (Phase 12 Q19 /
  // Phase 13 lot 3) : ma part seulement, jamais l'email du client ni la
  // source marketing ; le code promo reste visible (il explique une part à 0 €).
  const { data: mesTranches } = await admin
    .from('commande_tranches')
    .select(`montant_ttc_cents, facture_numero,
      commandes!inner (id, created_at, statut, code_promo, beatmaker_id, type_commande, acheteur_nom,
        beatmakers (nom_artiste),
        commande_lignes (beat_id, licence_id, type_transaction, beats (titre, image_url), licences (nom, modele)))`)
    .eq('vendeur_id', user.id)
    .neq('commandes.beatmaker_id', user.id)
    .limit(500)

  type TrancheJointe = {
    montant_ttc_cents: number
    facture_numero: string | null
    commandes: {
      id: string
      created_at: string
      statut: CommandeRow['statut']
      code_promo: string | null
      type_commande: string | null
      acheteur_nom: string | null
      beatmakers: { nom_artiste: string } | null
      commande_lignes: LigneJointe[]
    }
  }

  const ventesCollab: CommandeRow[] = ((mesTranches ?? []) as unknown as TrancheJointe[]).map(t => ({
    id: t.commandes.id,
    created_at: t.commandes.created_at,
    prix_paye: t.montant_ttc_cents / 100,
    statut: t.commandes.statut,
    code_promo: t.commandes.code_promo,
    reduction_montant: null,
    fichiers_livres: null,
    source_marketing: null,
    type_commande: t.commandes.type_commande,
    plateforme_source: 'my_producer',
    methode_paiement: null,
    acheteur_email: null,
    acheteur_nom: t.commandes.acheteur_nom,
    clients: null,
    ...resumeLignes(t.commandes.commande_lignes ?? []),
    _type: 'commande' as const,
    venduePar: t.commandes.beatmakers?.nom_artiste ?? null,
    numeroFactureVendeur: t.facture_numero,
  }))

  const toutes: CommandeRow[] = [...commandes, ...tentativesRows, ...ventesCollab].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <CommandesClient
      commandes={toutes}
      initialClientId={clientId}
      initialType={type}
    />
  )
}
