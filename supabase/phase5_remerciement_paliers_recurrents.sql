-- ============================================================
-- PHASE 5 — Automatisation "Remerciement achat" — paliers récurrents (5.6d, partie 2)
-- ============================================================
-- 2e / 3e / 4e achat et + — complète "remerciement_1er_achat" (partie 1).

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus'
  ));

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_check;
ALTER TABLE automatisation_evenements ADD CONSTRAINT automatisation_evenements_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus'
  ));
