-- ============================================================
-- Correction : politique RLS d'insertion manquante sur
-- licences_textes_historique
-- ============================================================
-- Même bug que boutique_pages_legales_historique en Phase 4 (voir
-- phase4_fix_rls_historique.sql) : le GRANT INSERT seul ne suffit pas avec
-- RLS activé, il faut une vraie politique. L'archivage échouait
-- silencieusement à chaque modification de texte de licence depuis le
-- déploiement — découvert en testant avec Jake le 2026-09-09 (la comparaison
-- "ancien texte" affichait "aucune version précédente" alors qu'il y en
-- avait une).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

CREATE POLICY "licences_textes_historique_beatmaker_insert" ON licences_textes_historique
  FOR INSERT WITH CHECK (beatmaker_id = auth.uid());
