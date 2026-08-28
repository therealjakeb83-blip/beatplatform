-- ============================================================
-- PHASE 4 (refonte 9 bis) — correction : politique RLS d'insertion
-- manquante sur boutique_pages_legales_historique
-- ============================================================
-- boutique_pages_legales_historique.sql (phase4_snapshot_transactionnel.sql)
-- n'avait qu'une politique SELECT — le GRANT INSERT seul ne suffit pas avec
-- RLS activé, il faut une vraie politique d'insertion. Résultat : l'archivage
-- échouait silencieusement à chaque modification de page légale depuis le
-- déploiement de la Phase 4 (l'erreur était catchée et juste loguée, sans
-- bloquer l'enregistrement principal — découvert en testant T0 le 2026-08-28).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

create policy "boutique_pages_legales_historique_beatmaker_insert" on boutique_pages_legales_historique
  for insert with check (beatmaker_id = auth.uid());
