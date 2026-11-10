-- Domaine personnalisé par boutique (rang 9c, lot 2) : suivi de la vérification
-- et 3 nouveaux emails Sonoo. Une seule transaction : tout passe ou rien ne change.

begin;

alter table public.domaines_boutique
  add column domaine_entier boolean not null default false,
  add column lignes_dns jsonb not null default '[]'::jsonb,
  add column explication text,
  add column echecs_consecutifs integer not null default 0,
  add column derniere_verification_le timestamptz,
  add column premiere_activation_le timestamptz;

-- Le domaine de test du lot 1 fonctionne déjà : il ne doit jamais être libéré
-- par la règle des 30 jours.
update public.domaines_boutique
  set premiere_activation_le = created_at
  where domaine = 'test.jakebmusic.com' and statut = 'actif';

create index domaines_boutique_file_idx
  on public.domaines_boutique (derniere_verification_le asc nulls first);

alter table public.templates_plateforme drop constraint if exists templates_plateforme_type_check;
alter table public.templates_plateforme add constraint templates_plateforme_type_check check (type in (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'suspension',
  'collab_invitation', 'collab_acceptation', 'collab_refus', 'collab_retrait',
  'collab_depart', 'collab_eviction', 'collab_beat_supprime', 'collab_pause',
  'conditions_mise_a_jour',
  'nouvelle_vente',
  'remboursement_vente', 'remboursement_incomplet',
  'litige_ouvert', 'litige_rappel', 'litige_collaborateur',
  'domaine_actif', 'domaine_probleme', 'domaine_libere'
));

commit;
