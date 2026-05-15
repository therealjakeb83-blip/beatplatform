-- Table beat_licences : activation des licences par beat
create table beat_licences (
  beat_id       uuid not null references beats(id) on delete cascade,
  licence_id    uuid not null references licences(id) on delete cascade,
  actif         boolean not null default true,
  prix_override integer,        -- null = utilise le prix global de la licence
  sur_demande   boolean not null default false, -- true = affiche "Me contacter" (exclusive seulement)
  primary key (beat_id, licence_id)
);

alter table beat_licences enable row level security;

-- Le beatmaker gère les licences de ses propres beats
create policy "beatmaker gère ses beat_licences"
  on beat_licences
  using (
    exists (select 1 from beats where beats.id = beat_licences.beat_id and beats.beatmaker_id = auth.uid())
  )
  with check (
    exists (select 1 from beats where beats.id = beat_licences.beat_id and beats.beatmaker_id = auth.uid())
  );

-- Les acheteurs peuvent voir les licences actives des beats publics
create policy "lecture publique beat_licences"
  on beat_licences for select
  using (
    actif = true and
    exists (
      select 1 from beats
      where beats.id = beat_licences.beat_id
      and beats.statut = 'public'
      and beats.supprime_le is null
    )
  );

grant select, insert, update, delete on table public.beat_licences to authenticated;
