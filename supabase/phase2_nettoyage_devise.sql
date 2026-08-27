-- ============================================================
-- PHASE 2 (refonte 9 bis) — Nettoyage colonne devise (tâche 2.9)
-- ============================================================
-- commandes.devise : vérifié mort partout (toujours écrit 'EUR', jamais lu
-- nulle part — 5 points d'écriture + 8 points de lecture retirés du code).
--
-- IMPORTANT — pas les autres colonnes `devise` du schéma : `beatmakers`,
-- `abonnements_boutique` et `abonnements_plateforme` gardent leur colonne
-- `devise`, réellement lues et affichées (vérifié une par une avant de
-- toucher au code) :
--   - abonnements_boutique.devise → lu par lib/emails.ts (email de
--     confirmation) et /dashboard/admin/abonnements/[id]
--   - abonnements_plateforme.devise → affiché sur /dashboard/abonnement
--     (AbonnementPlateformeClient.tsx)
--   - beatmakers.devise → hors scope de cette tâche, pas auditée ici
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table commandes drop column if exists devise;
