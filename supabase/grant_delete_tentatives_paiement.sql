-- ============================================================
-- Grant DELETE manquant sur tentatives_paiement
-- ============================================================
-- Découvert le 2026-08-31 : la migration d'origine (phase2b_tentatives_paiement.sql)
-- n'accordait que SELECT/INSERT/UPDATE à service_role, jamais DELETE — un
-- script de nettoyage de données de test a échoué silencieusement (erreur
-- non vérifiée côté script), laissant une ligne de test visible sur un vrai
-- compte. Voir memory/project_echecs_paiement_abonnement_plateforme.md.

GRANT DELETE ON public.tentatives_paiement TO service_role;
