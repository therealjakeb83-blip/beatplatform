export type TypeCategorie = 'styles' | 'ambiances' | 'instruments' | 'type_beat'

// Types hybrides (ajout libre + certification) — Ambiances/Instruments
// restent fixés par la plateforme (lecture seule), voir ROADMAP.md Phase 7.
export const TYPES_HYBRIDES: TypeCategorie[] = ['styles', 'type_beat']

export type CategorieRow = {
  id: string
  type: TypeCategorie
  nom: string
  source: 'plateforme' | 'beatmaker'
  beatmaker_id: string | null
  statut: 'active' | 'en_attente_certification' | 'certifiee'
}

export type CategorieOptions = { certifiees: string[]; perso: string[] }

// Options visibles par ce beatmaker pour chaque type de tag (utilisé par
// BeatForm), séparées en deux pools : `certifiees` (catalogue plateforme +
// tout ce qui a été certifié, peu importe qui l'a soumis à l'origine) et
// `perso` (ses propres catégories pas encore certifiées). Respecte déjà la
// RLS (source=plateforme OR beatmaker_id=auth.uid() OR statut=certifiee)
// — un beatmaker-id ne peut donc jamais apparaître ici que si c'est le sien,
// pas besoin de le filtrer explicitement. Appelable avec un client RLS-bound.
export async function chargerOptionsCategories(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<{ styles: CategorieOptions; ambiances: CategorieOptions; instruments: CategorieOptions; typeBeat: CategorieOptions }> {
  const { data } = await supabase.from('categories').select('type, nom, source, statut').order('nom')
  const rows = (data ?? []) as { type: TypeCategorie; nom: string; source: 'plateforme' | 'beatmaker'; statut: string }[]

  const parType = (type: TypeCategorie): CategorieOptions => {
    const deType = rows.filter(r => r.type === type)
    return {
      certifiees: [...new Set(deType.filter(r => r.source === 'plateforme' || r.statut === 'certifiee').map(r => r.nom))],
      perso: [...new Set(deType.filter(r => r.source === 'beatmaker' && r.statut !== 'certifiee').map(r => r.nom))],
    }
  }

  return {
    styles: parType('styles'),
    ambiances: parType('ambiances'),
    instruments: parType('instruments'),
    typeBeat: parType('type_beat'),
  }
}

// Insère en `categories` (source=beatmaker) les tags Styles/Type beat que le
// beatmaker vient de taper à la main sur un beat et qui n'existent pas
// encore pour lui — jamais pour Ambiances/Instruments (lecture seule).
// ON CONFLICT DO NOTHING : idempotent, pas grave si le tag existe déjà
// (course entre deux beats sauvegardés en parallèle, ou tag déjà présent).
export async function synchroniserCategoriesPersonnalisees(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  beatmakerId: string,
  valeurs: { styles?: string[]; typeBeat?: string[] },
): Promise<void> {
  const lignes: { type: TypeCategorie; nom: string; source: 'beatmaker'; beatmaker_id: string }[] = []
  for (const nom of valeurs.styles ?? []) lignes.push({ type: 'styles', nom, source: 'beatmaker', beatmaker_id: beatmakerId })
  for (const nom of valeurs.typeBeat ?? []) lignes.push({ type: 'type_beat', nom, source: 'beatmaker', beatmaker_id: beatmakerId })
  if (lignes.length === 0) return

  const { error } = await supabase.from('categories').upsert(lignes, {
    onConflict: 'type,nom,beatmaker_id',
    ignoreDuplicates: true,
  })
  if (error) console.error('[categories] Erreur synchronisation catégories personnalisées:', JSON.stringify(error))
}
