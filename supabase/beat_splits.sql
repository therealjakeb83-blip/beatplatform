-- ============================================================
-- TABLE : beat_splits
-- Répartition des revenus entre collaborateurs sur un beat
-- ============================================================

create table beat_splits (
  id              uuid primary key default gen_random_uuid(),
  beat_id         uuid not null references beats(id) on delete cascade,
  created_at      timestamptz not null default now(),

  -- Collaborateur (compte existant OU invitation en attente)
  beatmaker_id    uuid references beatmakers(id) on delete set null,
  email_invite    text,

  -- Pourcentage (ex: 50 = 50%)
  pourcentage     integer not null check (pourcentage > 0 and pourcentage < 100),

  -- Statut
  statut          text not null default 'en_attente' check (statut in ('actif', 'en_attente')),

  -- Un collaborateur par beat
  unique (beat_id, beatmaker_id),
  unique (beat_id, email_invite),

  -- Soit beatmaker_id soit email_invite, pas les deux, pas aucun
  check (
    (beatmaker_id is not null and email_invite is null) or
    (beatmaker_id is null and email_invite is not null)
  )
);

alter table beat_splits enable row level security;

create index on beat_splits (beat_id);
create index on beat_splits (beatmaker_id);

-- Le beatmaker propriétaire du beat peut gérer ses splits
create policy "beatmaker gère ses splits"
  on beat_splits for all
  using (
    exists (
      select 1 from beats
      where beats.id = beat_splits.beat_id
      and beats.beatmaker_id = auth.uid()
    )
  );

-- Un collaborateur peut voir les splits qui le concernent
create policy "collab voit ses splits"
  on beat_splits for select
  using (beatmaker_id = auth.uid());
