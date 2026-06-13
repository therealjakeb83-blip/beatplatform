-- ============================================================
-- SEED : free_downloads pour les leads avec source='free_download'
-- À exécuter APRÈS seed_leads.sql
-- ============================================================
DO $$
DECLARE
  bm_id uuid;
  b1_id uuid;
  b2_id uuid;
  b3_id uuid;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE slug = 'jakeb-test';
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Beatmaker jakeb-test introuvable'; END IF;

  SELECT id INTO b1_id FROM beats WHERE beatmaker_id = bm_id AND free_download_actif = true LIMIT 1 OFFSET 0;
  SELECT id INTO b2_id FROM beats WHERE beatmaker_id = bm_id AND free_download_actif = true LIMIT 1 OFFSET 1;
  SELECT id INTO b3_id FROM beats WHERE beatmaker_id = bm_id AND free_download_actif = true LIMIT 1 OFFSET 2;

  -- Fallback si aucun beat free_download_actif
  IF b1_id IS NULL THEN SELECT id INTO b1_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 0; END IF;
  IF b2_id IS NULL THEN SELECT id INTO b2_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 1; END IF;
  IF b3_id IS NULL THEN SELECT id INTO b3_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 2; END IF;

  -- 1 download chacun (6 leads source='free_download')
  INSERT INTO free_downloads (beatmaker_id, client_id, beat_id, downloaded_at)
  SELECT bm_id, c.id, b1_id, c.created_at + INTERVAL '12 minutes'
  FROM clients c
  WHERE c.email IN (
    'yanis.bouchama@hotmail.fr',
    'axel.petit.music@gmail.com',
    'marcus.j.music@gmail.com',
    'tyler.brooks.music@gmail.com',
    'connor.walsh.prod@gmail.com',
    'kwame.asante.music@gmail.com'
  )
  AND b1_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM free_downloads fd
    WHERE fd.client_id = c.id AND fd.beat_id = b1_id AND fd.beatmaker_id = bm_id
  );

  -- Marcus et Kwame ont téléchargé un 2ème beat (très engagés, 3 favoris chacun)
  IF b2_id IS NOT NULL THEN
    INSERT INTO free_downloads (beatmaker_id, client_id, beat_id, downloaded_at)
    SELECT bm_id, c.id, b2_id, c.created_at + INTERVAL '2 days'
    FROM clients c
    WHERE c.email IN ('marcus.j.music@gmail.com', 'kwame.asante.music@gmail.com')
    AND NOT EXISTS (
      SELECT 1 FROM free_downloads fd
      WHERE fd.client_id = c.id AND fd.beat_id = b2_id AND fd.beatmaker_id = bm_id
    );
  END IF;

  -- Kevin Martin aussi (lead newsletter mais a quand même téléchargé)
  IF b3_id IS NOT NULL THEN
    INSERT INTO free_downloads (beatmaker_id, client_id, beat_id, downloaded_at)
    SELECT bm_id, c.id, b3_id, c.created_at + INTERVAL '5 days'
    FROM clients c
    WHERE c.email = 'kevin.martin.beats@gmail.com'
    AND NOT EXISTS (
      SELECT 1 FROM free_downloads fd
      WHERE fd.client_id = c.id AND fd.beat_id = b3_id AND fd.beatmaker_id = bm_id
    );
  END IF;

  RAISE NOTICE 'seed_free_downloads terminé';
END $$;
