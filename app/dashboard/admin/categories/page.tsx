import { createAdminClient } from '@/utils/supabase/admin'
import type { CategorieRow, TypeCategorie } from '@/lib/categories'
import { agregerStatsParCategorie, statsPour } from '@/lib/categories-stats'
import {
  approuverCertificationGroupe,
  rejeterCertificationGroupe,
  ajouterCategoriePlateforme,
  supprimerCategoriePlateforme,
} from './_lib/actions'
import AdminCategoriesClient from './_components/AdminCategoriesClient'

export default async function AdminCategoriesPage() {
  // Vue plateforme-wide (toutes boutiques) — nécessite le service_role, la
  // RLS d'un beatmaker (même admin) ne remonte que ses propres catégories
  // perso en plus du catalogue plateforme/certifié.
  const admin = createAdminClient()

  const [{ data }, { data: demandesRaw }, { data: beatsData }, { data: lignesData }, { data: playsData }] = await Promise.all([
    admin.from('categories').select('id, type, nom, source, beatmaker_id, statut, image_url, beatmakers(nom_artiste)').order('nom'),
    // Demandes en attente : nom/type dénormalisés (Phase 7.10) — pas besoin
    // de la catégorie d'origine, elle peut avoir été fusionnée/supprimée.
    admin.from('demandes_certification')
      .select('id, nom, type, beatmaker_id, beatmakers(nom_artiste)')
      .eq('statut', 'en_attente')
      .order('created_at', { ascending: true }),
    admin.from('beats').select('id, styles, ambiances, instruments, type_beat'),
    admin.from('commande_lignes')
      .select('beat_id, prix_paye, reduction_montant, commandes!inner(statut)')
      .eq('commandes.statut', 'payee'),
    admin.from('beat_plays').select('beat_id'),
  ])

  const statsParTag = agregerStatsParCategorie(beatsData ?? [], lignesData ?? [], playsData ?? [])

  const categories = ((data ?? []) as unknown as (CategorieRow & { beatmakers: { nom_artiste: string } | null })[])
    .map(c => ({ ...c, nom_artiste: c.beatmakers?.nom_artiste ?? null, ...statsPour(statsParTag, c.type, c.nom) }))

  // Regroupe par (type, nom en minuscules) : "Jerk"/"JERK"/"jerk" partagent
  // une seule ligne dans la file de modération, quel que soit le nombre de
  // beatmakers qui l'ont demandée séparément.
  type DemandeJoin = { id: string; nom: string; type: TypeCategorie; beatmaker_id: string; beatmakers: { nom_artiste: string } | null }
  type Groupe = { type: TypeCategorie; nom: string; demandeurs: string[]; nb_demandes: number; variantes: Set<string> }
  const groupes = new Map<string, Groupe>()
  for (const d of (demandesRaw ?? []) as unknown as DemandeJoin[]) {
    const cle = `${d.type}|${d.nom.toLowerCase()}`
    const g = groupes.get(cle) ?? { type: d.type, nom: d.nom, demandeurs: [], nb_demandes: 0, variantes: new Set<string>() }
    g.nb_demandes += 1
    g.variantes.add(d.nom)
    if (d.beatmakers?.nom_artiste) g.demandeurs.push(d.beatmakers.nom_artiste)
    groupes.set(cle, g)
  }

  const demandes = [...groupes.values()].map(g => {
    const stats = [...g.variantes].reduce((acc, nom) => {
      const s = statsPour(statsParTag, g.type, nom)
      return {
        nb_beats: acc.nb_beats + s.nb_beats, ventes: acc.ventes + s.ventes,
        ca_net: acc.ca_net + s.ca_net, ecoutes: acc.ecoutes + s.ecoutes,
      }
    }, { nb_beats: 0, ventes: 0, ca_net: 0, ecoutes: 0 })
    return { type: g.type, nom: g.nom, demandeurs: g.demandeurs, nb_demandes: g.nb_demandes, ...stats }
  })

  return (
    <AdminCategoriesClient
      categories={categories}
      demandes={demandes}
      approuverCertificationGroupe={approuverCertificationGroupe}
      rejeterCertificationGroupe={rejeterCertificationGroupe}
      ajouterCategoriePlateforme={ajouterCategoriePlateforme}
      supprimerCategoriePlateforme={supprimerCategoriePlateforme}
    />
  )
}
