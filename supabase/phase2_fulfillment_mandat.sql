-- ============================================================
-- PHASE 2 (refonte 9 bis) — Mandat de fulfillment
-- ============================================================
-- Formalise le consentement du beatmaker à la livraison automatique
-- (comportement déjà en place, jamais tracé jusqu'ici — voir audit
-- memory/project_audit_9bis_deemed_supplier.md, point 9). Pas de mode
-- "manuel" construit : un seul mode existant (automatique), rendu explicite
-- au lieu d'un défaut silencieux.
--
-- version + texte séparé (lib/fulfillment.ts) plutôt qu'un simple booléen —
-- pour que le snapshot transactionnel (Phase 4) puisse un jour figer la
-- version applicable à chaque commande.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers add column if not exists fulfillment_mandat_version integer;
alter table beatmakers add column if not exists fulfillment_mandat_accepte_at timestamptz;
alter table beatmakers add column if not exists fulfillment_mandat_revoque_at timestamptz;
