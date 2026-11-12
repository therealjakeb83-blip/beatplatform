-- ============================================================
-- Rang 9c bis, lot 3 (2026-11-12) : slug figé, anciens noms, verrou en base
--
-- 1. beatmakers.slug_choisi_le : null = slug automatique (nom-xxxxxxxx) encore
--    en place ; rempli = le beatmaker a fait son choix unique, ensuite seul
--    l'admin change le slug (décision 4).
-- 2. anciens_slugs : tout ancien slug (choisi ou automatique) renvoie pour
--    toujours vers la boutique, personne d'autre ne peut le prendre ; seul
--    l'admin le libère (décision 4 bis, précisée le 2026-11-12 : l'adresse
--    automatique est gardée elle aussi, comme Shopify).
-- 3. changer_slug_boutique() : seul chemin pour changer un slug, appelé par le
--    serveur (clé de service) uniquement.
-- 4. Verrou : un beatmaker connecté (clé publique) ne peut plus modifier les
--    colonnes réservées à Sonoo (slug, rôle, suspension, passe-droit, Stripe,
--    numérotation des factures, mandats…), ni créer de fiche beatmaker.
--    Faille trouvée le 2026-11-12 : la règle beatmakers_update_own laissait
--    tout modifier depuis la console du navigateur.
-- 5. creer_fiche_beatmaker() reçoit le slug automatique calculé par le serveur
--    (lib/slug-regles.ts : accents retirés, tirets simples, 50 caractères max).
-- ============================================================

begin;

-- 1. Choix unique ------------------------------------------------------------
alter table public.beatmakers add column if not exists slug_choisi_le timestamptz;

comment on column public.beatmakers.slug_choisi_le is
  'Date du choix unique du slug par le beatmaker (rang 9c bis lot 3). Null = slug automatique encore en place. Ensuite seul l''admin change le slug (changer_slug_boutique).';

-- Boutiques dont le slug n'est plus l'automatique (nom-<8 premiers caractères de l'id>) : déjà choisi.
update public.beatmakers
set slug_choisi_le = now()
where slug_choisi_le is null
  and slug !~ ('-' || substr(id::text, 1, 8) || '$');

-- 2. Anciens noms ------------------------------------------------------------
create table if not exists public.anciens_slugs (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null,
  beatmaker_id  uuid not null references public.beatmakers(id) on delete cascade,
  automatique   boolean not null default false,
  cree_le       timestamptz not null default now(),
  cree_par      uuid,
  libere_le     timestamptz,
  libere_par    uuid
);

comment on table public.anciens_slugs is
  'Anciens slugs d''une boutique (rang 9c bis lot 3) : renvoient vers la boutique et sont réservés tant que libere_le est null. Lus et écrits par le serveur uniquement.';

create unique index if not exists anciens_slugs_actif_unique on public.anciens_slugs (slug) where libere_le is null;
create index if not exists anciens_slugs_beatmaker on public.anciens_slugs (beatmaker_id);

alter table public.anciens_slugs enable row level security;
revoke all on table public.anciens_slugs from anon, authenticated;
grant select, insert, update on table public.anciens_slugs to service_role;

-- 3. Changement de slug ------------------------------------------------------
-- p_admin null = choix unique du beatmaker (refusé si déjà fait) ;
-- p_admin rempli = changement par l'admin (toujours permis).
-- Les règles de forme et les mots interdits sont vérifiés avant, par le serveur.
create or replace function public.changer_slug_boutique(
  p_beatmaker_id uuid,
  p_nouveau text,
  p_admin uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ancien text;
  v_choisi timestamptz;
begin
  select slug, slug_choisi_le into v_ancien, v_choisi
  from beatmakers where id = p_beatmaker_id for update;
  if not found then raise exception 'BOUTIQUE_INTROUVABLE'; end if;
  if v_ancien = p_nouveau then raise exception 'SLUG_IDENTIQUE'; end if;
  if p_admin is null and v_choisi is not null then raise exception 'SLUG_FIGE'; end if;
  if exists (select 1 from beatmakers where slug = p_nouveau and id <> p_beatmaker_id) then
    raise exception 'SLUG_PRIS';
  end if;
  if exists (select 1 from anciens_slugs where slug = p_nouveau and libere_le is null and beatmaker_id <> p_beatmaker_id) then
    raise exception 'SLUG_ANCIEN_NOM';
  end if;

  -- Retour à l'un de ses propres anciens noms : il redevient l'adresse actuelle.
  update anciens_slugs set libere_le = now(), libere_par = p_admin
  where slug = p_nouveau and libere_le is null and beatmaker_id = p_beatmaker_id;

  insert into anciens_slugs (slug, beatmaker_id, automatique, cree_par)
  values (v_ancien, p_beatmaker_id, v_choisi is null, p_admin);

  update beatmakers
  set slug = p_nouveau, slug_choisi_le = coalesce(v_choisi, now())
  where id = p_beatmaker_id;

  return v_ancien;
end;
$$;

revoke all on function public.changer_slug_boutique(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.changer_slug_boutique(uuid, text, uuid) to service_role;

-- 4. Verrou des colonnes réservées à Sonoo -----------------------------------
-- Lecture par to_jsonb : une colonne absente de la base en ligne ne fait jamais
-- échouer le verrou. Seuls les rôles de la clé publique sont concernés ; le
-- serveur (service_role), l'éditeur SQL et les fonctions internes passent.
create or replace function public.beatmakers_verrou_colonnes()
returns trigger
language plpgsql
as $$
declare
  c text;
  avant jsonb;
  apres jsonb;
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Création d''une boutique réservée au serveur Sonoo.' using errcode = '42501';
  end if;
  avant := to_jsonb(old);
  apres := to_jsonb(new);
  foreach c in array array[
    'id', 'email', 'created_at', 'cgv_acceptees_at',
    'slug', 'slug_choisi_le', 'domaine',
    'role', 'statut', 'abonnement_exempte', 'suspendu_le', 'suspendu_motif', 'suspendu_raison',
    'notes_admin', 'source_acquisition', 'date_dernier_login',
    'stripe_account_id', 'paypal_account_id', 'stripe_compte_operationnel', 'direct_charge_actif',
    'stripe_product_id', 'stripe_price_id', 'stripe_produit_compte', 'statement_descriptor',
    'pret_a_vendre_concedant', 'pret_a_vendre_collaborateur',
    'facturation_compteur', 'facturation_annee_courante', 'facturation_offset',
    'facturation_format', 'facturation_format_accepte_at',
    'mandat_facturation_version', 'mandat_facturation_accepte_at',
    'fulfillment_mandat_version', 'fulfillment_mandat_accepte_at', 'fulfillment_mandat_revoque_at',
    'domaine_envoi_email', 'domaine_envoi_verifie'
  ] loop
    if (apres -> c) is distinct from (avant -> c) then
      raise exception 'La colonne % ne peut être modifiée que par Sonoo.', c using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists beatmakers_verrou_colonnes on public.beatmakers;
create trigger beatmakers_verrou_colonnes
  before insert or update on public.beatmakers
  for each row execute function public.beatmakers_verrou_colonnes();

drop policy if exists "beatmakers_insert_own" on public.beatmakers;

-- 5. Slug automatique calculé par le serveur ---------------------------------
drop function if exists public.creer_fiche_beatmaker(uuid, text, text, text);

create or replace function public.creer_fiche_beatmaker(
  p_id uuid,
  p_email text,
  p_nom_artiste text,
  p_pays text default 'FR',
  p_slug text default null
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
  v_slug := coalesce(
    nullif(p_slug, ''),
    lower(regexp_replace(v_nom_artiste, '[^a-zA-Z0-9]', '-', 'g')) || '-' || substr(p_id::text, 1, 8)
  );

  insert into public.beatmakers (id, email, nom_artiste, slug, devise, pays, cgv_acceptees_at)
  values (p_id, p_email, v_nom_artiste, v_slug, 'EUR', coalesce(p_pays, 'FR'), now())
  on conflict (id) do nothing;
end;
$$;

revoke all on function public.creer_fiche_beatmaker(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.creer_fiche_beatmaker(uuid, text, text, text, text) to service_role;

commit;
