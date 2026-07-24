-- ============================================================
-- PHASE 15.1 — Admin : Recherche/Support + Log Stripe + Suspension boutique
-- ============================================================
-- Lot 1 de l'Étape 15 (Admin), cadré le 2026-07-24 : recherche multi-critères,
-- log des webhooks Stripe, suspension/réactivation de boutique avec pause en
-- cascade des abonnements (Stripe pause_collection, réversible), correction
-- de champs compte client/beatmaker à faible risque.

-- ============================================================
-- Table : stripe_events
-- Log de chaque événement webhook Stripe reçu — pour debug sans passer par
-- les Runtime Logs Vercel. Accès service_role uniquement (jamais exposé aux
-- beatmakers), upsert sur stripe_event_id pour absorber les rejeux Stripe.
-- ============================================================
create table if not exists stripe_events (
  id               uuid        primary key default gen_random_uuid(),
  stripe_event_id  text        not null unique,
  type             text        not null,
  statut           text        not null default 'recu' check (statut in ('recu', 'traite', 'echoue')),
  erreur           text,
  created_at       timestamptz not null default now(),
  traite_at        timestamptz
);

create index if not exists stripe_events_created_at_idx on stripe_events (created_at desc);
create index if not exists stripe_events_echoue_idx on stripe_events (created_at desc) where statut = 'echoue';

alter table stripe_events enable row level security;
grant select, insert, update on stripe_events to service_role;

-- ============================================================
-- Suspension de boutique — traçabilité + pause en cascade des abonnements
-- ============================================================
-- Raison + date obligatoires en pratique (posées ensemble côté admin) —
-- gardent une trace de pourquoi une boutique a été suspendue, pour éviter la
-- confusion plus tard ("pourquoi j'avais suspendu celle-là déjà ?").
alter table beatmakers add column if not exists suspendu_le     timestamptz;
alter table beatmakers add column if not exists suspendu_raison text;

alter table beatmakers drop constraint if exists beatmakers_statut_check;
alter table beatmakers add constraint beatmakers_statut_check check (statut in ('actif', 'inactif', 'suspendu'));

-- statut_avant_suspension conserve l'état réel (actif ou en_essai pour la
-- plateforme) avant la pause, pour que la réactivation restaure exactement
-- le bon statut plutôt que de deviner 'actif' par défaut. Rempli UNIQUEMENT
-- par le mécanisme de suspension de boutique — jamais par un autre flux.
alter table abonnements_plateforme add column if not exists statut_avant_suspension text;
alter table abonnements_boutique   add column if not exists statut_avant_suspension text;

alter table abonnements_plateforme drop constraint if exists abonnements_plateforme_statut_check;
alter table abonnements_plateforme add constraint abonnements_plateforme_statut_check
  check (statut in ('en_essai', 'actif', 'annule', 'impaye', 'suspendu'));

-- Jamais accordé jusqu'ici (vérifié dans tous les fichiers supabase/*.sql
-- existants) — nécessaire pour que suspendreBoutique/reactiverBoutique
-- (lib/admin-boutiques.ts) puissent lire/modifier cette table via
-- createAdminClient() (service_role bypasse RLS mais a quand même besoin de
-- grants table-level explicites, voir feedback_service_role_grants).
grant select, update on public.abonnements_plateforme to service_role;

alter table abonnements_boutique drop constraint if exists abonnements_boutique_statut_check;
alter table abonnements_boutique add constraint abonnements_boutique_statut_check
  check (statut in ('actif', 'annule', 'impaye', 'suspendu'));

-- ============================================================
-- Recherche admin par préfixe d'UUID
-- ============================================================
-- Le dashboard business affiche déjà les commandes/abonnements sous forme
-- `#A3F92B1C` (8 premiers caractères de l'UUID, voir CommandesClient.tsx et
-- AbonnementsClient.tsx) — un beatmaker peut donc coller ce même identifiant
-- à Jake en support. `ilike` ne fonctionne pas nativement sur une colonne
-- uuid via PostgREST (cast nécessaire), d'où ces deux fonctions dédiées.
create or replace function admin_chercher_commande_prefixe(p_prefixe text)
returns setof commandes
language sql stable security definer set search_path = public
as $$
  select * from commandes where id::text ilike p_prefixe || '%' order by created_at desc limit 10;
$$;

create or replace function admin_chercher_abonnement_prefixe(p_prefixe text)
returns setof abonnements_boutique
language sql stable security definer set search_path = public
as $$
  select * from abonnements_boutique where id::text ilike p_prefixe || '%' order by created_at desc limit 10;
$$;

grant execute on function admin_chercher_commande_prefixe(text) to service_role;
grant execute on function admin_chercher_abonnement_prefixe(text) to service_role;
