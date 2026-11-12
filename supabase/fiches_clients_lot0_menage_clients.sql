-- Rang 9d, lot 0 (2026-11-12) — ménage par prudence sur la fiche commune `clients`.
-- Relevé en base (T0) : les règles *_own existent mais anon/authenticated n'ont
-- ni SELECT, ni INSERT, ni UPDATE → inutilisées. Aucun code ne lit/écrit `clients`
-- avec la session de l'utilisateur (tout passe par la clé de service).
-- On retire les 3 règles et les droits techniques restants (TRUNCATE, REFERENCES, TRIGGER).
begin;

drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;

revoke all on table public.clients from anon, authenticated;

commit;
