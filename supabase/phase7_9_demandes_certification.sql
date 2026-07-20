-- ============================================================
-- PHASE 7.9 (bonus) — Table dédiée pour les demandes de certification
-- ============================================================
-- Décision du 2026-07-20 : à l'échelle (potentiellement des dizaines de
-- demandes/jour), overloader `categories.statut` avec un état transitoire
-- 'en_attente_certification' est fragile — un rejet fait juste revenir le
-- statut à 'active', perdant toute trace de la demande. `categories` ne
-- porte plus désormais que le statut final (active/certifiee) ; le workflow
-- de demande vit entièrement dans sa propre table, avec historique complet
-- (approuvée/rejetée) conservé.

create table if not exists demandes_certification (
  id            uuid        primary key default gen_random_uuid(),
  categorie_id  uuid        not null references categories(id) on delete cascade,
  beatmaker_id  uuid        not null references beatmakers(id) on delete cascade,
  statut        text        not null default 'en_attente' check (statut in ('en_attente', 'approuvee', 'rejetee')),
  created_at    timestamptz not null default now(),
  traite_le     timestamptz
);

-- Une seule demande active à la fois par catégorie (empêche les demandes en
-- double si le beatmaker re-clique, ou une course entre deux requêtes).
create unique index if not exists demandes_certification_en_attente_unique
  on demandes_certification (categorie_id) where statut = 'en_attente';

create index if not exists demandes_certification_statut_idx
  on demandes_certification (statut) where statut = 'en_attente';

alter table demandes_certification enable row level security;

create policy "demandes_certification_select" on demandes_certification
  for select using (beatmaker_id = auth.uid());

create policy "demandes_certification_insert" on demandes_certification
  for insert with check (
    beatmaker_id = auth.uid()
    and exists (
      select 1 from categories c
      where c.id = categorie_id and c.beatmaker_id = auth.uid() and c.source = 'beatmaker' and c.statut = 'active'
    )
  );

-- Annulation par le demandeur lui-même — seulement tant qu'elle est encore
-- en attente (une fois traitée, la ligne fait partie de l'historique).
create policy "demandes_certification_delete" on demandes_certification
  for delete using (beatmaker_id = auth.uid() and statut = 'en_attente');

grant select, insert, delete on demandes_certification to authenticated;
grant all on demandes_certification to service_role;

-- ============================================================
-- Migration des demandes déjà en attente (avant de resserrer la contrainte
-- categories.statut ci-dessous)
-- ============================================================

insert into demandes_certification (categorie_id, beatmaker_id, statut)
select id, beatmaker_id, 'en_attente'
from categories
where statut = 'en_attente_certification' and beatmaker_id is not null;

update categories set statut = 'active' where statut = 'en_attente_certification';

alter table categories drop constraint if exists categories_statut_check;
alter table categories add constraint categories_statut_check check (statut in ('active', 'certifiee'));

-- ============================================================
-- Traitement atomique d'une demande (approbation ou rejet)
-- ============================================================
-- security definer, appelée uniquement via service_role (actions admin déjà
-- gardées par estAdmin() côté application) — regroupe la mise à jour de la
-- demande et celle de la catégorie dans une seule transaction de fonction,
-- jamais l'une sans l'autre.
create or replace function traiter_demande_certification(p_demande_id uuid, p_approuver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_categorie_id uuid;
  v_statut       text;
begin
  select categorie_id, statut into v_categorie_id, v_statut
  from demandes_certification where id = p_demande_id;

  if not found or v_statut <> 'en_attente' then
    raise exception 'Demande introuvable ou déjà traitée';
  end if;

  if p_approuver then
    update demandes_certification set statut = 'approuvee', traite_le = now() where id = p_demande_id;
    update categories set statut = 'certifiee' where id = v_categorie_id;
  else
    update demandes_certification set statut = 'rejetee', traite_le = now() where id = p_demande_id;
  end if;
end;
$$;

grant execute on function traiter_demande_certification(uuid, boolean) to service_role;
