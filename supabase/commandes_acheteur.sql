-- Rend client_id nullable dans commandes
-- Pour la V1 : les acheteurs n'ont pas encore de compte client (étape 10)
-- On stocke l'email et le nom de l'acheteur directement dans la commande

alter table commandes alter column client_id drop not null;

alter table commandes add column if not exists acheteur_email text;
alter table commandes add column if not exists acheteur_nom   text;

-- Le beatmaker peut insérer des commandes sur ses propres beats (via webhook service role)
-- L'insert se fait via le client admin (service role), pas besoin de policy INSERT ici

-- Grant pour le webhook (service role bypass RLS, mais on documente)
grant select, insert, update on table public.commandes to authenticated;
