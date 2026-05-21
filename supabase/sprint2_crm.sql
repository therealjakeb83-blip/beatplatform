-- ============================================================
-- Sprint 2 CRM — Nouvelles colonnes
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. type_commande sur commandes
--    LICENCE = achat beat, CREATION_ABONNEMENT = premier paiement abo,
--    RENOUVELLEMENT = mensualité automatique
ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS type_commande text
  CHECK (type_commande IN ('LICENCE', 'CREATION_ABONNEMENT', 'RENOUVELLEMENT'));

-- Toutes les commandes existantes sont des licences
UPDATE commandes SET type_commande = 'LICENCE' WHERE type_commande IS NULL;

-- 2. beat_id et licence_id rendus nullable
--    Nécessaire pour créer des commandes d'abonnement sans beat/licence attaché
ALTER TABLE commandes ALTER COLUMN beat_id DROP NOT NULL;
ALTER TABLE commandes ALTER COLUMN licence_id DROP NOT NULL;

-- 3. stripe_session_id sur commandes (si pas encore présent)
ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS stripe_session_id text;

-- 4. mensualites_payees sur abonnements_boutique
--    Compteur réel de paiements encaissés (webhook invoice.payment_succeeded)
ALTER TABLE abonnements_boutique
  ADD COLUMN IF NOT EXISTS mensualites_payees integer NOT NULL DEFAULT 0;

-- 5. instagram sur clients (rempli par le beatmaker dans sa fiche CRM)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS instagram text;

-- 6. newsletter_consent sur clients (opt-in à l'inscription ou dans mon-compte)
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS newsletter_consent boolean NOT NULL DEFAULT false;
