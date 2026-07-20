-- ============================================================
-- PHASE 7.8 (bonus) — Images de catégories + renommage perso
-- ============================================================
-- Décisions prises le 2026-07-20 en testant Phase 7 :
-- - categories.image_url : image "officielle" pour une ligne
--   plateforme/certifiée (gérée par l'admin), ou image perso directe pour
--   une ligne beatmaker non certifiée (le beatmaker possède déjà seul
--   cette ligne, pas besoin d'un mécanisme d'override).
-- - categories_images_boutique : override par boutique d'une image
--   officielle (branding) — jamais utilisé pour une catégorie perso.
-- - renommer_categorie_perso() : renommage atomique d'une catégorie perso
--   non certifiée + cascade sur les beats du même beatmaker qui la
--   portaient. `nom` est la clé de matching littérale stockée dans
--   beats.styles/type_beat (pas un id) — un renommage qui ne toucherait
--   que la ligne `categories` casserait silencieusement le lien avec les
--   beats déjà tagués.

alter table categories add column if not exists image_url text;

create table if not exists categories_images_boutique (
  id            uuid        primary key default gen_random_uuid(),
  categorie_id  uuid        not null references categories(id) on delete cascade,
  beatmaker_id  uuid        not null references beatmakers(id) on delete cascade,
  image_url     text        not null,
  created_at    timestamptz not null default now(),
  unique (categorie_id, beatmaker_id)
);

alter table categories_images_boutique enable row level security;

-- Lecture publique : nécessaire pour l'affichage futur sur les boutiques
-- publiques (Étape 5v2) — une URL d'image n'a rien de sensible.
create policy "categories_images_boutique_select" on categories_images_boutique
  for select using (true);

create policy "categories_images_boutique_insert" on categories_images_boutique
  for insert with check (
    beatmaker_id = auth.uid()
    and exists (select 1 from categories c where c.id = categorie_id and (c.source = 'plateforme' or c.statut = 'certifiee'))
  );

create policy "categories_images_boutique_update" on categories_images_boutique
  for update using (beatmaker_id = auth.uid())
  with check (beatmaker_id = auth.uid());

create policy "categories_images_boutique_delete" on categories_images_boutique
  for delete using (beatmaker_id = auth.uid());

grant select, insert, update, delete on categories_images_boutique to authenticated;
grant select on categories_images_boutique to anon;
grant all on categories_images_boutique to service_role;

-- ============================================================
-- Renommage atomique d'une catégorie perso non certifiée
-- ============================================================
-- security definer : le beatmaker n'a pas de policy générique pour UPDATE
-- beats depuis ce contexte, et on veut que le renommage de `categories` et
-- la mise à jour des beats réussissent ou échouent ensemble (une seule
-- transaction implicite de fonction plpgsql), jamais partiellement.
create or replace function renommer_categorie_perso(p_categorie_id uuid, p_nouveau_nom text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_beatmaker_id uuid := auth.uid();
  v_type         text;
  v_ancien_nom   text;
  v_statut       text;
  v_source       text;
  v_owner        uuid;
  v_nouveau_nom  text := trim(p_nouveau_nom);
begin
  if v_beatmaker_id is null then
    raise exception 'Non authentifié';
  end if;
  if v_nouveau_nom = '' then
    raise exception 'Nom vide';
  end if;

  select type, nom, statut, source, beatmaker_id into v_type, v_ancien_nom, v_statut, v_source, v_owner
  from categories where id = p_categorie_id;

  if not found or v_owner is distinct from v_beatmaker_id or v_source <> 'beatmaker' or v_statut = 'certifiee' then
    raise exception 'Catégorie non modifiable';
  end if;

  if v_ancien_nom = v_nouveau_nom then
    return;
  end if;

  -- Empêche de recréer par renommage le doublon officiel/perso déjà corrigé
  -- côté synchroniserCategoriesPersonnalisees (lib/categories.ts).
  if exists (
    select 1 from categories
    where type = v_type and lower(nom) = lower(v_nouveau_nom) and (source = 'plateforme' or statut = 'certifiee')
  ) then
    raise exception 'Ce nom est déjà une catégorie officielle.';
  end if;

  update categories set nom = v_nouveau_nom where id = p_categorie_id;

  if v_type = 'styles' then
    update beats set styles = array_replace(styles, v_ancien_nom, v_nouveau_nom)
    where beatmaker_id = v_beatmaker_id and styles @> array[v_ancien_nom];
  elsif v_type = 'type_beat' then
    update beats set type_beat = array_replace(type_beat, v_ancien_nom, v_nouveau_nom)
    where beatmaker_id = v_beatmaker_id and type_beat @> array[v_ancien_nom];
  end if;
end;
$$;

grant execute on function renommer_categorie_perso(uuid, text) to authenticated;
