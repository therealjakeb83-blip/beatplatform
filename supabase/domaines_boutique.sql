-- Domaine personnalisé par boutique (rang 9c, lot 1).
-- Un domaine par boutique, un domaine n'appartient qu'à une boutique.
-- Seul le statut 'actif' affiche la boutique (proxy.ts, via service_role).

begin;

create table public.domaines_boutique (
  id uuid primary key default gen_random_uuid(),
  beatmaker_id uuid not null unique references public.beatmakers(id) on delete cascade,
  domaine text not null unique check (domaine = lower(domaine) and domaine !~ '[/:[:space:]]'),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'actif', 'probleme')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.domaines_boutique enable row level security;

create policy "Beatmaker lit son domaine"
  on public.domaines_boutique
  for select
  to authenticated
  using (beatmaker_id = auth.uid());

grant select on public.domaines_boutique to authenticated;
grant select, insert, update, delete on public.domaines_boutique to service_role;

commit;
