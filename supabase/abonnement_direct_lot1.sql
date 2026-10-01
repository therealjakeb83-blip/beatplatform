-- Abonnements boutique en paiement direct (lot 1, 2026-10-01).
-- L'abonnement vit désormais sur le compte Stripe du beatmaker (direct
-- charge), plus sur celui de la plateforme. À exécuter AVANT de pousser le
-- code qui lit ces colonnes.

BEGIN;

-- Compte Stripe sur lequel vit l'abonnement (NULL = ancien abonnement créé
-- sur la plateforme, avant ce lot). Toute action Stripe (annuler, reprendre,
-- portail, pause) passe par ce compte, jamais par le compte actuel du
-- beatmaker (qui peut avoir changé depuis la souscription).
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS stripe_account_id text;

-- Compte Stripe sur lequel existe beatmakers.stripe_product_id (produit
-- « abonnement » du beatmaker). Différent du compte actuel = produit à
-- recréer sur le compte du beatmaker.
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS stripe_produit_compte text;

COMMIT;

-- Contrôle (à lancer après) :
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE (table_name = 'abonnements_boutique' AND column_name = 'stripe_account_id')
--    OR (table_name = 'beatmakers' AND column_name = 'stripe_produit_compte');
