-- ============================================================
-- DONNÉES TEST RÉALISTES — Beats × 20 + Commandes cohérentes
-- À exécuter dans l'éditeur SQL Supabase (une seule fois)
--
-- Ce script :
--   1. Supprime toutes les commandes LICENCE fictives existantes
--   2. Insère 20 nouveaux beats avec diversité de styles/types/ambiances
--   3. Réinsère ~80 commandes réalistes :
--      - Prix = prix exact de la licence (MP3=25€, WAV=45€, Stems=75€, Illimité=150€, Exclusive=500€)
--      - Exclusive vendu une seule fois sur un seul beat
--      - Repartition : ~60% MP3, ~30% WAV, ~5% Stems, ~3% Illimité, ~1% Exclusive
-- ============================================================

DO $$
DECLARE
  bm_id    UUID;

  -- IDs licences
  lic_mp3  UUID; p_mp3  INT;
  lic_wav  UUID; p_wav  INT;
  lic_stm  UUID; p_stm  INT;
  lic_ill  UUID; p_ill  INT;
  lic_excl UUID; p_excl INT;

  -- Clients inconnus (récupérés depuis leads, sans email connu)
  unknown_clients UUID[];
  c_id UUID;

BEGIN
  -- ── 0. Beatmaker + licences ──────────────────────────────────────
  SELECT id INTO bm_id FROM beatmakers LIMIT 1;
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Aucun beatmaker trouvé dans la base'; END IF;

  SELECT id INTO lic_mp3 FROM licences WHERE beatmaker_id = bm_id AND modele = 'mp3' LIMIT 1;

  -- Si aucune licence trouvée → le trigger n'a pas tourné, on les crée avec les prix par défaut
  IF lic_mp3 IS NULL THEN
    RAISE NOTICE 'Aucune licence trouvée → création des 5 licences par défaut';
    INSERT INTO licences (beatmaker_id, ordre, nom, prix, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive)
    VALUES
      (bm_id, 1, 'MP3 Basic',   25,  'mp3',      true,  false, false, false),
      (bm_id, 2, 'MP3 + WAV',   45,  'wav',      true,  true,  false, false),
      (bm_id, 3, 'WAV + Stems', 75,  'stems',    true,  true,  true,  false),
      (bm_id, 4, 'Illimité',    150, 'illimite', true,  true,  true,  false),
      (bm_id, 5, 'Exclusive',   500, 'exclusive', true,  true,  true,  true);
  END IF;

  -- Récupération (existantes ou créées à l'instant)
  SELECT id, prix INTO lic_mp3,  p_mp3  FROM licences WHERE beatmaker_id = bm_id AND modele = 'mp3'       LIMIT 1;
  SELECT id, prix INTO lic_wav,  p_wav  FROM licences WHERE beatmaker_id = bm_id AND modele = 'wav'       LIMIT 1;
  SELECT id, prix INTO lic_stm,  p_stm  FROM licences WHERE beatmaker_id = bm_id AND modele = 'stems'     LIMIT 1;
  SELECT id, prix INTO lic_ill,  p_ill  FROM licences WHERE beatmaker_id = bm_id AND modele = 'illimite'  LIMIT 1;
  SELECT id, prix INTO lic_excl, p_excl FROM licences WHERE beatmaker_id = bm_id AND modele = 'exclusive' LIMIT 1;

  IF lic_mp3 IS NULL THEN RAISE EXCEPTION 'Licences introuvables après création — vérifier la table licences'; END IF;

  RAISE NOTICE 'Licences — MP3:%€ (%) WAV:%€ (%) Stems:%€ (%) Illimité:%€ (%) Exclusive:%€ (%)',
    p_mp3, lic_mp3, p_wav, lic_wav, p_stm, lic_stm, p_ill, lic_ill, p_excl, lic_excl;

  -- ── 1. Supprimer les commandes LICENCE fictives ──────────────────
  DELETE FROM commandes
  WHERE beatmaker_id = bm_id
    AND (type_commande = 'LICENCE' OR type_commande IS NULL);

  RAISE NOTICE 'Commandes LICENCE supprimées';

  -- ── 2. Insérer 20 beats fictifs diversifiés ──────────────────────
  INSERT INTO beats (beatmaker_id, titre, bpm, cle, styles, ambiances, type_beat, statut, created_at)
  VALUES
    (bm_id,'Night Rider',      140,'Ré min', ARRAY['Drill'],       ARRAY['Sombre','Agressif'],           ARRAY['Gazo','Freeze Corleone'],   'public', NOW()-INTERVAL'18 months'),
    (bm_id,'Paranoia',         135,'Do min', ARRAY['Drill'],       ARRAY['Mélancolique','Sombre'],       ARRAY['Freeze Corleone','Hamza'],   'public', NOW()-INTERVAL'16 months'),
    (bm_id,'Coco Loco',        140,'La min', ARRAY['Trap'],        ARRAY['Énergétique','Festif'],        ARRAY['Ninho','SCH'],               'public', NOW()-INTERVAL'14 months'),
    (bm_id,'Favela King',       95,'Sol min',ARRAY['Reggaeton'],   ARRAY['Festif','Énergétique'],        ARRAY['J Balvin','Maluma'],         'public', NOW()-INTERVAL'13 months'),
    (bm_id,'Memories',          85,'Fa min', ARRAY['R&B'],         ARRAY['Romantique','Mélancolique'],   ARRAY['Drake','The Weeknd'],        'public', NOW()-INTERVAL'12 months'),
    (bm_id,'Street Gospel',     90,'Ré min', ARRAY['Boom Bap'],    ARRAY['Nostalgique','Mélancolique'],  ARRAY['Nekfeu','Booba'],            'public', NOW()-INTERVAL'11 months'),
    (bm_id,'Montagne Or',      145,'Mi min', ARRAY['Trap'],        ARRAY['Mystérieux','Sombre'],         ARRAY['Hamza','Gazo'],              'public', NOW()-INTERVAL'10 months'),
    (bm_id,'Señorita',          92,'La min', ARRAY['Reggaeton'],   ARRAY['Festif','Romantique'],         ARRAY['Bad Bunny','Ozuna'],         'public', NOW()-INTERVAL'9 months'),
    (bm_id,'Dark Frequencies', 140,'Si min', ARRAY['Drill UK'],    ARRAY['Sombre','Hypnotique'],         ARRAY['Central Cee','Dave'],        'public', NOW()-INTERVAL'9 months'),
    (bm_id,'Voodoo',           100,'Do min', ARRAY['Afrobeats'],   ARRAY['Hypnotique','Festif'],         ARRAY['Burna Boy','Wizkid'],        'public', NOW()-INTERVAL'8 months'),
    (bm_id,'2AM',              130,'Fa min', ARRAY['Cloud Rap'],   ARRAY['Mélancolique','Mystérieux'],   ARRAY['Hamza','SCH'],               'public', NOW()-INTERVAL'8 months'),
    (bm_id,'Calor',             98,'Sol min',ARRAY['Reggaeton'],   ARRAY['Énergétique','Festif'],        ARRAY['Daddy Yankee','J Balvin'],   'public', NOW()-INTERVAL'7 months'),
    (bm_id,'Ghost Town',       138,'Ré min', ARRAY['Drill'],       ARRAY['Sombre','Agressif'],           ARRAY['Gazo','Freeze Corleone'],    'public', NOW()-INTERVAL'7 months'),
    (bm_id,'Summer Nights',    102,'Do min', ARRAY['Afrobeats'],   ARRAY['Festif','Romantique'],         ARRAY['Aya Nakamura','Burna Boy'],  'public', NOW()-INTERVAL'6 months'),
    (bm_id,'Shadow Realm',     142,'Si min', ARRAY['Trap'],        ARRAY['Mystérieux','Sombre'],         ARRAY['Travis Scott','Drake'],      'public', NOW()-INTERVAL'6 months'),
    (bm_id,'Playa',             90,'La min', ARRAY['Dancehall'],   ARRAY['Festif','Énergétique'],        ARRAY['Popcaan','Vybz Kartel'],     'public', NOW()-INTERVAL'5 months'),
    (bm_id,'Broken Mirror',     88,'Mi min', ARRAY['Boom Bap'],    ARRAY['Mélancolique','Nostalgique'],  ARRAY['Nekfeu','Orelsan'],          'public', NOW()-INTERVAL'5 months'),
    (bm_id,'Inferno',          148,'Ré min', ARRAY['Trap'],        ARRAY['Agressif','Énergétique'],      ARRAY['Ninho','Gazo'],              'public', NOW()-INTERVAL'4 months'),
    (bm_id,'Nuit Blanche',      80,'Fa min', ARRAY['R&B'],         ARRAY['Romantique','Mélancolique'],   ARRAY['Jorja Smith','Drake'],       'public', NOW()-INTERVAL'3 months'),
    (bm_id,'Babylon',           95,'Sol min',ARRAY['Dancehall'],   ARRAY['Festif','Hypnotique'],         ARRAY['Sean Paul','Vybz Kartel'],   'public', NOW()-INTERVAL'2 months');

  RAISE NOTICE '20 beats insérés';

  -- ── 3. Commandes réalistes ────────────────────────────────────────
  -- Colonnes : beatmaker_id, client_id, beat_id, licence_id,
  --            prix_paye, devise, methode_paiement, statut,
  --            type_commande, fichiers_livres, created_at

  -- === NICOLAS — 7 achats Drill/Trap, mix MP3/WAV, Régulier ===
  -- LTV = 5×25 + 2×45 = 215€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'17 months'
    FROM clients c JOIN beats b ON b.titre='Night Rider'     AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'15 months'
    FROM clients c JOIN beats b ON b.titre='Paranoia'        AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'
    FROM clients c JOIN beats b ON b.titre='Dark Frequencies' AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'
    FROM clients c JOIN beats b ON b.titre='Ghost Town'       AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'
    FROM clients c JOIN beats b ON b.titre='Montagne Or'      AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'
    FROM clients c JOIN beats b ON b.titre='Inferno'          AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 weeks'
    FROM clients c JOIN beats b ON b.titre='2AM'              AND b.beatmaker_id=bm_id WHERE c.email='nicojacob83+artiste@gmail.com';

  -- === TEST ACHETEUR — 3 WAV + 1 Exclusive (Broken Mirror), qualité maximale ===
  -- LTV = 3×45 + 500 = 635€, Régulier (4 achats, dernier 5 semaines)
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_excl,p_excl,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months'
    FROM clients c JOIN beats b ON b.titre='Broken Mirror'   AND b.beatmaker_id=bm_id WHERE c.email='test@test.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'
    FROM clients c JOIN beats b ON b.titre='Memories'        AND b.beatmaker_id=bm_id WHERE c.email='test@test.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'
    FROM clients c JOIN beats b ON b.titre='Summer Nights'   AND b.beatmaker_id=bm_id WHERE c.email='test@test.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'
    FROM clients c JOIN beats b ON b.titre='Nuit Blanche'    AND b.beatmaker_id=bm_id WHERE c.email='test@test.com';

  -- Broken Mirror est vendu en exclusive → on le marque comme vendu
  UPDATE beats SET statut='vendu' WHERE titre='Broken Mirror' AND beatmaker_id=bm_id;

  -- === AXEL FONTAINE — 1 achat Illimité, Occasionnel ===
  -- LTV = 150€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_ill,p_ill,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'
    FROM clients c JOIN beats b ON b.titre='Favela King'     AND b.beatmaker_id=bm_id WHERE c.email='axel.fontaine@icloud.com';

  -- === LUCAS DUBOIS — 1 achat MP3, Occasionnel ===
  -- LTV = 25€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'
    FROM clients c JOIN beats b ON b.titre='Coco Loco'       AND b.beatmaker_id=bm_id WHERE c.email='lucas.dubois@yahoo.fr';

  -- === NATHAN DUPONT — 2 achats Reggaeton MP3, Occasionnel ===
  -- LTV = 50€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'
    FROM clients c JOIN beats b ON b.titre='Señorita'        AND b.beatmaker_id=bm_id WHERE c.email='nathan.dupont@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'
    FROM clients c JOIN beats b ON b.titre='Playa'           AND b.beatmaker_id=bm_id WHERE c.email='nathan.dupont@gmail.com';

  -- === THÉO GAGNON — 2 achats, Occasionnel ===
  -- LTV = 45 + 25 = 70€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'
    FROM clients c JOIN beats b ON b.titre='Babylon'         AND b.beatmaker_id=bm_id WHERE c.email='theo.gagnon@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'
    FROM clients c JOIN beats b ON b.titre='Summer Nights'   AND b.beatmaker_id=bm_id WHERE c.email='theo.gagnon@gmail.com';

  -- === KEVIN MOREAU — 2 achats, Occasionnel (abonné aussi) ===
  -- LTV = 45 + 25 = 70€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'
    FROM clients c JOIN beats b ON b.titre='Shadow Realm'    AND b.beatmaker_id=bm_id WHERE c.email='kevin.moreau@gmail.com'
  UNION ALL
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 weeks'
    FROM clients c JOIN beats b ON b.titre='Inferno'         AND b.beatmaker_id=bm_id WHERE c.email='kevin.moreau@gmail.com';

  -- === DRISS LAMRANI — 1 achat récent, Occasionnel ===
  -- LTV = 25€
  INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
  SELECT bm_id,c.id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'
    FROM clients c JOIN beats b ON b.titre='Calor'           AND b.beatmaker_id=bm_id WHERE c.email='driss.lamrani@gmail.com';

  -- ── 4. Clients sans email connu (via leads) ──────────────────────
  -- Récupérer les clients qui ne sont pas dans les emails connus ci-dessus
  SELECT ARRAY_AGG(DISTINCT l.client_id ORDER BY l.client_id)
  INTO unknown_clients
  FROM leads l
  WHERE l.beatmaker_id = bm_id
    AND l.client_id NOT IN (
      SELECT id FROM clients WHERE email IN (
        'nicojacob83+artiste@gmail.com',
        'test@test.com',
        'axel.fontaine@icloud.com',
        'lucas.dubois@yahoo.fr',
        'nathan.dupont@gmail.com',
        'theo.gagnon@gmail.com',
        'kevin.moreau@gmail.com',
        'driss.lamrani@gmail.com',
        'ibrahim.toure@gmail.com',
        'yanis.chergui@gmail.com'
      )
    );

  -- Profil 1 : 8 achats MP3, fan de Drill → Régulier (LTV = 6×25 + 2×45 = 240€)
  IF unknown_clients[1] IS NOT NULL THEN
    c_id := unknown_clients[1];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Night Rider'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'13 months' FROM beats b WHERE b.titre='Ghost Town'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Paranoia'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Dark Frequencies'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Montagne Or'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Inferno'           AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'   FROM beats b WHERE b.titre='2AM'               AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'   FROM beats b WHERE b.titre='Coco Loco'         AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 2 : 6 achats variés → Régulier (LTV = 4×25 + 2×45 = 190€)
  IF unknown_clients[2] IS NOT NULL THEN
    c_id := unknown_clients[2];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Favela King'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Señorita'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Calor'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Summer Nights'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Babylon'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks'   FROM beats b WHERE b.titre='Playa'          AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 3 : 5 achats Reggaeton/Afro → Régulier (LTV = 3×25 + 2×45 = 165€)
  IF unknown_clients[3] IS NOT NULL THEN
    c_id := unknown_clients[3];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Voodoo'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Summer Nights'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Babylon'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Favela King'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'   FROM beats b WHERE b.titre='Señorita'       AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 4 : 7 achats Trap/Drill, 1 Stems → Régulier (LTV = 4×25 + 2×45 + 75 = 265€)
  IF unknown_clients[4] IS NOT NULL THEN
    c_id := unknown_clients[4];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'15 months' FROM beats b WHERE b.titre='Coco Loco'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Montagne Or'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Shadow Realm'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 months'  FROM beats b WHERE b.titre='Ghost Town'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Inferno'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_stm,p_stm,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Night Rider'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'   FROM beats b WHERE b.titre='Dark Frequencies' AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 5 : 4 achats Boom Bap/R&B → Régulier (LTV = 2×25 + 2×45 = 140€)
  IF unknown_clients[5] IS NOT NULL THEN
    c_id := unknown_clients[5];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Street Gospel'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Memories'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Nuit Blanche'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'   FROM beats b WHERE b.titre='Voodoo'         AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 6 : 3 achats, Reggaeton → Régulier minimum (LTV = 3×25 = 75€)
  IF unknown_clients[6] IS NOT NULL THEN
    c_id := unknown_clients[6];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Favela King'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Calor'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'   FROM beats b WHERE b.titre='Babylon'        AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 7 : 3 achats variés → Régulier (LTV = 25 + 25 + 75 = 125€, 1 Stems)
  IF unknown_clients[7] IS NOT NULL THEN
    c_id := unknown_clients[7];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Voodoo'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Summer Nights'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_stm,p_stm,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks'   FROM beats b WHERE b.titre='2AM'            AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 8 : 2 achats récents, Occasionnel (LTV = 2×25 = 50€)
  IF unknown_clients[8] IS NOT NULL THEN
    c_id := unknown_clients[8];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Coco Loco'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'   FROM beats b WHERE b.titre='Montagne Or'    AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 9 : 1 achat Illimité récent, Occasionnel (LTV = 150€)
  IF unknown_clients[9] IS NOT NULL THEN
    c_id := unknown_clients[9];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_ill,p_ill,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 weeks'
    FROM beats b WHERE b.titre='Calor' AND b.beatmaker_id=bm_id;
  END IF;

  RAISE NOTICE 'Script terminé avec succès. Beats et commandes insérés.';
END $$;
