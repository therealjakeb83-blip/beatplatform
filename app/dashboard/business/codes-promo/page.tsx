import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import CodesPromoClient from './_components/CodesPromoClient'

export type CodePromoRow = {
  id: string
  beatmaker_id: string
  code: string
  description: string | null
  type_remise: 'panier' | 'produit' | 'abonnement'
  type_valeur: 'pourcentage' | 'montant'
  valeur: number
  mensualites: number | null
  date_debut: string | null
  date_expiration: string | null
  depense_min: number | null
  depense_max: number | null
  premiere_commande: boolean
  utilisation_individuelle: boolean
  beats_inclus: string[] | null
  beats_exclus: string[]
  licences_eligibles: string[] | null
  emails_autorises: string[]
  emails_exclus: string[]
  limite_par_code: number | null
  limite_par_article: number | null
  limite_par_utilisateur: number | null
  utilisations: number
  statut: 'actif' | 'inactif' | 'expire'
  stripe_coupon_id: string | null
  stripe_promotion_code_id: string | null
  created_at: string
}

export type LicenceOption = { id: string; nom: string; modele: string }
export type BeatOption    = { id: string; titre: string; couleur: string | null; statut: string }

export default async function CodesPromoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const admin = createAdminClient()

  const [{ data: rawCodes }, { data: rawLicences }, { data: rawBeats }] = await Promise.all([
    admin.from('codes_promo').select('*').eq('beatmaker_id', user.id).order('created_at', { ascending: false }),
    admin.from('licences').select('id, nom, modele').eq('beatmaker_id', user.id).eq('actif', true).order('ordre'),
    admin.from('beats').select('id, titre, couleur, statut').eq('beatmaker_id', user.id).is('supprime_le', null).in('statut', ['public', 'prive']).order('created_at', { ascending: false }).limit(200),
  ])

  return (
    <CodesPromoClient
      codes={(rawCodes ?? []) as CodePromoRow[]}
      licences={(rawLicences ?? []) as LicenceOption[]}
      beats={(rawBeats ?? []) as BeatOption[]}
    />
  )
}
