-- Domaine personnalisé (rang 9c, lot 5, 2026-11-11) : fin de parcours.
-- 1. Historique des domaines qui ont déjà marché pour une boutique : un autre
--    beatmaker ne peut reprendre un tel domaine qu'en prouvant qu'il est à lui
--    (ligne TXT « _sonoo »). Rempli automatiquement par la base, quel que soit
--    le chemin (retrait, changement, libération, compte supprimé).
-- 2. Liste des domaines dont la boutique n'a plus d'abonnement depuis plus de
--    30 jours (arrêt définitif seulement, jamais pendant un impayé ou une
--    suspension), relue par la tâche automatique des domaines.
-- Une seule transaction : tout passe ou rien ne change.

begin;

create table public.domaines_historique (
  id uuid primary key default gen_random_uuid(),
  domaine text not null,
  -- Pas de lien vers beatmakers : la ligne doit survivre à un compte supprimé.
  beatmaker_id uuid,
  retire_le timestamptz not null default now()
);

create index domaines_historique_domaine_idx on public.domaines_historique (domaine);

alter table public.domaines_historique enable row level security;
grant select, insert on public.domaines_historique to service_role;

alter table public.domaines_boutique
  add column jeton_propriete text,
  add column propriete_prouvee_le timestamptz;

create or replace function public.historiser_domaine_boutique()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.premiere_activation_le is not null
     and (tg_op = 'DELETE' or new.domaine is distinct from old.domaine) then
    insert into public.domaines_historique (domaine, beatmaker_id)
    values (old.domaine, old.beatmaker_id);
  end if;
  return null;
end;
$$;

create trigger domaines_boutique_historique
  after delete or update of domaine on public.domaines_boutique
  for each row execute function public.historiser_domaine_boutique();

create or replace function public.domaines_sans_abonnement(limite integer)
returns table (id uuid, beatmaker_id uuid, domaine text)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.beatmaker_id, d.domaine
  from domaines_boutique d
  join beatmakers b on b.id = d.beatmaker_id
  where coalesce(b.role, '') <> 'admin'
    and not coalesce(b.abonnement_exempte, false)
    and coalesce(b.statut, '') <> 'suspendu'
    and not exists (
      select 1 from abonnements_plateforme a
      where a.beatmaker_id = d.beatmaker_id
        and a.statut in ('actif', 'en_essai', 'impaye', 'suspendu')
    )
    and (
      select max(coalesce(a.date_annulation, a.date_fin))
      from abonnements_plateforme a
      where a.beatmaker_id = d.beatmaker_id
    ) < now() - interval '30 days'
  order by d.created_at
  limit limite;
$$;

revoke execute on function public.domaines_sans_abonnement(integer) from public, anon, authenticated;
grant execute on function public.domaines_sans_abonnement(integer) to service_role;

commit;
