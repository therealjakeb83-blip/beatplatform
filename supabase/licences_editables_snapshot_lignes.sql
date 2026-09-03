-- ============================================================
-- Chantier 9 bis, Phase 6 — Licences éditables
-- Étape 3c : snapshot des limites de licence sur commande_lignes
-- ============================================================
-- Même principe déjà appliqué à licence_nom/licence_modele/licence_inclut_*
-- (Phase 4, phase4_snapshot_transactionnel.sql) : le contrat PDF généré à
-- la vente doit toujours refléter les limites de licence telles qu'elles
-- étaient AU MOMENT de l'achat, jamais les valeurs *actuelles* de la
-- licence si le beatmaker les modifie après coup — en particulier pour la
-- reprise de livraison (Phase 5), qui peut régénérer un contrat bien après
-- la vente.

alter table commande_lignes add column if not exists licence_streams_limite integer;
alter table commande_lignes add column if not exists licence_ventes_physiques_limite integer;
alter table commande_lignes add column if not exists licence_vues_video_limite integer;
alter table commande_lignes add column if not exists licence_clips_video_limite integer;
alter table commande_lignes add column if not exists licence_radio_tv_limite integer;
alter table commande_lignes add column if not exists licence_lives_performances_autorise boolean;

comment on column commande_lignes.licence_streams_limite is
  'Snapshot de licences.streams_limite au moment de l''achat — jamais la valeur actuelle.';
comment on column commande_lignes.licence_ventes_physiques_limite is
  'Voir licence_streams_limite.';
comment on column commande_lignes.licence_vues_video_limite is
  'Voir licence_streams_limite.';
comment on column commande_lignes.licence_clips_video_limite is
  'Voir licence_streams_limite.';
comment on column commande_lignes.licence_radio_tv_limite is
  'Voir licence_streams_limite.';
comment on column commande_lignes.licence_lives_performances_autorise is
  'Voir licence_streams_limite.';
