// Normalisation email — appliquée à l'écriture (avant stockage) et à la
// comparaison, pour qu'une majuscule tapée par erreur ne casse jamais un
// rapprochement (connexion, restriction de code promo, etc).

export function normaliserEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export function normaliserEmails(emails: string[] | null | undefined): string[] {
  return (emails ?? []).map(normaliserEmail).filter(Boolean)
}
