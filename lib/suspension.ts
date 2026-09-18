// Motifs de suspension d'une boutique — liste fermée (Chantier 9 bis,
// Phase 10, décidée pendant le grill-me du 2026-08-08). L'admin choisit
// obligatoirement l'un de ces 6 motifs (contrainte CHECK en base, voir
// supabase/phase10_suspension_motif.sql) ; "autre" exige une précision
// écrite dans suspendu_raison, les 5 autres n'en ont pas besoin.

export type MotifSuspension = 'fraude' | 'securite' | 'legal' | 'illicite' | 'impaye_processeur' | 'autre'

export const MOTIFS_SUSPENSION: { valeur: MotifSuspension; label: string }[] = [
  { valeur: 'fraude', label: 'Fraude' },
  { valeur: 'securite', label: 'Problème de sécurité' },
  { valeur: 'legal', label: 'Motif légal' },
  { valeur: 'illicite', label: 'Contenu illicite' },
  { valeur: 'impaye_processeur', label: 'Signalement du processeur de paiement' },
  { valeur: 'autre', label: 'Autre' },
]

// Phrase affichée à l'admin (journal des décisions) et au beatmaker
// suspendu (page /dashboard/suspendu, email automatique).
export function libelleMotifSuspension(motif: string | null, precision: string | null): string {
  const trouve = MOTIFS_SUSPENSION.find(m => m.valeur === motif)
  const label = trouve?.label ?? motif ?? 'Non renseigné'
  if (motif === 'autre' && precision) return `${label} — ${precision}`
  return label
}
