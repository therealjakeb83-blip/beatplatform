-- ============================================================
-- PHASE 5 — 4 derniers workflows : Bienvenue perso, Relance inactivité,
-- Follow-up free download, Follow-up favori
-- ============================================================
-- Migration additive sur les CHECK existants (comme les précédentes).

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
    'bienvenue_perso', 'relance_inactivite', 'follow_up_free_download', 'follow_up_favori'
  ));

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_check;
ALTER TABLE automatisation_evenements ADD CONSTRAINT automatisation_evenements_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
    'bienvenue_perso', 'relance_inactivite', 'follow_up_free_download', 'follow_up_favori'
  ));
