-- ============================================================
-- TRIGGER : création automatique du profil beatmaker
-- S'exécute à chaque nouvel utilisateur dans auth.users
-- ============================================================

create or replace function public.handle_new_beatmaker()
returns trigger as $$
declare
  v_nom_artiste text;
  v_slug        text;
begin
  v_nom_artiste := coalesce(
    new.raw_user_meta_data->>'nom_artiste',
    split_part(new.email, '@', 1)
  );

  -- Slug : nom_artiste en minuscules sans accents + 8 premiers chars de l'UUID
  v_slug := lower(regexp_replace(v_nom_artiste, '[^a-zA-Z0-9]', '-', 'g'))
            || '-' || substr(new.id::text, 1, 8);

  insert into public.beatmakers (id, email, nom_artiste, slug, devise, pays, cgv_acceptees_at)
  values (new.id, new.email, v_nom_artiste, v_slug, 'EUR', 'FR', now());

  return new;
end;
$$ language plpgsql security definer SET search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_beatmaker();

-- Rattrapage pour les utilisateurs déjà inscrits (sans ligne dans beatmakers)
insert into public.beatmakers (id, email, nom_artiste, slug, devise, pays, cgv_acceptees_at)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'nom_artiste', split_part(u.email, '@', 1)),
  lower(regexp_replace(
    coalesce(u.raw_user_meta_data->>'nom_artiste', split_part(u.email, '@', 1)),
    '[^a-zA-Z0-9]', '-', 'g'
  )) || '-' || substr(u.id::text, 1, 8),
  'EUR',
  'FR',
  now()
from auth.users u
where not exists (select 1 from public.beatmakers b where b.id = u.id);


-- ============================================================
-- RLS POLICIES
-- ============================================================

-- beatmakers : chaque beatmaker voit et modifie uniquement son propre profil
create policy "beatmakers_select_own" on beatmakers
  for select using (auth.uid() = id);

create policy "beatmakers_insert_own" on beatmakers
  for insert with check (auth.uid() = id);

create policy "beatmakers_update_own" on beatmakers
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- beats : chaque beatmaker gère uniquement ses propres beats
create policy "beats_select_own" on beats
  for select using (auth.uid() = beatmaker_id);

create policy "beats_insert_own" on beats
  for insert with check (auth.uid() = beatmaker_id);

create policy "beats_update_own" on beats
  for update using (auth.uid() = beatmaker_id) with check (auth.uid() = beatmaker_id);

create policy "beats_delete_own" on beats
  for delete using (auth.uid() = beatmaker_id);

-- licences : chaque beatmaker gère uniquement ses propres licences
create policy "licences_select_own" on licences
  for select using (auth.uid() = beatmaker_id);

create policy "licences_insert_own" on licences
  for insert with check (auth.uid() = beatmaker_id);

create policy "licences_update_own" on licences
  for update using (auth.uid() = beatmaker_id) with check (auth.uid() = beatmaker_id);

create policy "licences_delete_own" on licences
  for delete using (auth.uid() = beatmaker_id);

-- clients : chaque artiste voit et modifie son propre profil
create policy "clients_select_own" on clients
  for select using (auth.uid() = id);

create policy "clients_insert_own" on clients
  for insert with check (auth.uid() = id);

create policy "clients_update_own" on clients
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- commandes : le beatmaker voit ses commandes, le client voit les siennes
create policy "commandes_select_beatmaker" on commandes
  for select using (auth.uid() = beatmaker_id);

create policy "commandes_select_client" on commandes
  for select using (auth.uid() = client_id);

-- leads : chaque beatmaker gère ses propres leads
create policy "leads_select_own" on leads
  for select using (auth.uid() = beatmaker_id);

create policy "leads_insert_own" on leads
  for insert with check (auth.uid() = beatmaker_id);

create policy "leads_update_own" on leads
  for update using (auth.uid() = beatmaker_id) with check (auth.uid() = beatmaker_id);

-- abonnements_plateforme : le beatmaker voit son propre abonnement
create policy "abonnements_plateforme_select_own" on abonnements_plateforme
  for select using (auth.uid() = beatmaker_id);

-- abonnements_boutique : le client voit les siens, le beatmaker voit ceux de sa boutique
create policy "abonnements_boutique_select_client" on abonnements_boutique
  for select using (auth.uid() = client_id);

create policy "abonnements_boutique_select_beatmaker" on abonnements_boutique
  for select using (auth.uid() = beatmaker_id);

-- doublons_ignores : le beatmaker gère ses propres doublons
create policy "doublons_ignores_select_own" on doublons_ignores
  for select using (auth.uid() = beatmaker_id);

create policy "doublons_ignores_insert_own" on doublons_ignores
  for insert with check (auth.uid() = beatmaker_id);
