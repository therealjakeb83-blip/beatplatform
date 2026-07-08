-- ============================================================
-- PHASE 5 — Automatisation "Churn message perso" (5.6c)
-- ============================================================
-- Nouveau type d'automatisation (migration additive sur les CHECK existants)

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso'));

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_check;
ALTER TABLE automatisation_evenements ADD CONSTRAINT automatisation_evenements_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso'));
