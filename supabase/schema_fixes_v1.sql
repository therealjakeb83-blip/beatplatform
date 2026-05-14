-- ============================================================
-- My Producer — Corrections du schéma v1
-- À exécuter dans l'éditeur SQL de Supabase après schema.sql
-- ============================================================

-- Un seul modèle de licence par beatmaker (pas deux licences "mp3" pour le même beatmaker)
alter table licences
  add constraint licences_unique_modele_par_beatmaker
  unique (beatmaker_id, modele);

-- Les deux clients dans un doublon ignoré doivent être différents
alter table doublons_ignores
  add constraint doublons_clients_differents
  check (client_id_1 <> client_id_2);

-- Prix et montants ne peuvent pas être négatifs
alter table licences
  add constraint licences_prix_positif
  check (prix >= 0);

alter table commandes
  add constraint commandes_prix_paye_positif
  check (prix_paye >= 0);

alter table commandes
  add constraint commandes_montant_rembourse_positif
  check (montant_rembourse >= 0);

alter table commandes
  add constraint commandes_remboursement_coherent
  check (montant_rembourse <= prix_paye);

alter table commandes
  add constraint commandes_reduction_positive
  check (reduction_montant >= 0);

alter table abonnements_plateforme
  add constraint abonnements_plateforme_prix_positif
  check (prix >= 0);

alter table abonnements_boutique
  add constraint abonnements_boutique_prix_positif
  check (prix >= 0);

-- BPM doit être un nombre positif
alter table beats
  add constraint beats_bpm_positif
  check (bpm > 0);

-- Taux de TVA entre 0 et 100
alter table beatmakers
  add constraint beatmakers_tva_taux_valide
  check (tva_taux >= 0 and tva_taux <= 100);

-- Un seul abonnement actif (ou en essai, ou impayé) par beatmaker sur la plateforme
create unique index abonnements_plateforme_un_actif
  on abonnements_plateforme (beatmaker_id)
  where statut in ('en_essai', 'actif', 'impaye');

-- Un seul abonnement actif (ou impayé) par artiste par boutique
create unique index abonnements_boutique_un_actif
  on abonnements_boutique (client_id, beatmaker_id)
  where statut in ('actif', 'impaye');
