-- ============================================================
-- Audit 2026-07-29 (F2) — Vrai champ de rôle admin
-- ============================================================
-- Jusqu'ici, estAdmin() (lib/admin.ts) comparait le slug de la boutique à
-- une constante en dur ('jakeb-test') — un slug est modifiable par le
-- beatmaker via /dashboard/profil, donc renommer sa boutique aurait pu
-- casser (ou pire, transférer) le statut admin. Norme SaaS : un vrai champ
-- de rôle, jamais modifiable via le formulaire de profil normal (le
-- endpoint app/api/profil/modifier ne l'expose déjà pas).

alter table beatmakers add column if not exists role text not null default 'beatmaker';

alter table beatmakers drop constraint if exists beatmakers_role_check;
alter table beatmakers add constraint beatmakers_role_check check (role in ('beatmaker', 'admin'));

comment on column beatmakers.role is
  'Rôle plateforme — ''admin'' réservé au compte de Jake (lib/admin.ts). Jamais modifiable via /api/profil/modifier. Base du futur 15f (rôles/permissions).';

-- Migration de données : le compte admin actuel reste identifié par son
-- slug historique le temps de cette seule requête, puis le rôle prend le relais.
update beatmakers set role = 'admin' where slug = 'jakeb-test';
