-- ============================================================
-- ÉTAPE 8b (suite) — Indicateur "annulation prévue" sur l'abonnement plateforme
-- ============================================================
-- Découvert en test le 2026-07-24 : annuler pendant l'essai ne résilie pas
-- immédiatement côté Stripe (subscription.status reste "trialing",
-- subscription.cancel_at programmé pour la fin d'essai) — sans indicateur,
-- la fiche affichait "en_essai" comme si de rien n'était. Même limitation
-- que subscription.cancel_at_period_end pour un abonnement déjà payant.

alter table abonnements_plateforme add column if not exists annulation_prevue_le timestamptz;
