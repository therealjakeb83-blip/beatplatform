-- ============================================================
-- PHASE 5.7 — Combinaisons entre workflows d'Automatisations
-- ============================================================
-- 1 seul nouveau type : la seule vraie combo qui a survécu à la revue
-- (docs/automatisations/combinaisons-5.7.md) est Achat + Bienvenue abo.
-- Toutes les autres combinaisons se résolvent par domination/silence entre
-- recettes déjà existantes, sans nouveau type. Migration additive sur le
-- CHECK existant (comme les précédentes) — uniquement sur `automatisations`
-- (config éditable par le beatmaker) : la combo n'est jamais déposée comme
-- un événement brut dans `automatisation_evenements`, elle est dérivée à la
-- résolution à partir des événements bienvenue_abonnement/remerciement_*
-- déjà existants — pas besoin d'étendre son CHECK.

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
    'bienvenue_perso', 'relance_inactivite', 'follow_up_free_download', 'follow_up_favori',
    'combo_achat_abonnement_bienvenue'
  ));
