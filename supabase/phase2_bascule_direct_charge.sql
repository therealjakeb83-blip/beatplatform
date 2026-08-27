-- ============================================================
-- PHASE 2 (refonte 9 bis) — Bascule Direct Charge (tâche 2.10)
-- ============================================================
-- Décision de Jake (2026-08-27) : Direct Charge est validé de bout en bout
-- (carte, Apple Pay, webhook Connect, snapshot) et aucun vrai client
-- n'utilise encore la plateforme — bascule immédiate de toutes les
-- boutiques existantes plutôt que de garder deux flux en parallèle.
--
-- Nouveau défaut 'true' pour toute future boutique. `update` explicite
-- pour les boutiques déjà créées (le defaut ne s'applique qu'aux futurs
-- inserts, jamais aux lignes existantes).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers alter column direct_charge_actif set default true;
update beatmakers set direct_charge_actif = true;
