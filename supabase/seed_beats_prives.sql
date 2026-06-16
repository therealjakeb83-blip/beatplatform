-- ============================================================
-- 10 BEATS RÉSERVÉS AUX MEMBRES (statut = 'prive')
-- + beat_licences (5 licences chacun)
-- + URLs fichiers de test
-- Idempotent : ON CONFLICT DO NOTHING sur beat_licences
-- ============================================================

DO $$
DECLARE
  bm_id UUID;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com' LIMIT 1;
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Beatmaker nicojacob83+test@gmail.com introuvable'; END IF;

  -- Supprimer les éventuels doublons d'un run précédent
  DELETE FROM beats
  WHERE beatmaker_id = bm_id
    AND titre IN ('Overdose','Eclipse','Paradise','Cinématique','Tsunami',
                  'Golden Hour','Zone Grise','Mambo','Dusk','Utopia');

  -- ── 10 beats privés ─────────────────────────────────────────────────────
  INSERT INTO beats (beatmaker_id, titre, bpm, cle, styles, ambiances, type_beat, statut,
                     mp3_tague_url, mp3_propre_url, wav_url, stems_url, image_url, created_at)
  VALUES
    (bm_id,'Overdose',    138,'Fa min',        ARRAY['Drill'],       ARRAY['Mélancolique','Sombre'],   ARRAY['Hamza','Freeze Corleone'],   'prive',
     'https://cdn.test/overdose_tagged.mp3','https://cdn.test/overdose_clean.mp3','https://cdn.test/overdose.wav','https://cdn.test/overdose_stems.zip',
     'https://picsum.photos/seed/overdose/400/400',  NOW()-INTERVAL'14 months'),

    (bm_id,'Eclipse',     142,'Mi min',        ARRAY['Trap'],        ARRAY['Mystérieux','Sombre'],     ARRAY['SCH','Jul'],                'prive',
     'https://cdn.test/eclipse_tagged.mp3','https://cdn.test/eclipse_clean.mp3','https://cdn.test/eclipse.wav','https://cdn.test/eclipse_stems.zip',
     'https://picsum.photos/seed/eclipse/400/400',   NOW()-INTERVAL'12 months'),

    (bm_id,'Paradise',    105,'Sol maj',       ARRAY['Afrobeats'],   ARRAY['Festif','Énergétique'],    ARRAY['Afro','WizKid'],            'prive',
     'https://cdn.test/paradise_tagged.mp3','https://cdn.test/paradise_clean.mp3','https://cdn.test/paradise.wav','https://cdn.test/paradise_stems.zip',
     'https://picsum.photos/seed/paradise/400/400',  NOW()-INTERVAL'10 months'),

    (bm_id,'Cinématique', 90, 'Si bémol maj',  ARRAY['Boom Bap'],    ARRAY['Nostalgique','Épique'],    ARRAY['Ninho','Nekfeu'],           'prive',
     'https://cdn.test/cinematique_tagged.mp3','https://cdn.test/cinematique_clean.mp3','https://cdn.test/cinematique.wav','https://cdn.test/cinematique_stems.zip',
     'https://picsum.photos/seed/cinematique/400/400', NOW()-INTERVAL'9 months'),

    (bm_id,'Tsunami',     145,'La min',        ARRAY['Trap'],        ARRAY['Agressif','Énergétique'],  ARRAY['Niska','PLK'],              'prive',
     'https://cdn.test/tsunami_tagged.mp3','https://cdn.test/tsunami_clean.mp3','https://cdn.test/tsunami.wav','https://cdn.test/tsunami_stems.zip',
     'https://picsum.photos/seed/tsunami/400/400',   NOW()-INTERVAL'8 months'),

    (bm_id,'Golden Hour', 88, 'Ré maj',        ARRAY['R&B'],         ARRAY['Romantique','Doux'],       ARRAY['Awa Imani','Tayc'],         'prive',
     'https://cdn.test/goldenhour_tagged.mp3','https://cdn.test/goldenhour_clean.mp3','https://cdn.test/goldenhour.wav','https://cdn.test/goldenhour_stems.zip',
     'https://picsum.photos/seed/goldenhour/400/400', NOW()-INTERVAL'7 months'),

    (bm_id,'Zone Grise',  128,'Do min',        ARRAY['Cloud Rap'],   ARRAY['Sombre','Mélancolique'],   ARRAY['Lomepal','Orelsan'],        'prive',
     'https://cdn.test/zonegrise_tagged.mp3','https://cdn.test/zonegrise_clean.mp3','https://cdn.test/zonegrise.wav','https://cdn.test/zonegrise_stems.zip',
     'https://picsum.photos/seed/zonegrise/400/400', NOW()-INTERVAL'6 months'),

    (bm_id,'Mambo',       96, 'Sol min',       ARRAY['Reggaeton'],   ARRAY['Festif','Énergétique'],    ARRAY['Dadju','Awa Imani'],        'prive',
     'https://cdn.test/mambo_tagged.mp3','https://cdn.test/mambo_clean.mp3','https://cdn.test/mambo.wav','https://cdn.test/mambo_stems.zip',
     'https://picsum.photos/seed/mambo/400/400',     NOW()-INTERVAL'5 months'),

    (bm_id,'Dusk',        140,'Mi bémol min',  ARRAY['Drill UK'],    ARRAY['Sombre','Agressif'],       ARRAY['Central Cee','Dave'],       'prive',
     'https://cdn.test/dusk_tagged.mp3','https://cdn.test/dusk_clean.mp3','https://cdn.test/dusk.wav','https://cdn.test/dusk_stems.zip',
     'https://picsum.photos/seed/dusk/400/400',      NOW()-INTERVAL'3 months'),

    (bm_id,'Utopia',      130,'Fa# min',       ARRAY['Cloud Rap'],   ARRAY['Mélancolique','Doux'],     ARRAY['Lomepal','Odezenne'],       'prive',
     'https://cdn.test/utopia_tagged.mp3','https://cdn.test/utopia_clean.mp3','https://cdn.test/utopia.wav','https://cdn.test/utopia_stems.zip',
     'https://picsum.photos/seed/utopia/400/400',    NOW()-INTERVAL'6 weeks');

  RAISE NOTICE '10 beats privés insérés';

  -- ── Activer les 5 licences sur chacun ──────────────────────────────────
  INSERT INTO beat_licences (beat_id, licence_id, actif)
  SELECT b.id, l.id, true
  FROM beats b
  CROSS JOIN licences l
  WHERE b.beatmaker_id = bm_id
    AND b.titre IN ('Overdose','Eclipse','Paradise','Cinématique','Tsunami',
                    'Golden Hour','Zone Grise','Mambo','Dusk','Utopia')
    AND l.beatmaker_id = bm_id
  ON CONFLICT (beat_id, licence_id) DO NOTHING;

  RAISE NOTICE 'beat_licences activés pour les 10 beats privés';
END $$;
