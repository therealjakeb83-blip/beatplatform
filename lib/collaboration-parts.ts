// Calculette des parts d'une vente collaborative — tout en CENTIMES entiers,
// aucune valeur décimale (Phase 12, décisions du 2026-09-21).
//
// Règles :
//   - A + 3 collaborateurs au maximum
//   - chaque part (A compris) vaut au moins 10 % ET au moins 1 €
//   - prix plancher d'un beat = 1 € / plus petite part
//   - les remises ne peuvent pas faire descendre le prix sous ce plancher,
//     SAUF pour arriver à 0 € (beat offert volontairement par A)
//   - un prix à 0 € n'a ni encaissement ni parts
//   - invariant : la somme des parts est TOUJOURS égale au prix, au centime près

export const PART_MIN_POURCENT = 10
export const PART_MIN_CENTIMES = 100
export const MAX_COLLABORATEURS = 3
export const MAX_PARTICIPANTS = MAX_COLLABORATEURS + 1

// `id` sert à retrouver chaque part dans le résultat. Toujours placer A en
// premier dans la liste : à reste égal, c'est lui qui reçoit le centime restant
// (règle fixe, le résultat est toujours identique pour les mêmes entrées).
export type Participant = { id: string; pourcentage: number }

export type ResultatValidation = { ok: true } | { ok: false; erreur: string }

export function validerRepartition(participants: Participant[]): ResultatValidation {
  if (participants.length < 1) return { ok: false, erreur: 'Il faut au moins un participant.' }
  if (participants.length > MAX_PARTICIPANTS) {
    return { ok: false, erreur: `Un beat accepte au maximum ${MAX_COLLABORATEURS} collaborateurs (plus toi).` }
  }
  for (const p of participants) {
    if (!Number.isInteger(p.pourcentage)) return { ok: false, erreur: 'Chaque part doit être un nombre entier de pourcents.' }
    if (participants.length > 1 && p.pourcentage < PART_MIN_POURCENT) {
      return { ok: false, erreur: `Chaque part doit valoir au moins ${PART_MIN_POURCENT} %.` }
    }
  }
  const total = participants.reduce((s, p) => s + p.pourcentage, 0)
  if (total !== 100) return { ok: false, erreur: `Le total des parts doit faire 100 % (actuellement ${total} %).` }
  return { ok: true }
}

/**
 * Répartit `prixCents` entre les participants selon leur pourcentage.
 * Méthode du plus grand reste : chacun reçoit la partie entière de sa part, puis
 * les centimes restants vont à ceux dont le reste est le plus grand (égalité :
 * l'ordre de la liste, donc A d'abord). La somme est toujours exactement le prix.
 */
export function repartirCentimes(prixCents: number, participants: Participant[]): { id: string; centimes: number }[] {
  if (!Number.isInteger(prixCents) || prixCents < 0) throw new Error('Le prix doit être un nombre entier de centimes, positif ou nul.')
  const validation = validerRepartition(participants)
  if (!validation.ok) throw new Error(validation.erreur)

  const parts = participants.map((p, index) => {
    const numerateur = prixCents * p.pourcentage
    return { id: p.id, index, base: Math.floor(numerateur / 100), reste: numerateur % 100 }
  })
  const sommeBases = parts.reduce((s, p) => s + p.base, 0)
  const aDistribuer = prixCents - sommeBases

  const ordre = [...parts].sort((a, b) => b.reste - a.reste || a.index - b.index)
  const bonus = new Set(ordre.slice(0, aDistribuer).map(p => p.index))

  return parts.map(p => ({ id: p.id, centimes: p.base + (bonus.has(p.index) ? 1 : 0) }))
}

/** Prix plancher d'un beat en centimes : 1 € divisé par la plus petite part, arrondi au centime supérieur. */
export function plancherPrixCents(participants: Participant[]): number {
  if (participants.length <= 1) return 0
  const plusPetite = Math.min(...participants.map(p => p.pourcentage))
  return Math.ceil((PART_MIN_CENTIMES * 100) / plusPetite)
}

/** Vrai si ce prix est autorisé pour ce beat : 0 € (offert) ou au moins le plancher. */
export function prixAutorise(prixCents: number, plancherCents: number): boolean {
  return prixCents === 0 || prixCents >= plancherCents
}

/**
 * Applique une remise (déjà calculée en centimes) sans passer sous le plancher.
 * Exception : si la remise ramène le prix à 0 (remise de 100 %, décision de A).
 */
export function appliquerRemiseAvecPlancher(
  prixCents: number,
  remiseCents: number,
  plancherCents: number,
): { prixFinalCents: number; remiseAppliqueeCents: number; remiseLimitee: boolean } {
  const remise = Math.max(0, Math.min(remiseCents, prixCents))
  const prixApres = prixCents - remise

  if (prixApres === 0 || plancherCents <= 0 || prixApres >= plancherCents) {
    return { prixFinalCents: prixApres, remiseAppliqueeCents: remise, remiseLimitee: false }
  }
  // Le prix final ne peut pas descendre sous le plancher (ni rester au-dessus du prix de départ).
  const prixFinal = Math.min(prixCents, plancherCents)
  return { prixFinalCents: prixFinal, remiseAppliqueeCents: prixCents - prixFinal, remiseLimitee: true }
}

/** Contrôle final avant encaissement : chaque part réellement calculée vaut au moins 1 €. */
export function controlerParts(prixCents: number, participants: Participant[]): ResultatValidation {
  if (prixCents === 0) return { ok: true }
  const parts = repartirCentimes(prixCents, participants)
  if (participants.length > 1 && parts.some(p => p.centimes < PART_MIN_CENTIMES)) {
    return { ok: false, erreur: 'Une part serait inférieure à 1 € : prix trop bas pour cette répartition.' }
  }
  return { ok: true }
}

/**
 * Décompose la part TTC d'un vendeur en HT + TVA selon SON propre taux (TVA
 * toujours absorbée : le prix payé est TTC, la TVA n'est qu'extraite).
 * Invariant : ht + tva = ttc, au centime près. Taux 0/null : pas de TVA.
 */
export function decomposerTva(partTtcCents: number, tauxPourcent: number | null): { htCents: number; tvaCents: number } {
  if (!tauxPourcent || tauxPourcent <= 0) return { htCents: partTtcCents, tvaCents: 0 }
  const htCents = Math.round((partTtcCents * 100) / (100 + tauxPourcent))
  return { htCents, tvaCents: partTtcCents - htCents }
}
