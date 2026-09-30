// Libellés des emails « Mails My Producer » (evenement `plateforme_*` dans
// email_logs) — partagés par les logs admin et les logs de chaque beatmaker.
export const LIBELLES_EVENEMENTS_PLATEFORME: Record<string, string> = {
  plateforme_confirmation_email: "Confirmation d'adresse email",
  plateforme_bienvenue: 'Bienvenue',
  plateforme_confirmation_essai: 'Confirmation essai',
  plateforme_rappel_fin_essai: "Rappel fin d'essai",
  plateforme_paiement_echoue: 'Paiement échoué',
  plateforme_annulation: 'Annulation',
  plateforme_suspension: 'Suspension de compte',
  plateforme_collab_invitation: 'Collab — invitation',
  plateforme_collab_acceptation: 'Collab — acceptation',
  plateforme_collab_refus: 'Collab — refus',
  plateforme_collab_retrait: 'Collab — invitation retirée',
  plateforme_collab_depart: 'Collab — départ',
  plateforme_collab_eviction: 'Collab — collaborateur retiré',
  plateforme_collab_beat_supprime: 'Collab — beat supprimé',
  plateforme_collab_pause: 'Collab — action requise',
  plateforme_conditions_mise_a_jour: 'Mise à jour des conditions',
  plateforme_nouvelle_vente: 'Nouvelle vente',
  plateforme_remboursement_vente: "Remboursement d'une vente",
  plateforme_remboursement_incomplet: 'Remboursement incomplet',
}
