-- ============================================================
-- PHASE 13 — LOT 5 (E5 + E6) : suppression de l'ancien système de partage
-- (fonds retenus par la plateforme puis transférés), remplacé par
-- commande_tranches depuis le lot 1.
--
-- ⚠️ À exécuter APRÈS que le code du lot 5 est déployé sur Vercel (ordre
-- inversé : l'ancien code lit encore split_payments à chaque vente).
-- IRRÉVERSIBLE. Données concernées = test uniquement (vérifié le 2026-10-01 :
-- 49 lignes split_payments « transfere », 22 commandes avec
-- stripe_transfer_group ; aucune vue, fonction ni clé étrangère dépendante).
-- Les commandes elles-mêmes ne sont PAS supprimées.
-- ============================================================

-- ------------------------------------------------------------
-- CONTRÔLE AVANT (lecture seule) — doit redonner 49 et 22
-- ------------------------------------------------------------
-- select (select count(*) from split_payments) as split_payments,
--        (select count(*) from commandes where stripe_transfer_group is not null) as commandes_ancien_systeme;

BEGIN;

DROP TABLE split_payments;
ALTER TABLE commandes DROP COLUMN stripe_transfer_group;

COMMIT;

-- ------------------------------------------------------------
-- VÉRIFICATION APRÈS (lecture seule) — doit renvoyer 0 et 0
-- ------------------------------------------------------------
-- select (select count(*) from information_schema.tables where table_name = 'split_payments') as table_restante,
--        (select count(*) from information_schema.columns where table_name = 'commandes' and column_name = 'stripe_transfer_group') as colonne_restante;
