-- Snapshot des informations professionnelles propres à chaque facture.
-- Ces données appartiennent à la commande, jamais à la fiche CRM du client.

alter table commandes
  add column if not exists acheteur_raison_sociale text,
  add column if not exists acheteur_numero_tva text;

comment on column commandes.acheteur_raison_sociale is
  'Raison sociale déclarée pour cette commande uniquement, affichée sur la facture.';

comment on column commandes.acheteur_numero_tva is
  'Numéro de TVA déclaré pour cette commande uniquement, affiché sur la facture.';
