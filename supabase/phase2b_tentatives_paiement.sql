-- ============================================================
-- PHASE 2b — Commerce : Tentatives de paiement
-- ============================================================
-- Une ligne par tentative de checkout (créée dès la session Stripe),
-- distincte de `commandes` qui ne contient que les achats confirmés.
-- Modèle Shopify : Checkout (tentative) ≠ Order (commande) — voir
-- memory/project_commerce_tentatives_paiement.md pour le contexte complet.

create table tentatives_paiement (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  beatmaker_id        uuid not null references beatmakers(id) on delete cascade,
  beat_id             uuid not null references beats(id) on delete cascade,
  licence_id          uuid not null references licences(id),

  -- Acheteur : résolu si connecté ou email déjà connu au moment du checkout,
  -- sinon complété par le webhook une fois Stripe l'aura renvoyé
  client_id           uuid references clients(id),
  email               text,

  -- Montant en euros décimaux (même convention que commandes.prix_paye)
  prix                numeric not null check (prix >= 0),

  code_promo          text,
  source_marketing    text,

  stripe_session_id   text not null unique,

  statut              text not null default 'creee'
                        check (statut in ('creee', 'complete', 'expiree', 'echouee')),

  -- Rempli si la tentative aboutit à un vrai achat
  commande_id         uuid references commandes(id) on delete set null
);

alter table tentatives_paiement enable row level security;

create index on tentatives_paiement (beatmaker_id);
create index on tentatives_paiement (statut);
create index on tentatives_paiement (stripe_session_id);

-- Le beatmaker voit ses propres tentatives (dashboard Commandes)
create policy "beatmaker voit ses tentatives_paiement"
  on tentatives_paiement for select
  using (beatmaker_id = auth.uid());

-- Écritures faites uniquement via createAdminClient() (checkout + webhook)
grant select, insert, update on public.tentatives_paiement to service_role;
grant select on public.tentatives_paiement to authenticated;
