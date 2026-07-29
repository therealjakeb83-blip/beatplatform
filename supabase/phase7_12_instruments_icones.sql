-- ============================================================
-- PHASE 7.12 — Nouveau design "instruments" (dégradé + icône)
-- ============================================================
-- Remplace les 9 catégories instruments existantes (aucune n'avait
-- d'image_url) par les 15 catégories du nouveau paquet design, certifiées
-- d'office (source=plateforme, statut=certifiee) avec icône statique
-- (public/img/instruments/<slug>.png — pas le pipeline R2 de
-- /api/upload/categorie-image, pensé pour des photos 600×600 cover, pas
-- pour des silhouettes blanches transparentes).
--
-- "Guitare" (12 beats tagués) n'a pas d'équivalent exact dans la nouvelle
-- liste qui distingue acoustique/électrique — migré vers "Guitare
-- acoustique" (décision Jake, 2026-07-29). "Flûte" (11 beats) matche déjà
-- le nouveau nom tel quel. "Cordes" (11 beats) était déjà orpheline avant
-- cette migration (absente de la table categories depuis un moment) —
-- non traitée ici, hors scope.

update beats
set instruments = array_replace(instruments, 'Guitare', 'Guitare acoustique')
where instruments @> array['Guitare'];

delete from categories where type = 'instruments';

insert into categories (type, nom, source, statut, image_url) values
  ('instruments', 'Piano',               'plateforme', 'certifiee', '/img/instruments/piano.png'),
  ('instruments', 'Voix',                'plateforme', 'certifiee', '/img/instruments/voix.png'),
  ('instruments', 'Violons',             'plateforme', 'certifiee', '/img/instruments/violons.png'),
  ('instruments', 'Guitare acoustique',  'plateforme', 'certifiee', '/img/instruments/guitare-acoustique.png'),
  ('instruments', 'Guitare électrique',  'plateforme', 'certifiee', '/img/instruments/guitare-electrique.png'),
  ('instruments', 'Sample',              'plateforme', 'certifiee', '/img/instruments/sample.png'),
  ('instruments', 'Trompette',           'plateforme', 'certifiee', '/img/instruments/trompette.png'),
  ('instruments', 'Saxophone',           'plateforme', 'certifiee', '/img/instruments/saxophone.png'),
  ('instruments', 'Bells',               'plateforme', 'certifiee', '/img/instruments/bells.png'),
  ('instruments', 'Flûte',               'plateforme', 'certifiee', '/img/instruments/flute.png'),
  ('instruments', 'Pad',                 'plateforme', 'certifiee', '/img/instruments/pad.png'),
  ('instruments', 'Harpe',               'plateforme', 'certifiee', '/img/instruments/harpe.png'),
  ('instruments', 'Xylophone',           'plateforme', 'certifiee', '/img/instruments/xylophone.png'),
  ('instruments', 'Synthés',             'plateforme', 'certifiee', '/img/instruments/synthes.png'),
  ('instruments', 'Orgue',               'plateforme', 'certifiee', '/img/instruments/orgue.png');
