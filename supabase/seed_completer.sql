-- ============================================================
-- COMPLÉMENT DONNÉES TEST
-- À exécuter APRÈS seed_donnees_test.sql
--
-- 1. Commandes pour les clients sans achats (ceux dont l'email était inconnu)
-- 2. beat_licences (5 licences activées par beat)
-- 3. URLs fichiers de test (supprime les warnings "MP3 manquante")
-- ============================================================

DO $$
DECLARE
  bm_id    UUID;
  lic_mp3  UUID; p_mp3  INT;
  lic_wav  UUID; p_wav  INT;
  lic_stm  UUID; p_stm  INT;
  lic_ill  UUID; p_ill  INT;
  lic_excl UUID; p_excl INT;
  missing_clients UUID[];
  c_id UUID;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com' LIMIT 1;
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Beatmaker nicojacob83+test@gmail.com introuvable'; END IF;

  SELECT id   INTO lic_mp3  FROM licences WHERE beatmaker_id = bm_id AND modele = 'mp3'       LIMIT 1;
  SELECT prix INTO p_mp3    FROM licences WHERE beatmaker_id = bm_id AND modele = 'mp3'       LIMIT 1;
  SELECT id   INTO lic_wav  FROM licences WHERE beatmaker_id = bm_id AND modele = 'wav'       LIMIT 1;
  SELECT prix INTO p_wav    FROM licences WHERE beatmaker_id = bm_id AND modele = 'wav'       LIMIT 1;
  SELECT id   INTO lic_stm  FROM licences WHERE beatmaker_id = bm_id AND modele = 'stems'     LIMIT 1;
  SELECT prix INTO p_stm    FROM licences WHERE beatmaker_id = bm_id AND modele = 'stems'     LIMIT 1;
  SELECT id   INTO lic_ill  FROM licences WHERE beatmaker_id = bm_id AND modele = 'illimite'  LIMIT 1;
  SELECT prix INTO p_ill    FROM licences WHERE beatmaker_id = bm_id AND modele = 'illimite'  LIMIT 1;
  SELECT id   INTO lic_excl FROM licences WHERE beatmaker_id = bm_id AND modele = 'exclusive' LIMIT 1;
  SELECT prix INTO p_excl   FROM licences WHERE beatmaker_id = bm_id AND modele = 'exclusive' LIMIT 1;

  -- ── 1. Beat_licences : activer les 5 licences sur les 20 nouveaux beats ──
  INSERT INTO beat_licences (beat_id, licence_id, actif)
  SELECT b.id, l.id, true
  FROM beats b
  CROSS JOIN licences l
  WHERE b.beatmaker_id = bm_id
    AND b.titre IN (
      'Night Rider','Paranoia','Coco Loco','Favela King','Memories',
      'Street Gospel','Montagne Or','Señorita','Dark Frequencies','Voodoo',
      '2AM','Calor','Ghost Town','Summer Nights','Shadow Realm',
      'Playa','Broken Mirror','Inferno','Nuit Blanche','Babylon'
    )
    AND l.beatmaker_id = bm_id
  ON CONFLICT (beat_id, licence_id) DO NOTHING;

  RAISE NOTICE 'beat_licences insérés';

  -- ── 2. URLs fichiers de test (supprime warning MP3 manquante) ────────────
  UPDATE beats SET
    mp3_tague_url  = 'https://cdn.test/' || substr(id::text,1,8) || '_tagged.mp3',
    mp3_propre_url = 'https://cdn.test/' || substr(id::text,1,8) || '_clean.mp3',
    wav_url        = 'https://cdn.test/' || substr(id::text,1,8) || '.wav',
    stems_url      = 'https://cdn.test/' || substr(id::text,1,8) || '_stems.zip',
    image_url      = 'https://picsum.photos/seed/' || substr(id::text,1,8) || '/400/400'
  WHERE beatmaker_id = bm_id
    AND titre IN (
      'Night Rider','Paranoia','Coco Loco','Favela King','Memories',
      'Street Gospel','Montagne Or','Señorita','Dark Frequencies','Voodoo',
      '2AM','Calor','Ghost Town','Summer Nights','Shadow Realm',
      'Playa','Broken Mirror','Inferno','Nuit Blanche','Babylon'
    );

  RAISE NOTICE 'URLs beats mises à jour';

  -- ── 3. Clients sans commandes (emails inconnus, ex-Lamine Diallo, Ryan Martin…) ──
  -- On prend TOUS les clients sans achat pour ce beatmaker, sauf les abonnés 0-achat voulus
  SELECT ARRAY_AGG(c.id ORDER BY c.created_at)
  INTO missing_clients
  FROM clients c
  WHERE c.email NOT IN (
    'nicojacob83+artiste@gmail.com','test@test.com',
    'axel.fontaine@icloud.com','lucas.dubois@yahoo.fr',
    'nathan.dupont@gmail.com','theo.gagnon@gmail.com',
    'driss.lamrani@gmail.com','ibrahim.toure@gmail.com','yanis.chergui@gmail.com'
  )
  AND NOT EXISTS (
    SELECT 1 FROM commandes cmd
    WHERE cmd.client_id = c.id
      AND cmd.beatmaker_id = bm_id
      AND cmd.type_commande = 'LICENCE'
  );

  RAISE NOTICE 'Clients sans commandes trouvés : %', array_length(missing_clients, 1);

  -- Profil 1 : 8 achats Drill (Régulier, LTV ≈ 240€)
  IF missing_clients[1] IS NOT NULL THEN
    c_id := missing_clients[1];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Night Rider'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'13 months' FROM beats b WHERE b.titre='Ghost Town'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Paranoia'           AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Dark Frequencies'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Montagne Or'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Inferno'            AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'   FROM beats b WHERE b.titre='2AM'                AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'   FROM beats b WHERE b.titre='Coco Loco'          AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 2 : 6 achats variés (Régulier, LTV ≈ 190€)
  IF missing_clients[2] IS NOT NULL THEN
    c_id := missing_clients[2];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Favela King'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Señorita'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Calor'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Summer Nights'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Babylon'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks'   FROM beats b WHERE b.titre='Playa'          AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 3 : 5 achats Reggaeton/Afro (Régulier, LTV ≈ 165€)
  IF missing_clients[3] IS NOT NULL THEN
    c_id := missing_clients[3];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Babylon'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Favela King'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'   FROM beats b WHERE b.titre='Señorita'      AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 4 : 7 achats Trap/Drill + 1 Stems (Régulier, LTV ≈ 265€)
  IF missing_clients[4] IS NOT NULL THEN
    c_id := missing_clients[4];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'15 months' FROM beats b WHERE b.titre='Coco Loco'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Montagne Or'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Shadow Realm'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 months'  FROM beats b WHERE b.titre='Ghost Town'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Inferno'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_stm,p_stm,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Night Rider'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks'   FROM beats b WHERE b.titre='Dark Frequencies' AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 5 : 4 achats Boom Bap/R&B (Régulier, LTV ≈ 140€)
  IF missing_clients[5] IS NOT NULL THEN
    c_id := missing_clients[5];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Street Gospel' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Memories'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Nuit Blanche'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'   FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 6 : 3 achats Reggaeton (Régulier min, LTV = 75€)
  IF missing_clients[6] IS NOT NULL THEN
    c_id := missing_clients[6];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months' FROM beats b WHERE b.titre='Favela King' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months' FROM beats b WHERE b.titre='Calor'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'  FROM beats b WHERE b.titre='Babylon'     AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 7 : 3 achats + 1 Stems (Régulier, LTV = 125€)
  IF missing_clients[7] IS NOT NULL THEN
    c_id := missing_clients[7];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months' FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_stm,p_stm,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks'  FROM beats b WHERE b.titre='2AM'           AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 8 : 2 achats récents (Occasionnel, LTV = 50€)
  IF missing_clients[8] IS NOT NULL THEN
    c_id := missing_clients[8];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months' FROM beats b WHERE b.titre='Coco Loco'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'  FROM beats b WHERE b.titre='Montagne Or' AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 9 : 1 achat Illimité récent (Occasionnel, LTV = 150€)
  IF missing_clients[9] IS NOT NULL THEN
    c_id := missing_clients[9];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_ill,p_ill,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 weeks'
    FROM beats b WHERE b.titre='Calor' AND b.beatmaker_id=bm_id;
  END IF;

  -- Profil 10 : 2 achats WAV + MP3 (Occasionnel, LTV = 70€) — pour Kevin Moreau ou autre
  IF missing_clients[10] IS NOT NULL THEN
    c_id := missing_clients[10];
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Shadow Realm' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 weeks'  FROM beats b WHERE b.titre='Inferno'      AND b.beatmaker_id=bm_id;
  END IF;

  RAISE NOTICE 'Script completer terminé avec succès';
END $$;
