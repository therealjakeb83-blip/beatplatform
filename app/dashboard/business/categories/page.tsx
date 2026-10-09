import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import type { CategorieRow } from '@/lib/categories'
import { agregerStatsParCategorie, statsPour } from '@/lib/categories-stats'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'
import { evenementsParBeat } from '@/lib/analytics-evenements'
import { createAdminClient } from '@/utils/supabase/admin'
import { demanderCertification, annulerDemandeCertification, supprimerCategoriePersonnelle, renommerCategoriePerso } from './_lib/actions'
import CategoriesClient from './_components/CategoriesClient'

export default async function CategoriesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [
    categoriesRaw,
    { data: overridesRaw },
    { data: demandesRaw },
    beatsData,
    lignesData,
    ecoutes,
  ] = await Promise.all([
    toutesLesLignes((debut, fin) => supabase.from('categories').select('id, type, nom, source, beatmaker_id, statut, image_url').order('nom').order('id').range(debut, fin)),
    supabase.from('categories_images_boutique').select('categorie_id, image_url').eq('beatmaker_id', user.id),
    // Demandes en attente vivent dans leur propre table (Phase 7.9) — plus
    // dans categories.statut, pour garder l'historique des rejets.
    supabase.from('demandes_certification').select('categorie_id').eq('beatmaker_id', user.id).eq('statut', 'en_attente'),
    // Scope propre boutique — contrairement à l'admin (plateforme-wide),
    // ces stats ne portent que sur les beats de ce beatmaker.
    toutesLesLignes((debut, fin) => supabase.from('beats').select('id, styles, ambiances, instruments, type_beat').eq('beatmaker_id', user.id).order('id').range(debut, fin)),
    toutesLesLignes((debut, fin) => supabase.from('commande_lignes')
      .select('beat_id, prix_paye, reduction_montant, commandes!inner(statut, beatmaker_id)')
      .eq('commandes.statut', 'payee')
      .eq('commandes.beatmaker_id', user.id)
      .order('id')
      .range(debut, fin)),
    // Écoutes comptées dans la base (fonction réservée au serveur → client admin, boutique = user.id)
    evenementsParBeat(createAdminClient(), user.id, null, null),
  ])

  const statsParTag = agregerStatsParCategorie(beatsData, lignesData, new Map([...ecoutes].map(([id, e]) => [id, e.ecoutes])))
  const overrides = new Map((overridesRaw ?? []).map(o => [o.categorie_id, o.image_url as string]))
  const demandesEnAttente = new Set((demandesRaw ?? []).map(d => d.categorie_id as string))

  const categories = ((categoriesRaw ?? []) as CategorieRow[]).map(c => ({
    ...c,
    ...statsPour(statsParTag, c.type, c.nom),
    image_override: overrides.get(c.id) ?? null,
    demande_en_attente: demandesEnAttente.has(c.id),
  }))

  return (
    <CategoriesClient
      categories={categories}
      beatmakerId={user.id}
      demanderCertification={demanderCertification}
      annulerDemandeCertification={annulerDemandeCertification}
      supprimerCategoriePersonnelle={supprimerCategoriePersonnelle}
      renommerCategoriePerso={renommerCategoriePerso}
    />
  )
}
