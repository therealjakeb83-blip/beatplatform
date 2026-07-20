-- ============================================================
-- FIX — categorie_id doit être nullable pour que ON DELETE SET NULL
-- fonctionne (phase7_10 avait changé l'action de la FK sans retirer la
-- contrainte NOT NULL héritée de la création de la table, phase7_9)
-- ============================================================

alter table demandes_certification alter column categorie_id drop not null;
