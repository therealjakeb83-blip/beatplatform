-- ============================================================
-- PHASE 7.13 — Nouveau design "ambiances" (photo N&B + halo couleur)
-- ============================================================
-- Remplace les 9 catégories ambiances existantes par les 9 du nouveau
-- pack design (photo + masque de halo, voir ambiances-export/README.md),
-- certifiées d'office (source=plateforme, statut=certifiee), même
-- traitement que phase7_12_instruments_icones.sql.
--
-- Contrairement aux instruments, les tags posés sur les beats
-- (beats.ambiances) ne correspondaient déjà plus aux noms de la table
-- categories avant cette migration (données de seed jamais réconciliées).
-- Remap best-effort décidé par Claude (validation Jake : "remplace et
-- certifie comme les instruments", 2026-07-31) :
--   Energetic, Énergétique     → Énergique
--   Chill, Doux                → Calme
--   Festif                     → Bouncy
--   Romantique                 → Love
--   Hypnotique                 → Planant
--   Nostalgique                → Mélancolique
-- Sombre, Mélancolique, Agressif ne bougent pas (déjà les bons noms).
-- Mystérieux (44 beats) et Épique (11 beats) n'ont pas d'équivalent
-- clair dans les 9 nouveaux slugs — laissés orphelins, hors scope,
-- même traitement que "Cordes" dans phase7_12.

update beats set ambiances = array_replace(ambiances, 'Energetic', 'Énergique') where ambiances @> array['Energetic'];
update beats set ambiances = array_replace(ambiances, 'Énergétique', 'Énergique') where ambiances @> array['Énergétique'];
update beats set ambiances = array_replace(ambiances, 'Chill', 'Calme') where ambiances @> array['Chill'];
update beats set ambiances = array_replace(ambiances, 'Doux', 'Calme') where ambiances @> array['Doux'];
update beats set ambiances = array_replace(ambiances, 'Festif', 'Bouncy') where ambiances @> array['Festif'];
update beats set ambiances = array_replace(ambiances, 'Romantique', 'Love') where ambiances @> array['Romantique'];
update beats set ambiances = array_replace(ambiances, 'Hypnotique', 'Planant') where ambiances @> array['Hypnotique'];
update beats set ambiances = array_replace(ambiances, 'Nostalgique', 'Mélancolique') where ambiances @> array['Nostalgique'];

delete from categories where type = 'ambiances';

insert into categories (type, nom, source, statut, image_url) values
  ('ambiances', 'Agressif',     'plateforme', 'certifiee', '/img/ambiances/agressif.png'),
  ('ambiances', 'Bouncy',       'plateforme', 'certifiee', '/img/ambiances/bouncy.png'),
  ('ambiances', 'Calme',        'plateforme', 'certifiee', '/img/ambiances/calme.png'),
  ('ambiances', 'Énergique',    'plateforme', 'certifiee', '/img/ambiances/energique.png'),
  ('ambiances', 'Love',         'plateforme', 'certifiee', '/img/ambiances/love.png'),
  ('ambiances', 'Mélancolique', 'plateforme', 'certifiee', '/img/ambiances/melancolique.png'),
  ('ambiances', 'Planant',      'plateforme', 'certifiee', '/img/ambiances/planant.png'),
  ('ambiances', 'Sombre',       'plateforme', 'certifiee', '/img/ambiances/sombre.png'),
  ('ambiances', 'Triste',       'plateforme', 'certifiee', '/img/ambiances/triste.png');
