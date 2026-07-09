-- ============================================================
-- PHASE 2c — Commerce : Panier multi-articles
-- ============================================================
-- Décision actée (session 2026-07-09) : 1 panier = 1 vraie ligne
-- `commandes`, quel que soit le nombre d'articles. `commandes` devient
-- un header de commande (client, montants totaux, statut) ; le détail
-- par beat part dans la nouvelle table `commande_lignes`.
--
-- commandes.beat_id/licence_id étaient déjà nullable (sprint2_crm.sql) —
-- utilisés uniquement par les commandes d'abonnement (beat_id: null).
-- Ces lignes-là ne sont pas concernées par cette migration.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ============================================================
-- 1. TABLE : commande_lignes
--    Une ligne = un beat + une licence dans une commande
-- ============================================================

create table commande_lignes (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  commande_id         uuid not null references commandes(id) on delete cascade,

  beat_id             uuid not null references beats(id),
  licence_id          uuid not null references licences(id),

  -- Euros décimaux, même convention que commandes.prix_paye
  prix_paye           numeric not null default 0 check (prix_paye >= 0),
  reduction_montant   numeric not null default 0 check (reduction_montant >= 0),

  splits_snapshot     jsonb,
  contrat_pdf_url     text,

  type_transaction    text not null default 'achat' check (type_transaction in ('achat', 'upgrade')),
  ligne_originale_id  uuid references commande_lignes(id)
);

alter table commande_lignes enable row level security;

create index on commande_lignes (commande_id);
create index on commande_lignes (beat_id);
create index on commande_lignes (licence_id);
create index on commande_lignes (ligne_originale_id);

create policy "commande_lignes_select_beatmaker" on commande_lignes
  for select using (
    exists (select 1 from commandes c where c.id = commande_lignes.commande_id and c.beatmaker_id = auth.uid())
  );

create policy "commande_lignes_select_client" on commande_lignes
  for select using (
    exists (select 1 from commandes c where c.id = commande_lignes.commande_id and c.client_id = auth.uid())
  );

grant select, insert, update on public.commande_lignes to service_role;
grant select on public.commande_lignes to authenticated;

-- ============================================================
-- 2. TABLE : tentatives_paiement_lignes
--    Détail par article d'une tentative de checkout panier
--    (miroir de commande_lignes, côté "avant paiement")
-- ============================================================

create table tentatives_paiement_lignes (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),

  tentative_id          uuid not null references tentatives_paiement(id) on delete cascade,

  beat_id               uuid not null references beats(id),
  licence_id            uuid not null references licences(id),

  -- Prix final de cet article (après remise membre + part du code promo), euros décimaux
  prix                  numeric not null check (prix >= 0),
  -- Part du code promo sur cet article uniquement (informatif, déjà reflété dans prix)
  reduction_montant     numeric not null default 0 check (reduction_montant >= 0),
  code_promo_applique   boolean not null default false,

  -- Rempli par le webhook une fois la ligne convertie en achat
  commande_ligne_id     uuid references commande_lignes(id) on delete set null
);

alter table tentatives_paiement_lignes enable row level security;

create index on tentatives_paiement_lignes (tentative_id);
create index on tentatives_paiement_lignes (beat_id);

create policy "beatmaker voit ses tentatives_paiement_lignes" on tentatives_paiement_lignes
  for select using (
    exists (
      select 1 from tentatives_paiement t
      where t.id = tentatives_paiement_lignes.tentative_id
      and t.beatmaker_id = auth.uid()
    )
  );

grant select, insert, update on public.tentatives_paiement_lignes to service_role;
grant select on public.tentatives_paiement_lignes to authenticated;

-- ============================================================
-- 3. MIGRATION DES DONNÉES EXISTANTES : commandes → commande_lignes
--    Chaque commande actuelle (achat de beat) devient 1 header + 1 ligne
-- ============================================================

-- Passe 1 : créer la ligne pour chaque commande d'achat de beat existante
insert into commande_lignes (commande_id, beat_id, licence_id, prix_paye, reduction_montant, splits_snapshot, contrat_pdf_url, type_transaction, created_at)
select id, beat_id, licence_id, prix_paye, coalesce(reduction_montant, 0), splits_snapshot, contrat_pdf_url,
       coalesce(type_transaction, 'achat'), created_at
from commandes
where beat_id is not null;

-- Passe 2 : reconstituer le lien d'upgrade (commande_originale_id → ligne d'origine)
update commande_lignes cl
set ligne_originale_id = orig_ligne.id
from commandes c
join commande_lignes orig_ligne on orig_ligne.commande_id = c.commande_originale_id
where cl.commande_id = c.id
  and c.commande_originale_id is not null;

-- ============================================================
-- 4. MIGRATION DES DONNÉES EXISTANTES : tentatives_paiement → tentatives_paiement_lignes
-- ============================================================

insert into tentatives_paiement_lignes (tentative_id, beat_id, licence_id, prix, code_promo_applique, created_at)
select id, beat_id, licence_id, prix, (code_promo is not null), created_at
from tentatives_paiement
where type = 'achat_beat' and beat_id is not null;

-- ============================================================
-- 5. NETTOYAGE : commandes perd les colonnes déplacées vers commande_lignes
-- ============================================================

alter table commandes drop column beat_id;
alter table commandes drop column licence_id;
alter table commandes drop column contrat_pdf_url;
alter table commandes drop column commande_originale_id;
alter table commandes drop column type_transaction;

-- 1 session Stripe = 1 commande de nouveau (redevient vrai avec le modèle header + lignes)
alter table commandes add constraint commandes_stripe_session_id_unique unique (stripe_session_id);

-- ============================================================
-- 6. NETTOYAGE : tentatives_paiement perd beat_id/licence_id (déplacés
--    vers tentatives_paiement_lignes), la contrainte de forme est réécrite
-- ============================================================

alter table tentatives_paiement drop constraint tentatives_paiement_forme_coherente;
alter table tentatives_paiement drop column beat_id;
alter table tentatives_paiement drop column licence_id;

alter table tentatives_paiement add constraint tentatives_paiement_forme_coherente check (
  (type = 'achat_beat' and stripe_session_id is not null
    and abonnement_id is null and stripe_invoice_id is null)
  or
  (type = 'renouvellement_abonnement' and abonnement_id is not null and stripe_invoice_id is not null
    and stripe_session_id is null)
);

-- ============================================================
-- 7. licence_downloads : savoir quel article précis a été téléchargé
--    (une commande peut désormais contenir plusieurs beats)
-- ============================================================

alter table licence_downloads
  add column if not exists commande_ligne_id uuid references commande_lignes(id) on delete set null;

create index if not exists licence_downloads_ligne_idx on licence_downloads (commande_ligne_id);

-- ============================================================
-- 8. split_payments : la policy RLS joignait commandes.beat_id (supprimée)
--    → repasse par commande_lignes. commande_id ne change pas de sens
--    (une commande peut avoir des splits sur plusieurs de ses lignes).
-- ============================================================

drop policy if exists "propriétaire voit les splits de ses ventes" on split_payments;

create policy "propriétaire voit les splits de ses ventes"
  on split_payments for select
  using (
    exists (
      select 1 from commande_lignes cl
      join beats b on b.id = cl.beat_id
      where cl.commande_id = split_payments.commande_id
      and b.beatmaker_id = auth.uid()
    )
  );
