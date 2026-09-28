-- ============================================================
-- PHASE 12 — LOT 4 : feu vert, contrat, emails, Stripe
-- À exécuter dans l'éditeur SQL Supabase, en UNE seule fois (une transaction).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Emails « Mails My Producer » : les 5 emails de collaboration du lot 3
--    (jusque-là en texte brut) + 3 nouveaux (beat supprimé, pause, mise à
--    jour des conditions). Retire les 3 types devenus inutiles depuis le
--    ménage du lot 1 (fonds en attente / rappel / expiration) — leurs
--    éventuelles lignes de personnalisation sont supprimées d'abord.
-- ------------------------------------------------------------
DELETE FROM templates_plateforme
 WHERE type IN ('collab_fonds_attente', 'collab_rappel_fonds', 'collab_expiration');

ALTER TABLE templates_plateforme DROP CONSTRAINT IF EXISTS templates_plateforme_type_check;
ALTER TABLE templates_plateforme ADD CONSTRAINT templates_plateforme_type_check CHECK (type IN (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour'
));

COMMIT;

-- ============================================================
-- VÉRIFICATIONS À LANCER APRÈS (lecture seule) :
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--  where conname = 'templates_plateforme_type_check';
--  -- doit lister les 16 types, dont collab_pause et conditions_mise_a_jour
