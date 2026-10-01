-- Phase 13, lot 4a — correctif trouvé en T7 (2026-10-01).
-- commandes.montant_rembourse (euros) était un ENTIER depuis le schéma
-- d'origine : tout remboursement d'un montant à centimes (24,50 € = moitié
-- d'une vente collab, ou une vente solo à 29,99 €) était refusé par la base,
-- et la mise à jour du statut de la commande échouait avec lui. Passage en
-- décimal à 2 chiffres, comme prix_paye. Valeurs existantes inchangées ; les
-- contraintes (>= 0, <= prix_paye) restent valables.

BEGIN;
ALTER TABLE commandes ALTER COLUMN montant_rembourse TYPE numeric(10,2) USING montant_rembourse::numeric(10,2);
COMMIT;

-- Vérification (résultat attendu : numeric, 10, 2)
-- select data_type, numeric_precision, numeric_scale from information_schema.columns
--   where table_name = 'commandes' and column_name = 'montant_rembourse';
