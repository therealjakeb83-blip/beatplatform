-- ============================================================
-- Audit 2026-07-29 (F3) — Emails de collab migrés vers "Mails My Producer"
-- ============================================================
-- envoyerInvitationCollab / envoyerFondsEnAttente / envoyerRappelFonds /
-- envoyerConfirmationExpiration passaient jusqu'ici par de simples emails
-- texte, hors du système de branding/logs admin déjà en place pour les
-- 6 autres emails plateforme→beatmaker (templates_plateforme). 4 nouveaux
-- types, mêmes règles que les autres (titre+intro éditables, une seule
-- ligne par type, jamais personnalisable par un beatmaker).

alter table templates_plateforme drop constraint if exists templates_plateforme_type_check;
alter table templates_plateforme add constraint templates_plateforme_type_check check (type in (
  'bienvenue', 'confirmation_essai', 'rappel_fin_essai',
  'paiement_echoue', 'annulation', 'confirmation_email',
  'collab_invitation', 'collab_fonds_attente', 'collab_rappel_fonds', 'collab_expiration'
));
