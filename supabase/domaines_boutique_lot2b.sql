-- Domaine personnalisé (rang 9c, lot 2, complément du 2026-11-11) : une panne
-- n'est confirmée qu'après plus de 30 minutes sans réponse, et la page Domaine
-- montre les 3 dernières vérifications.

begin;

alter table public.domaines_boutique
  add column premier_echec_le timestamptz,
  add column dernieres_verifications jsonb not null default '[]'::jsonb;

commit;
