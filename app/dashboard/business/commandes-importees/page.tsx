import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { chargerGroupesTitres } from '@/lib/import-externe/liens-beats'
import { redirect } from 'next/navigation'
import { aAccesPlanPayant } from '@/lib/acces-plan'
import { toutesLesLignes } from '@/app/dashboard/business/_lib/requetes'
import { SELECT_DETAIL, versDetail, type CommandeDetailBrute } from '@/app/dashboard/business/_lib/commandes-externes'
import CommandesImporteesClient, { type ImportHistorique } from './_components/CommandesImporteesClient'

// Commandes importées d'autres plateformes (BeatStars…) : liste, historique
// des imports (annulables), bouton d'import. Lues UNIQUEMENT par le CRM.
// Plan Free : consulter et annuler OK, importer verrouillé (décision 21).
export default async function CommandesImporteesPage({
  searchParams,
}: {
  searchParams: Promise<{ importer?: string }>
}) {
  const { importer } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')
  const beatmakerId = user.id

  const [planPayant, { groupes }, importsRes, brutes] = await Promise.all([
    aAccesPlanPayant(supabase, beatmakerId),
    chargerGroupesTitres(createAdminClient(), beatmakerId),
    supabase
      .from('imports_externes')
      .select('id, created_at, plateforme, nom_fichier, nom_vendeur, devise, periode_debut, periode_fin, nb_commandes, nb_lignes, nb_contacts_crees, nb_rejetees, total_depense, total_depense_eur, statut, annule_at, annulation_rapport')
      .eq('beatmaker_id', beatmakerId)
      .order('created_at', { ascending: false }),
    toutesLesLignes<CommandeDetailBrute>((debut, fin) => supabase
      .from('commandes_externes')
      .select(SELECT_DETAIL)
      .eq('beatmaker_id', beatmakerId)
      .order('date_vente', { ascending: false })
      .order('id')
      .range(debut, fin) as unknown as PromiseLike<{ data: CommandeDetailBrute[] | null; error: unknown }>),
  ])

  if (importsRes.error) console.error('[commandes-importees] imports:', importsRes.error)

  const imports: ImportHistorique[] = (importsRes.data ?? []).map(i => ({
    ...i,
    total_depense: Number(i.total_depense),
    total_depense_eur: Number(i.total_depense_eur),
    annulation_rapport: i.annulation_rapport as ImportHistorique['annulation_rapport'],
  }))

  return (
    <CommandesImporteesClient
      commandes={brutes.map(versDetail)}
      imports={imports}
      planPayant={planPayant}
      nbTitresNonRelies={groupes.filter(g => g.decision === 'a_traiter').length}
      nbTitres={groupes.length}
      ouvrirImport={importer === '1'}
    />
  )
}
