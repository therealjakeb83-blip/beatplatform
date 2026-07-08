// Traduit une erreur technique Resend (JSON brut ou message d'exception) en
// explication compréhensible par un beatmaker non-développeur, avec une piste
// d'action concrète — jamais le JSON brut, qui ne lui dirait rien.
export function messageErreurNaturel(erreurBrute: string | null): string | null {
  if (!erreurBrute) return null

  let nom = ''
  let message = ''
  try {
    const parsed = JSON.parse(erreurBrute)
    nom = String(parsed?.name ?? '')
    message = String(parsed?.message ?? '')
  } catch {
    message = erreurBrute
  }

  const texte = `${nom} ${message}`.toLowerCase()

  if (texte.includes('not valid') && texte.includes('to')) {
    return "L'adresse email du destinataire est invalide (probablement une faute de frappe). Vérifie son adresse dans sa fiche contact et propose-lui de la corriger."
  }
  if (texte.includes('bounce')) {
    return "L'adresse email du destinataire a rejeté le message (boîte pleine, adresse inexistante ou désactivée). Vérifie l'adresse avec ton client."
  }
  if (nom === 'rate_limit_exceeded') {
    return "Trop d'emails ont été envoyés en peu de temps. Réessaie l'envoi dans quelques minutes."
  }
  if (nom === 'missing_api_key' || nom === 'invalid_api_key' || nom === 'restricted_api_key') {
    return "Problème de configuration technique côté plateforme. Contacte le support My Producer, ce n'est pas lié à ce client."
  }
  if (nom === 'application_error' || nom === 'internal_server_error') {
    return "Le service d'envoi a rencontré une erreur temporaire de son côté. Tu peux réessayer l'envoi, ce n'est probablement pas lié à ce client."
  }
  if (nom === 'invalid_parameter' || nom === 'validation_error') {
    return "Le service d'envoi a refusé cet email à cause d'une information invalide (adresse, sujet ou contenu). Vérifie l'adresse email du destinataire."
  }

  return `Échec de l'envoi pour une raison technique${nom ? ` (${nom})` : ''}. Tu peux réessayer avec le bouton renvoyer, ou vérifier l'adresse du destinataire.`
}
