-- ============================================================
-- Chantier 9 bis, Phase 12, lot 2 — Checklist « prêt à vendre » + plan Free
-- ============================================================
-- Voir memory/project_phase12_grillme_decisions_2026_09_21.md (Q7/Q7b) et
-- ROADMAP.md, section « Détail — Chantier 9 bis, Phase 12 ».
--
-- 2 colonnes seulement : tout le reste de la checklist « prêt à vendre »
-- (mandat de facturation, adresse, numéro d'entreprise, raison sociale,
-- statement_descriptor, mandat de livraison, CGV/mentions légales) existe
-- déjà en base depuis les Phases 1/2/8 — voir lib/pret-a-vendre.ts.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ------------------------------------------------------------
-- Compte Stripe opérationnel — aujourd'hui `stripe_account_id` prouve
-- seulement qu'un compte a été CRÉÉ, jamais qu'il peut réellement encaisser
-- (charges_enabled/payouts_enabled ne sont stockés nulle part, voir Q7 :
-- "express-checkout fait stripe_account_id! sans vérifier que le compte est
-- opérationnel"). Mis à jour par le webhook account.updated ; en secours,
-- lib/pret-a-vendre.ts revérifie une fois auprès de Stripe si cette colonne
-- vaut encore false (rattrape les comptes déjà connectés avant ce correctif,
-- sans script de rattrapage à faire lancer par Jake).
-- ------------------------------------------------------------
alter table beatmakers add column if not exists stripe_compte_operationnel boolean not null default false;

comment on column beatmakers.stripe_compte_operationnel is
  'true si Stripe a confirmé charges_enabled ET payouts_enabled sur ce compte connecté (webhook account.updated, avec re-vérification à la demande dans lib/pret-a-vendre.ts). false par défaut, y compris pour un compte jamais rattrapé.';

-- ------------------------------------------------------------
-- Statut de TVA choisi EXPLICITEMENT (Q7 : "assujetti ou non" doit être une
-- vraie décision, jamais un défaut silencieux) — distinct de tva_active, qui
-- ne dit pas si le beatmaker a un jour vu ce choix. Posé à chaque
-- enregistrement réussi du panneau TVA (/api/stripe/tva), qu'il active ou
-- désactive la TVA.
-- ------------------------------------------------------------
alter table beatmakers add column if not exists tva_decision_prise_le timestamptz;

comment on column beatmakers.tva_decision_prise_le is
  'Horodatage du dernier enregistrement explicite du statut de TVA par le beatmaker (panneau Facturation). NULL = jamais confirmé, même si tva_active vaut déjà false par défaut — critère de la checklist « prêt à vendre » (Phase 12 lot 2).';
