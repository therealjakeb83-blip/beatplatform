-- ============================================================
-- Phase 9 (fondations OSS/B2B) — distinction particulier/professionnel
-- côté client, capturée sur la nouvelle page de paiement custom.
-- Fondations de données uniquement : aucune logique fiscale active
-- (pas de calcul de TVA par pays, pas de vérification VIES).
-- ============================================================

alter table clients add column if not exists type_client text not null default 'particulier'
  check (type_client in ('particulier', 'professionnel'));

alter table clients add column if not exists raison_sociale text;
alter table clients add column if not exists numero_tva text;

comment on column clients.type_client is
  'Particulier ou professionnel, déclaré par le client au paiement — réutilisé/pré-rempli aux achats suivants, comme pays/adresse.';
comment on column clients.raison_sociale is
  'Nom de la société du client, renseigné uniquement si type_client = professionnel.';
comment on column clients.numero_tva is
  'Numéro de TVA intracommunautaire du client (achat pro), texte libre — pas de vérification VIES, fondation de données seulement.';
