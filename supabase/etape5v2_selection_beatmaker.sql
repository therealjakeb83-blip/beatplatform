-- ============================================================
-- ÉTAPE 5v2 — Sélection du beatmaker (home page boutique publique)
-- ============================================================
-- Étoile sélectionnable sur /dashboard/business/beats : les beats
-- "mis_en_avant" alimentent la section "Sélection du beatmaker" de la
-- home boutique publique, au même titre que "Réservés aux membres".

alter table beats add column if not exists mis_en_avant boolean not null default false;

create index if not exists beats_mis_en_avant_idx on beats (beatmaker_id) where mis_en_avant = true;
