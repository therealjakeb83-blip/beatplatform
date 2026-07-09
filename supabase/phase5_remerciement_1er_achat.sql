-- ============================================================
-- PHASE 5 — Automatisation "Remerciement achat — 1er achat" (5.6d, partie 1)
-- ============================================================
-- Nouveau type d'automatisation (migration additive sur les CHECK existants)

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso', 'remerciement_1er_achat'));

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_check;
ALTER TABLE automatisation_evenements ADD CONSTRAINT automatisation_evenements_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso', 'remerciement_1er_achat'));
