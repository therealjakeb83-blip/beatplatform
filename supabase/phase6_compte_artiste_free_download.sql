-- ============================================================
-- PHASE 6.8/6.9 — Confirmation de compte artiste + Free download
-- ============================================================
-- Migration additive sur le CHECK existant (même pattern que les
-- précédentes). Trous de scope découverts le 2026-07-17 :
-- - confirmation_compte_artiste : aujourd'hui seul l'email générique de
--   confirmation Supabase Auth est envoyé après /artiste/inscription,
--   jamais un email brandé de bienvenue (voir app/auth/callback/route.ts).
-- - telechargement_gratuit : le mail existait déjà (app/api/free-download)
--   mais en HTML codé en dur, hors du système de branding transactionnel.

ALTER TABLE templates_transactionnels DROP CONSTRAINT templates_transactionnels_type_check;
ALTER TABLE templates_transactionnels ADD CONSTRAINT templates_transactionnels_type_check
  CHECK (type IN (
    'confirmation_commande',
    'confirmation_abonnement',
    'demande_annulation_abonnement',
    'annulation_abonnement',
    'confirmation_compte_artiste',
    'telechargement_gratuit',
    'beat_cadeau_fidelite'
  ));
