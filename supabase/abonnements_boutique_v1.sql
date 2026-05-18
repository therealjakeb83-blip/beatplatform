-- Étape 8 — Abonnements boutique V1
-- À exécuter dans Supabase SQL Editor

-- 1. abonnements_boutique : rend client_id nullable + ajoute colonnes email/trial
ALTER TABLE abonnements_boutique ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS acheteur_email text;
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS acheteur_nom text;
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS en_essai boolean NOT NULL DEFAULT false;
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS essai_fin_le timestamptz;

-- 2. beatmakers : ajoute la config du plan d'abonnement
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_actif boolean NOT NULL DEFAULT false;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_nom text;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_description text;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_prix integer; -- en centimes (ex: 699 = 6,99€)
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_remise_pct integer NOT NULL DEFAULT 30;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS abo_essai_jours integer NOT NULL DEFAULT 30;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS stripe_product_id text;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS stripe_price_id text;

-- 3. Grants service_role
GRANT SELECT, INSERT, UPDATE ON public.abonnements_boutique TO service_role;
GRANT UPDATE ON public.beatmakers TO service_role;

-- 4. Grant authenticated
GRANT SELECT, INSERT, UPDATE ON public.abonnements_boutique TO authenticated;
