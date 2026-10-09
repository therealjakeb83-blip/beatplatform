// Consentement newsletter PAR BOUTIQUE, porté par leads.newsletter_statut.
// Aucun drapeau global : un client peut être inscrit chez A et désinscrit chez B.
//   inscrit     : a dit oui à cette boutique
//   non_inscrit : n'a jamais dit oui ni non
//   desinscrit  : a dit non — seul le client lui-même peut revenir à « inscrit »
export type StatutNewsletter = 'inscrit' | 'non_inscrit' | 'desinscrit'

export type OrigineStatutNewsletter =
  | 'formulaire'
  | 'paiement'
  | 'free_download'
  | 'mon_compte'
  | 'inscription_compte'
  | 'lien_desinscription'
  | 'beatmaker'

export type SourceLead = 'visite' | 'newsletter' | 'free_download' | 'achat' | 'manuel'

export const LIBELLE_STATUT_NEWSLETTER: Record<StatutNewsletter, string> = {
  inscrit: 'Inscrit',
  non_inscrit: 'Non inscrit',
  desinscrit: 'Désinscrit',
}

export function normaliserStatut(v: unknown): StatutNewsletter {
  return v === 'inscrit' || v === 'desinscrit' ? v : 'non_inscrit'
}

// Règles d'envoi : transactionnel = toujours (aucune vérification ici)
export function peutRecevoirCampagne(statut: StatutNewsletter): boolean {
  return statut === 'inscrit'
}
export function peutRecevoirAutomatisation(statut: StatutNewsletter): boolean {
  return statut !== 'desinscrit'
}

// Contact fusionné dans le CRM : le choix exprimé le plus récemment l'emporte
// (un « non » ancien ne bloque pas un « oui » donné ensuite, et inversement).
export function statutFusionne(
  leads: { newsletter_statut: string | null; newsletter_statut_at: string | null }[],
): StatutNewsletter {
  let meilleur: { statut: StatutNewsletter; at: number } | null = null
  for (const l of leads) {
    const statut = normaliserStatut(l.newsletter_statut)
    if (statut === 'non_inscrit') continue
    const at = l.newsletter_statut_at ? new Date(l.newsletter_statut_at).getTime() : 0
    if (!meilleur || at >= meilleur.at) meilleur = { statut, at }
  }
  return meilleur?.statut ?? 'non_inscrit'
}

// Inscription groupée par le beatmaker (import lot 3) : case obligatoire,
// texte enregistré tel quel dans la trace (inscriptions_newsletter_groupees).
export const TEXTE_CONFIRMATION_INSCRIPTION_GROUPEE =
  "Je confirme que ces contacts m'ont donné leur accord pour recevoir ma newsletter, et que je peux le prouver si besoin."
