-- ============================================================
-- "Mails My Producer" (2026-07-27) — emails transactionnels
-- plateforme → beatmaker (bienvenue, confirmation essai, rappel fin
-- d'essai, paiement échoué, annulation). Inexistants jusqu'ici malgré
-- la table abonnements_plateforme présente depuis le schéma d'origine.
-- ============================================================
-- Suivi du rappel de fin d'essai (J-3) pour que le cron quotidien
-- (/api/cron/plateforme-rappels) ne renvoie jamais deux fois le même
-- rappel — une seule colonne suffit, pas besoin d'une table à part.

alter table abonnements_plateforme add column if not exists rappel_essai_envoye_le timestamptz;

-- ============================================================
-- Mise à jour (suite, même jour) — personnalisation admin du titre/intro
-- de chaque email, demandée par Jake : même mécanisme que
-- templates_transactionnels (titre+intro éditables, fallback par défaut
-- sinon), mais une seule ligne par type (pas par beatmaker_id) puisque
-- ces emails ne sont jamais personnalisables PAR un beatmaker — un seul
-- template fixe géré par l'admin pour tout le monde.
-- ============================================================

create table if not exists templates_plateforme (
  id         uuid primary key default gen_random_uuid(),
  type       text not null unique check (type in (
               'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
               'paiement_echoue', 'annulation'
             )),
  titre      text,
  intro      text,
  updated_at timestamptz not null default now()
);

alter table templates_plateforme enable row level security;

-- Aucune policy authenticated : uniquement lu/écrit via createAdminClient()
-- (service_role), toujours derrière estAdmin() côté serveur — même pattern
-- que les autres tables purement admin (ex. categories côté plateforme).
grant all on templates_plateforme to service_role;

-- ============================================================
-- Mise à jour (2026-07-28) — 6ᵉ type : confirmation_email
-- ============================================================
-- Jusqu'ici, l'inscription beatmaker s'appuyait sur l'email de confirmation
-- générique envoyé automatiquement par Supabase — le vrai bug (bienvenue
-- qui ne partait jamais) vient du fait que la confirmation n'était jamais
-- attendue avant de tenter d'envoyer la bienvenue (voir ROADMAP.md et
-- memory/project_mails_my_producer.md, mise à jour 2026-07-28). La
-- confirmation d'adresse email devient donc elle-même un email envoyé par
-- nous (Resend), pour être branded + personnalisable comme les 5 autres.

alter table templates_plateforme drop constraint if exists templates_plateforme_type_check;
alter table templates_plateforme add constraint templates_plateforme_type_check check (type in (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email'
));
