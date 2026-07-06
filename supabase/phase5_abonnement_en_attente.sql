-- ============================================================
-- PHASE 5 — Automatisation "Abonnement en attente" (5.6b)
-- ============================================================

-- Récurrence du beat cadeau de fidélité, configurable par le beatmaker
-- (comme abo_prix/abo_remise_pct) — remplace le "tous les 4 mois" fixe.
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_recurrence_cadeau_mois integer NOT NULL DEFAULT 4
  CHECK (abo_recurrence_cadeau_mois > 0);

-- Horodatage du passage en 'impaye' — nécessaire pour calculer le délai de
-- grâce (1 mois) avant annulation automatique par le cron abonnements-impayes.
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS impaye_depuis timestamptz;

-- Nouveau type d'automatisation (migration additive sur les CHECK existants)
ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente'));

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_check;
ALTER TABLE automatisation_evenements ADD CONSTRAINT automatisation_evenements_type_check
  CHECK (type IN ('bienvenue_abonnement', 'abonnement_en_attente'));
