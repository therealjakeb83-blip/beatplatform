-- ============================================================
-- FIX — automatisation_evenements : UNIQUE(type, reference_id) trop stricte
-- ============================================================
-- Découvert en testant Phase 5.7/5.9 (Test #8, 2026-07-16) : un même
-- abonnement qui repasse "en attente" une 2e fois (des mois plus tard, ou
-- même le même jour côté test) ne génère plus jamais d'événement, parce
-- qu'une ligne avec ce même (type, reference_id) existe déjà depuis la 1re
-- fois — même si elle est déjà traitée. Touche potentiellement
-- abonnement_en_attente, churn_message_perso, et toute future recette
-- keyed sur un id qui peut légitimement se répéter dans le temps.
--
-- Le vrai objectif de la contrainte d'origine : absorber les webhooks
-- Stripe redondants (retry) pour le MÊME épisode, avant que le cron n'ait
-- traité l'événement — pas empêcher toute réoccurrence future. Un index
-- unique partiel (uniquement parmi les événements non traités) couvre
-- exactement ça.

ALTER TABLE automatisation_evenements DROP CONSTRAINT automatisation_evenements_type_reference_id_key;

CREATE UNIQUE INDEX automatisation_evenements_type_reference_id_non_traite_idx
  ON automatisation_evenements (type, reference_id)
  WHERE NOT traite;
