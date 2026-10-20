-- ============================================================
-- Création d'une fiche beatmaker réservée au serveur Sonoo (2026-10-20)
--
-- Avant : le trigger on_auth_user_created créait une fiche beatmaker dès
-- qu'un compte arrivait avec raw_user_meta_data.role = 'beatmaker'. Or ces
-- métadonnées sont fournies par la personne qui s'inscrit : n'importe qui
-- pouvait se créer un compte beatmaker directement auprès de Supabase (clé
-- publique), sans passer par Sonoo ni par la page de maintenance.
--
-- Après : plus aucun trigger. Seule la route /api/inscription/beatmaker
-- (service_role) crée la fiche via creer_fiche_beatmaker(), que ni anon ni
-- authenticated ne peuvent appeler. Même calcul de slug qu'avant.
-- Toute future inscription beatmaker (ex. connexion Google, Étape 14) doit
-- passer par cette fonction côté serveur.
-- ============================================================

begin;

create or replace function public.creer_fiche_beatmaker(
  p_id uuid,
  p_email text,
  p_nom_artiste text,
  p_pays text default 'FR'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom_artiste text;
  v_slug        text;
begin
  v_nom_artiste := coalesce(nullif(p_nom_artiste, ''), split_part(p_email, '@', 1));
  v_slug := lower(regexp_replace(v_nom_artiste, '[^a-zA-Z0-9]', '-', 'g'))
            || '-' || substr(p_id::text, 1, 8);

  insert into public.beatmakers (id, email, nom_artiste, slug, devise, pays, cgv_acceptees_at)
  values (p_id, p_email, v_nom_artiste, v_slug, 'EUR', coalesce(p_pays, 'FR'), now())
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.creer_fiche_beatmaker(uuid, text, text, text) from public;
revoke all on function public.creer_fiche_beatmaker(uuid, text, text, text) from anon;
revoke all on function public.creer_fiche_beatmaker(uuid, text, text, text) from authenticated;
grant execute on function public.creer_fiche_beatmaker(uuid, text, text, text) to service_role;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_beatmaker();

commit;
