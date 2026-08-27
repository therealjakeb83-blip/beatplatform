// Identité sur le relevé bancaire (statement descriptor) — réglage Niveau A
// explicite à l'onboarding (Grill Me 2026-08-08 : vérifié que la Direct
// Charge utilise bien le descriptor du compte Stripe connecté, pas celui de
// la plateforme). Règles de validation Stripe : 5 à 22 caractères, au moins
// une lettre, aucun des caractères < > \ ' " *.

const CARACTERES_INTERDITS = /[<>\\'"*]/

export type ValidationDescripteur = { ok: true } | { ok: false; erreur: string }

export function validerStatementDescriptor(valeur: string): ValidationDescripteur {
  const v = valeur.trim()
  if (v.length < 5 || v.length > 22) {
    return { ok: false, erreur: 'Doit contenir entre 5 et 22 caractères.' }
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(v)) {
    return { ok: false, erreur: 'Doit contenir au moins une lettre.' }
  }
  if (CARACTERES_INTERDITS.test(v)) {
    return { ok: false, erreur: 'Ne peut pas contenir les caractères < > \\ \' " *' }
  }
  return { ok: true }
}
