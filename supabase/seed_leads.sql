-- ============================================================
-- SEED : 20 leads de test (clients sans commandes)
-- ============================================================
DO $$
DECLARE
  bm_id   uuid;
  b1_id   uuid;
  b2_id   uuid;
  b3_id   uuid;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE slug = 'jakeb-test';
  IF bm_id IS NULL THEN
    RAISE EXCEPTION 'Beatmaker jakeb-test introuvable';
  END IF;
  SELECT id INTO b1_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 0;
  SELECT id INTO b2_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 1;
  SELECT id INTO b3_id FROM beats WHERE beatmaker_id = bm_id LIMIT 1 OFFSET 2;

  -- ── Nettoyage leads existants pour ces emails (mauvais beatmaker_id) ─────
  DELETE FROM leads
  WHERE client_id IN (
    SELECT id FROM clients WHERE email IN (
      'kevin.martin.beats@gmail.com','yanis.bouchama@hotmail.fr','dylan.roussel@gmail.com',
      'nathan.fabre@icloud.com','axel.petit.music@gmail.com','thibault.remy@gmail.com',
      'antoine.guerin@protonmail.com','loic.bonnet@gmail.com','marcus.j.music@gmail.com',
      'jamal.williams.beats@gmail.com','devon.carter.prod@gmail.com','tyler.brooks.music@gmail.com',
      'james.mitchell.uk@gmail.com','ryan.thompson.beats@gmail.com','connor.walsh.prod@gmail.com',
      'sidy.diallo.music@gmail.com','mohammed.alaoui@gmail.com','pierre.tremblay.beats@gmail.com',
      'alex.gagnon.prod@gmail.com','kwame.asante.music@gmail.com'
    )
  );

  -- ── Clients leads ────────────────────────────────────────────
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent,created_at) VALUES
    (gen_random_uuid(),'Kevin','Martin','KvnBeat','kevin.martin.beats@gmail.com','FR',true, NOW() - INTERVAL '45 days'),
    (gen_random_uuid(),'Yanis','Bouchama','YanFlow','yanis.bouchama@hotmail.fr','FR',false,NOW() - INTERVAL '12 days'),
    (gen_random_uuid(),'Dylan','Roussel','DylBeats','dylan.roussel@gmail.com','FR',true, NOW() - INTERVAL '60 days'),
    (gen_random_uuid(),'Nathan','Fabre','NathProd','nathan.fabre@icloud.com','FR',true, NOW() - INTERVAL '8 days'),
    (gen_random_uuid(),'Axel','Petit','AxelMP','axel.petit.music@gmail.com','FR',false,NOW() - INTERVAL '30 days'),
    (gen_random_uuid(),'Thibault','Remy','ThibRap','thibault.remy@gmail.com','FR',false,NOW() - INTERVAL '90 days'),
    (gen_random_uuid(),'Antoine','Guerin','TwanProd','antoine.guerin@protonmail.com','FR',true, NOW() - INTERVAL '21 days'),
    (gen_random_uuid(),'Loic','Bonnet','LcBeat','loic.bonnet@gmail.com','FR',false,NOW() - INTERVAL '5 days'),
    (gen_random_uuid(),'Marcus','Johnson','MarcusJ','marcus.j.music@gmail.com','US',true, NOW() - INTERVAL '38 days'),
    (gen_random_uuid(),'Jamal','Williams','JamalW','jamal.williams.beats@gmail.com','US',true, NOW() - INTERVAL '15 days'),
    (gen_random_uuid(),'Devon','Carter','DevCart','devon.carter.prod@gmail.com','US',false,NOW() - INTERVAL '55 days'),
    (gen_random_uuid(),'Tyler','Brooks','TyBrooks','tyler.brooks.music@gmail.com','US',false,NOW() - INTERVAL '3 days'),
    (gen_random_uuid(),'James','Mitchell','JMitch','james.mitchell.uk@gmail.com','GB',true, NOW() - INTERVAL '70 days'),
    (gen_random_uuid(),'Ryan','Thompson','RThompson','ryan.thompson.beats@gmail.com','GB',false,NOW() - INTERVAL '18 days'),
    (gen_random_uuid(),'Connor','Walsh','CWalsh','connor.walsh.prod@gmail.com','GB',true, NOW() - INTERVAL '40 days'),
    (gen_random_uuid(),'Sidy','Diallo','SidyFlow','sidy.diallo.music@gmail.com','SN',true, NOW() - INTERVAL '25 days'),
    (gen_random_uuid(),'Mohammed','Alaoui','MoAlaw','mohammed.alaoui@gmail.com','MA',false,NOW() - INTERVAL '50 days'),
    (gen_random_uuid(),'Pierre','Tremblay','PierrT','pierre.tremblay.beats@gmail.com','CA',true, NOW() - INTERVAL '14 days'),
    (gen_random_uuid(),'Alex','Gagnon','AlexG','alex.gagnon.prod@gmail.com','CA',false,NOW() - INTERVAL '33 days'),
    (gen_random_uuid(),'Kwame','Asante','KwameProd','kwame.asante.music@gmail.com','US',true, NOW() - INTERVAL '7 days')
  ON CONFLICT(email) DO NOTHING;

  -- ── Leads ────────────────────────────────────────────────────
  INSERT INTO leads(client_id, beatmaker_id, source, newsletter_inscrit, created_at)
  SELECT c.id, bm_id,
    CASE c.email
      WHEN 'kevin.martin.beats@gmail.com'    THEN 'newsletter'
      WHEN 'yanis.bouchama@hotmail.fr'       THEN 'free_download'
      WHEN 'dylan.roussel@gmail.com'         THEN 'visite'
      WHEN 'nathan.fabre@icloud.com'         THEN 'newsletter'
      WHEN 'axel.petit.music@gmail.com'      THEN 'free_download'
      WHEN 'thibault.remy@gmail.com'         THEN 'visite'
      WHEN 'antoine.guerin@protonmail.com'   THEN 'newsletter'
      WHEN 'loic.bonnet@gmail.com'           THEN 'visite'
      WHEN 'marcus.j.music@gmail.com'        THEN 'free_download'
      WHEN 'jamal.williams.beats@gmail.com'  THEN 'newsletter'
      WHEN 'devon.carter.prod@gmail.com'     THEN 'visite'
      WHEN 'tyler.brooks.music@gmail.com'    THEN 'free_download'
      WHEN 'james.mitchell.uk@gmail.com'     THEN 'newsletter'
      WHEN 'ryan.thompson.beats@gmail.com'   THEN 'visite'
      WHEN 'connor.walsh.prod@gmail.com'     THEN 'free_download'
      WHEN 'sidy.diallo.music@gmail.com'     THEN 'newsletter'
      WHEN 'mohammed.alaoui@gmail.com'       THEN 'visite'
      WHEN 'pierre.tremblay.beats@gmail.com' THEN 'newsletter'
      WHEN 'alex.gagnon.prod@gmail.com'      THEN 'visite'
      WHEN 'kwame.asante.music@gmail.com'    THEN 'free_download'
    END,
    c.newsletter_consent,
    c.created_at
  FROM clients c
  WHERE c.email IN (
    'kevin.martin.beats@gmail.com','yanis.bouchama@hotmail.fr','dylan.roussel@gmail.com',
    'nathan.fabre@icloud.com','axel.petit.music@gmail.com','thibault.remy@gmail.com',
    'antoine.guerin@protonmail.com','loic.bonnet@gmail.com','marcus.j.music@gmail.com',
    'jamal.williams.beats@gmail.com','devon.carter.prod@gmail.com','tyler.brooks.music@gmail.com',
    'james.mitchell.uk@gmail.com','ryan.thompson.beats@gmail.com','connor.walsh.prod@gmail.com',
    'sidy.diallo.music@gmail.com','mohammed.alaoui@gmail.com','pierre.tremblay.beats@gmail.com',
    'alex.gagnon.prod@gmail.com','kwame.asante.music@gmail.com'
  )
  ON CONFLICT DO NOTHING;

  -- ── Favoris (pour 9 leads) ────────────────────────────────────
  IF b1_id IS NOT NULL THEN
    INSERT INTO favoris(client_id, beat_id)
    SELECT c.id, b1_id FROM clients c
    WHERE c.email IN (
      'kevin.martin.beats@gmail.com','jamal.williams.beats@gmail.com',
      'marcus.j.music@gmail.com','james.mitchell.uk@gmail.com',
      'sidy.diallo.music@gmail.com','kwame.asante.music@gmail.com',
      'pierre.tremblay.beats@gmail.com','antoine.guerin@protonmail.com',
      'axel.petit.music@gmail.com'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF b2_id IS NOT NULL THEN
    INSERT INTO favoris(client_id, beat_id)
    SELECT c.id, b2_id FROM clients c
    WHERE c.email IN (
      'kevin.martin.beats@gmail.com','jamal.williams.beats@gmail.com',
      'marcus.j.music@gmail.com','sidy.diallo.music@gmail.com',
      'kwame.asante.music@gmail.com'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF b3_id IS NOT NULL THEN
    INSERT INTO favoris(client_id, beat_id)
    SELECT c.id, b3_id FROM clients c
    WHERE c.email IN (
      'kevin.martin.beats@gmail.com','marcus.j.music@gmail.com',
      'kwame.asante.music@gmail.com'
    )
    ON CONFLICT DO NOTHING;
  END IF;

END $$;
