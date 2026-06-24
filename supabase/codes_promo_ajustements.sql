-- Supprimer la colonne exclure_promotions (feature retirée)
ALTER TABLE codes_promo DROP COLUMN IF EXISTS exclure_promotions;
