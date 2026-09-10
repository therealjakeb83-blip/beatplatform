-- ============================================================
-- Phase 9 (suite) — page de paiement custom : capture des coordonnées
-- acheteur directement par notre formulaire (plus de billing_details Stripe
-- comme seule source), et du choix particulier/professionnel.
-- ============================================================

alter table tentatives_paiement add column if not exists prenom text;
alter table tentatives_paiement add column if not exists nom text;
alter table tentatives_paiement add column if not exists telephone text;
alter table tentatives_paiement add column if not exists adresse text;
alter table tentatives_paiement add column if not exists code_postal text;
alter table tentatives_paiement add column if not exists ville text;
alter table tentatives_paiement add column if not exists pays text;
alter table tentatives_paiement add column if not exists type_client text
  check (type_client in ('particulier', 'professionnel'));
alter table tentatives_paiement add column if not exists raison_sociale text;
alter table tentatives_paiement add column if not exists numero_tva text;

comment on column tentatives_paiement.type_client is
  'Choix déclaré par le client sur la page de paiement custom (Phase 9) — repris tel quel sur clients.type_client au moment où la commande est finalisée.';
