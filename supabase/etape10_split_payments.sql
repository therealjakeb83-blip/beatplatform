-- ============================================================
-- ÉTAPE 10 — Split collab
-- ============================================================

-- 1. Colonne transfer_group dans commandes
--    UUID généré au checkout pour relier tous les Stripe Transfers
--    d'une même vente (requis pour les beats avec splits)

alter table commandes
  add column if not exists stripe_transfer_group text;


-- ============================================================
-- 2. TABLE : split_payments
--    Une ligne par vente × par partie (collab + propriétaire)
--    Suit le statut de chaque Stripe Transfer individuel
-- ============================================================

create table split_payments (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  -- Vente liée
  commande_id         uuid not null references commandes(id) on delete cascade,

  -- Split source (null si partie "propriétaire" hors beat_splits)
  beat_split_id       uuid references beat_splits(id) on delete set null,

  -- Destinataire (compte existant)
  beatmaker_id        uuid references beatmakers(id) on delete set null,

  -- Destinataire (non encore inscrit)
  email_invite        text,

  -- Montant en centimes (ex: 700 = 7,00 €)
  montant             integer not null check (montant > 0),

  -- Stripe Transfer ID une fois exécuté
  stripe_transfer_id  text,

  -- Cycle de vie
  statut              text not null default 'en_attente'
                        check (statut in ('en_attente', 'transfere', 'expire')),

  -- Soit beatmaker_id (compte existant) soit email_invite (invité)
  check (
    (beatmaker_id is not null and email_invite is null) or
    (beatmaker_id is null and email_invite is not null)
  )
);

alter table split_payments enable row level security;

create index on split_payments (commande_id);
create index on split_payments (beatmaker_id);
create index on split_payments (statut);
create index on split_payments (email_invite);

-- Chaque beatmaker voit ses propres lignes (en tant que collab)
create policy "beatmaker voit ses split_payments"
  on split_payments for select
  using (beatmaker_id = auth.uid());

-- Le propriétaire du beat peut voir tous les splits de ses commandes
create policy "propriétaire voit les splits de ses ventes"
  on split_payments for select
  using (
    exists (
      select 1 from commandes c
      join beats b on b.id = c.beat_id
      where c.id = split_payments.commande_id
      and b.beatmaker_id = auth.uid()
    )
  );


-- ============================================================
-- 3. Grants service_role
--    Le webhook (createAdminClient) doit pouvoir tout faire
-- ============================================================

grant select, insert, update on public.split_payments to service_role;
grant update on public.commandes to service_role;
