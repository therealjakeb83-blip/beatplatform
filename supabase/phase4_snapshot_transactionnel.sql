-- ============================================================
-- PHASE 4 (refonte 9 bis) — Snapshot transactionnel
-- ============================================================
-- Fige les conditions commerciales réellement en vigueur au moment de
-- chaque vente, pour qu'un changement ultérieur (TVA, CGV, mandat de
-- fulfillment, contenu d'une licence) n'ait jamais d'effet rétroactif sur
-- une commande déjà passée. Périmètre volontairement limité à ce qui existe
-- déjà réellement dans le code aujourd'hui — le reste (licences éditables,
-- mandat B→A, merchant_decisions_log) viendra avec les phases 6/7/12.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ============================================================
-- 0. Historique des pages légales (prérequis)
-- ============================================================
-- boutique_pages_legales écrasait le contenu précédent à chaque
-- modification (upsert sur beatmaker_id/type_page, seul le numéro de
-- version était incrémenté) — le texte d'une ancienne version était perdu
-- pour toujours. Cette table archive chaque version remplacée, pour
-- toutes les pages légales (CGV, mentions légales, confidentialité,
-- contact, plan de site), pas seulement les CGV.

create table if not exists boutique_pages_legales_historique (
  id            uuid        primary key default gen_random_uuid(),
  beatmaker_id  uuid        not null references beatmakers(id) on delete cascade,
  type_page     text        not null check (type_page in ('cgv', 'mentions_legales', 'confidentialite', 'contact', 'plan_de_site')),
  contenu       text        not null,
  version       integer     not null,
  adopte_le     timestamptz not null,
  archive_le    timestamptz not null default now()
);

create index if not exists boutique_pages_legales_historique_idx
  on boutique_pages_legales_historique (beatmaker_id, type_page, version);

alter table boutique_pages_legales_historique enable row level security;

create policy "boutique_pages_legales_historique_beatmaker_own" on boutique_pages_legales_historique
  for select using (beatmaker_id = auth.uid());

grant select, insert on public.boutique_pages_legales_historique to authenticated;
grant select, insert on public.boutique_pages_legales_historique to service_role;

comment on table boutique_pages_legales_historique is
  'Archive de chaque version remplacée de boutique_pages_legales — permet de retrouver le texte exact en vigueur à une date donnée (Phase 4 refonte 9 bis).';

-- ============================================================
-- 1. TVA — vrai taux capturé par commande (corrige aussi le 20% codé en
--    dur dans l'affichage de la fiche commande business)
-- ============================================================

alter table commandes add column if not exists tva_taux numeric;

comment on column commandes.tva_taux is
  'Taux de TVA (%) réellement appliqué à cette vente, capturé depuis beatmakers.tva_taux au moment du paiement — 0 si TVA non activée pour ce beatmaker. NULL sur les commandes antérieures à la Phase 4.';

-- ============================================================
-- 2. CGV + mandat de fulfillment — version en vigueur au moment de la vente
-- ============================================================

alter table commandes add column if not exists cgv_version integer;
alter table commandes add column if not exists mandat_fulfillment_version integer;

comment on column commandes.cgv_version is
  'Version de boutique_pages_legales (type_page=cgv) en vigueur au moment de la vente — le texte exact reste consultable via boutique_pages_legales_historique. NULL si le beatmaker n''avait pas encore de CGV publiées.';
comment on column commandes.mandat_fulfillment_version is
  'Version de MANDAT_FULFILLMENT_TEXTES (lib/fulfillment.ts) en vigueur au moment de la vente — les textes de chaque version restent dans le code, jamais écrasés.';

-- ============================================================
-- 3. Licence achetée — ce qu'elle incluait au moment de l'achat
-- ============================================================
-- Sépare la LICENCE (ce qui a été vendu : nom + fichiers inclus, figé) des
-- FICHIERS eux-mêmes (mp3/wav/stems réels, restent volontairement live —
-- Jake peut corriger un mauvais upload après coup, décision actée).

alter table commande_lignes add column if not exists licence_nom text;
alter table commande_lignes add column if not exists licence_modele text;
alter table commande_lignes add column if not exists licence_inclut_mp3 boolean;
alter table commande_lignes add column if not exists licence_inclut_wav boolean;
alter table commande_lignes add column if not exists licence_inclut_stems boolean;

comment on column commande_lignes.licence_nom is
  'Nom de la licence au moment de l''achat — figé, indépendant d''un futur renommage de la licence.';
comment on column commande_lignes.licence_modele is
  'licences.modele au moment de l''achat (mp3/wav/stems/illimite/exclusive) — c''est ce champ, pas les booléens inclut_*, que la vraie livraison (lib/livraison.ts::genererUrlsSignees) utilise pour décider quels fichiers donner au client. NULL sur les lignes antérieures à la Phase 4 (comportement inchangé : retombe sur licences.modele actuel).';
comment on column commande_lignes.licence_inclut_mp3 is
  'Ce que la licence incluait au moment de l''achat, indépendant d''une modification future de la licence. NULL sur les lignes antérieures à la Phase 4 (comportement inchangé : retombe sur licences.inclut_mp3 actuel).';
comment on column commande_lignes.licence_inclut_wav is
  'Voir licence_inclut_mp3.';
comment on column commande_lignes.licence_inclut_stems is
  'Voir licence_inclut_mp3.';
