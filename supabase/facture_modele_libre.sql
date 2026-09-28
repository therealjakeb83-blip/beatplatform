-- Facture « modèle libre » (lot séparé juste avant la Phase 13 du chantier 9 bis)
-- Décision Q6c du grill-me Phase 12 (memory/project_phase12_grillme_decisions_2026_09_21.md).
--
-- beatmakers.facture_modele : choix explicite du beatmaker ('francais' ou 'libre').
--   NULL = jamais choisi → modèle déduit de beatmakers.pays (FR → francais,
--   autre → libre), calculé dans le code (lib/facturation.ts), donc il suit un
--   changement de pays tant que le beatmaker n'a rien choisi.
-- beatmakers.facture_mentions : texte libre ajouté en bas de chaque facture.
--
-- commandes.facture_modele / facture_mentions : copie figée au moment où le
--   numéro de facture est attribué (même principe que tva_numero), pour qu'une
--   facture régénérée plus tard ne change jamais. NULL sur les commandes
--   existantes = « Français sans mention » (le comportement d'avant ce lot).
--
-- Aucune donnée existante n'est modifiée.

begin;

alter table beatmakers add column if not exists facture_modele text;
alter table beatmakers add column if not exists facture_mentions text;
alter table commandes add column if not exists facture_modele text;
alter table commandes add column if not exists facture_mentions text;

alter table beatmakers drop constraint if exists beatmakers_facture_modele_check;
alter table beatmakers add constraint beatmakers_facture_modele_check
  check (facture_modele is null or facture_modele in ('francais', 'libre'));
alter table beatmakers drop constraint if exists beatmakers_facture_mentions_longueur;
alter table beatmakers add constraint beatmakers_facture_mentions_longueur
  check (facture_mentions is null or char_length(facture_mentions) <= 500);

alter table commandes drop constraint if exists commandes_facture_modele_check;
alter table commandes add constraint commandes_facture_modele_check
  check (facture_modele is null or facture_modele in ('francais', 'libre'));

commit;

-- ============================================================
-- Vérifications (à lancer après la migration)
-- ============================================================
-- 1. Les 4 colonnes existent :
-- select table_name, column_name, data_type from information_schema.columns
-- where column_name in ('facture_modele', 'facture_mentions') order by table_name, column_name;
--   → 4 lignes (beatmakers x2, commandes x2)
--
-- 2. Aucune donnée existante touchée (tout doit être à 0) :
-- select
--   (select count(*) from beatmakers where facture_modele is not null or facture_mentions is not null) as beatmakers_remplis,
--   (select count(*) from commandes where facture_modele is not null or facture_mentions is not null) as commandes_remplies;
--
-- 3. Valeurs de pays existantes (le modèle par défaut compare avec 'FR') :
-- select pays, count(*) from beatmakers group by pays order by count(*) desc;
