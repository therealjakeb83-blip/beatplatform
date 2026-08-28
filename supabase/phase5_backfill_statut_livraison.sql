-- ============================================================
-- PHASE 5 — Correctif : backfill du statut de livraison historique
-- ============================================================
-- La migration précédente (phase5_statut_livraison.sql) a ajouté
-- statut_livraison avec une valeur par défaut 'en_cours', appliquée par
-- Postgres à TOUTES les lignes existantes au moment de l'ALTER TABLE — y
-- compris des commandes déjà livrées avant même l'existence de cette
-- colonne. Corrige ces commandes historiques d'après fichiers_livres
-- (déjà correct pour elles, jamais retouché depuis) ; les commandes créées
-- après le déploiement du nouveau code (lib/webhook-paiement.ts) ont déjà
-- leur vraie valeur et ne sont pas concernées par ce backfill.

update commandes
set statut_livraison = 'livree'
where fichiers_livres = true
  and statut_livraison = 'en_cours';
