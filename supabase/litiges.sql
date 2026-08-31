-- ============================================================
-- Litiges Stripe — historique daté (rang 9 ROADMAP, décidé le 2026-08-31)
-- ============================================================
-- Une ligne par litige Stripe reçu (charge.dispute.created), mise à jour à
-- la fermeture (charge.dispute.closed). Distinct du badge affiché sur
-- `commandes.statut` (qui ne garde que l'état courant) — cette table sert
-- d'historique daté pour les Analytics (argent en séquestre, remboursements,
-- déclarations fiscales du beatmaker). Voir lib/webhook-paiement.ts
-- (marquerLitige/résoudreLitige) et memory/project_litiges_stripe_badge_passif.md.

create table litiges (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),

  commande_id         uuid not null references commandes(id) on delete cascade,
  beatmaker_id        uuid not null references beatmakers(id) on delete cascade,

  stripe_dispute_id   text not null unique,

  -- Montant en euros décimaux (même convention que commandes.prix_paye)
  montant             numeric not null check (montant >= 0),

  statut              text not null default 'en_cours'
                        check (statut in ('en_cours', 'gagne', 'perdu')),

  ouvert_le           timestamptz not null default now(),
  ferme_le            timestamptz
);

alter table litiges enable row level security;

create index on litiges (beatmaker_id);
create index on litiges (statut);
create index on litiges (commande_id);

-- Le beatmaker voit ses propres litiges (Analytics → Revenus)
create policy "beatmaker voit ses litiges"
  on litiges for select
  using (beatmaker_id = auth.uid());

-- Écritures faites uniquement via createAdminClient() (webhook Connect)
grant select, insert, update on public.litiges to service_role;
grant select on public.litiges to authenticated;
