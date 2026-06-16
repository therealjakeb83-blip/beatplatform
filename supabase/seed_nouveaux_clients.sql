-- ============================================================
-- 35 NOUVEAUX CLIENTS + COMMANDES — atteindre ~50 clients
-- Idempotent : ON CONFLICT DO NOTHING + IF NOT EXISTS
--
-- Répartition :
--   Régulier  (≥3 achats, dernier ≤180j) : 12 clients
--   Fidèle    (≥3 achats, dernier >180j) :  5 clients
--   Occasionnel (<3 achats, dernier ≤180j): 12 clients
--   Dormant   (<3 achats, dernier >180j)  :  6 clients
-- ============================================================

DO $$
DECLARE
  bm_id UUID;
  lic_mp3 UUID; p_mp3 INT;
  lic_wav UUID; p_wav INT;
  lic_stm UUID; p_stm INT;
  lic_ill UUID; p_ill INT;
  cid UUID;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com' LIMIT 1;
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Beatmaker nicojacob83+test@gmail.com introuvable'; END IF;

  SELECT id   INTO lic_mp3 FROM licences WHERE beatmaker_id=bm_id AND modele='mp3'      LIMIT 1;
  SELECT prix INTO p_mp3   FROM licences WHERE beatmaker_id=bm_id AND modele='mp3'      LIMIT 1;
  SELECT id   INTO lic_wav FROM licences WHERE beatmaker_id=bm_id AND modele='wav'      LIMIT 1;
  SELECT prix INTO p_wav   FROM licences WHERE beatmaker_id=bm_id AND modele='wav'      LIMIT 1;
  SELECT id   INTO lic_stm FROM licences WHERE beatmaker_id=bm_id AND modele='stems'    LIMIT 1;
  SELECT prix INTO p_stm   FROM licences WHERE beatmaker_id=bm_id AND modele='stems'    LIMIT 1;
  SELECT id   INTO lic_ill FROM licences WHERE beatmaker_id=bm_id AND modele='illimite' LIMIT 1;
  SELECT prix INTO p_ill   FROM licences WHERE beatmaker_id=bm_id AND modele='illimite' LIMIT 1;

  -- ════════════════════════════════════════════════════════
  -- RÉGULIERS — 12 clients (≥3 achats, dernier ≤180j)
  -- ════════════════════════════════════════════════════════

  -- #1 Hugo Durand — FR — 7 achats Boom Bap/R&B (LTV=235€, dernier=4 sem)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Hugo','Durand','Hugo-D','hugo.durand@icloud.com','FR',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='hugo.durand@icloud.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'20 months' FROM beats b WHERE b.titre='Street Gospel'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Memories'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Nuit Blanche'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Street Gospel'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Memories'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 weeks'   FROM beats b WHERE b.titre='Voodoo'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks'   FROM beats b WHERE b.titre='2AM'            AND b.beatmaker_id=bm_id;
  END IF;

  -- #2 Rémi Charpentier — FR — 6 achats Trap (LTV=190€, dernier=6 sem)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Rémi','Charpentier','RemizRap','remi.charpentier@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='remi.charpentier@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'18 months' FROM beats b WHERE b.titre='Coco Loco'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'13 months' FROM beats b WHERE b.titre='Montagne Or'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Shadow Realm'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Inferno'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Coco Loco'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'42 days'   FROM beats b WHERE b.titre='2AM'           AND b.beatmaker_id=bm_id;
  END IF;

  -- #3 Samba N'Diaye — SN — 6 achats Afrobeats/Dancehall (LTV=190€, dernier=7 sem)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Samba','N''Diaye','SambaFlow','samba.ndiaye@gmail.com','SN',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='samba.ndiaye@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'22 months' FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'17 months' FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Babylon'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Playa'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'49 days'   FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id;
  END IF;

  -- #4 Amine Brahimi — FR — 5 achats Drill (LTV=125€, dernier=2 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Amine','Brahimi','Amine-B','amine.brahimi@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='amine.brahimi@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'18 months' FROM beats b WHERE b.titre='Night Rider'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'13 months' FROM beats b WHERE b.titre='Ghost Town'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Paranoia'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Dark Frequencies'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'60 days'   FROM beats b WHERE b.titre='Inferno'           AND b.beatmaker_id=bm_id;
  END IF;

  -- #5 Bilal Tazi — FR — 5 achats Reggaeton (LTV=165€, dernier=2.5 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Bilal','Tazi','BiTaz','bilal.tazi@gmail.com','FR',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='bilal.tazi@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Favela King'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Señorita'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Calor'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Playa'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'75 days'   FROM beats b WHERE b.titre='Babylon'        AND b.beatmaker_id=bm_id;
  END IF;

  -- #6 Pierre Rossi — FR — 5 achats R&B/Soul (LTV=165€, dernier=3 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Pierre','Rossi','P.Rossi','pierre.rossi@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='pierre.rossi@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'19 months' FROM beats b WHERE b.titre='Memories'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Nuit Blanche'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Memories'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Nuit Blanche'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id;
  END IF;

  -- #7 Zachary Tremblay — CA — 5 achats variés (LTV=165€, dernier=2 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Zachary','Tremblay','Zach-T','zachary.tremblay@gmail.com','CA',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='zachary.tremblay@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'15 months' FROM beats b WHERE b.titre='Night Rider'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Coco Loco'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Shadow Realm'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Inferno'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'60 days'   FROM beats b WHERE b.titre='Ghost Town'     AND b.beatmaker_id=bm_id;
  END IF;

  -- #8 Yassine Zaidi — MA — 4 achats Drill/Trap (LTV=100€, dernier=3.5 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Yassine','Zaidi','YZ-Music','yassine.zaidi@gmail.com','MA',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='yassine.zaidi@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Night Rider'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Paranoia'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Dark Frequencies'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'105 days'  FROM beats b WHERE b.titre='2AM'               AND b.beatmaker_id=bm_id;
  END IF;

  -- #9 Quentin Perrin — FR — 4 achats Trap (LTV=120€, dernier=4 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Quentin','Perrin','QPerz','quentin.perrin@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='quentin.perrin@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Coco Loco'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Shadow Realm'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 months'  FROM beats b WHERE b.titre='Montagne Or'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'120 days'  FROM beats b WHERE b.titre='Inferno'        AND b.beatmaker_id=bm_id;
  END IF;

  -- #10 Nassim Aouad — BE — 4 achats Afro/Reggae (LTV=120€, dernier=4 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Nassim','Aouad','Nassim-A','nassim.aouad@gmail.com','BE',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='nassim.aouad@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'13 months' FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Calor'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'120 days'  FROM beats b WHERE b.titre='Babylon'       AND b.beatmaker_id=bm_id;
  END IF;

  -- #11 Tom Girard — FR — 3 achats Trap (LTV=75€, dernier=5 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Tom','Girard','Tom-G','tom.girard@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='tom.girard@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Coco Loco'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Montagne Or' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'150 days'  FROM beats b WHERE b.titre='Shadow Realm' AND b.beatmaker_id=bm_id;
  END IF;

  -- #12 Ismaïl Fares — FR — 3 achats Drill (LTV=75€, dernier=4 mois)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Ismaïl','Fares','Ismx','ismail.fares@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='ismail.fares@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Night Rider'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Dark Frequencies' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'120 days'  FROM beats b WHERE b.titre='Ghost Town'       AND b.beatmaker_id=bm_id;
  END IF;

  -- ════════════════════════════════════════════════════════
  -- FIDÈLES — 5 clients (≥3 achats, dernier >180j)
  -- ════════════════════════════════════════════════════════

  -- #13 Sofiane Khelifi — FR — 4 achats (dernier=7 mois → Fidèle, LTV=120€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Sofiane','Khelifi','SofK','sofiane.khelifi@hotmail.fr','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='sofiane.khelifi@hotmail.fr';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'22 months' FROM beats b WHERE b.titre='Coco Loco'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Inferno'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'11 months' FROM beats b WHERE b.titre='Shadow Realm'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'210 days'  FROM beats b WHERE b.titre='Montagne Or'   AND b.beatmaker_id=bm_id;
  END IF;

  -- #14 Adrien Dupont — FR — 3 achats Drill (dernier=8 mois → Fidèle, LTV=75€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Adrien','Dupont','Adrix','adrien.dupont@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='adrien.dupont@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'18 months' FROM beats b WHERE b.titre='Night Rider'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Ghost Town'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'240 days'  FROM beats b WHERE b.titre='Dark Frequencies'  AND b.beatmaker_id=bm_id;
  END IF;

  -- #15 Alexis Renard — BE — 3 achats variés (dernier=9 mois → Fidèle, LTV=120€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Alexis','Renard','Alexis-R','alexis.renard@gmail.com','BE',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='alexis.renard@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'20 months' FROM beats b WHERE b.titre='Babylon'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'270 days'  FROM beats b WHERE b.titre='Playa'         AND b.beatmaker_id=bm_id;
  END IF;

  -- #16 Kaïs Mansouri — TN — 3 achats (dernier=10 mois → Fidèle, LTV=145€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Kaïs','Mansouri','KaisMsn','kais.mansouri@gmail.com','TN',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='kais.mansouri@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'20 months' FROM beats b WHERE b.titre='Calor'         AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Favela King'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'300 days'  FROM beats b WHERE b.titre='Señorita'      AND b.beatmaker_id=bm_id;
  END IF;

  -- #17 Corentin Dupuis — FR — 3 achats (dernier=12 mois → Fidèle, LTV=75€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Corentin','Dupuis','Corix','corentin.dupuis@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='corentin.dupuis@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'24 months' FROM beats b WHERE b.titre='Inferno'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'18 months' FROM beats b WHERE b.titre='Coco Loco'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'360 days'  FROM beats b WHERE b.titre='Shadow Realm'  AND b.beatmaker_id=bm_id;
  END IF;

  -- ════════════════════════════════════════════════════════
  -- OCCASIONNELS — 12 clients (<3 achats, dernier ≤180j)
  -- ════════════════════════════════════════════════════════

  -- #18 Hamid Benali — FR — 1 achat (dernier=3 sem → Occasionnel, LTV=45€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Hamid','Benali',NULL,'hamid.benali@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='hamid.benali@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'21 days' FROM beats b WHERE b.titre='Night Rider' AND b.beatmaker_id=bm_id;
  END IF;

  -- #19 Rachid Bensalem — FR — 2 achats (dernier=3 sem → Occasionnel, LTV=50€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Rachid','Bensalem','Rachid-B','rachid.bensalem@outlook.fr','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='rachid.bensalem@outlook.fr';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months'  FROM beats b WHERE b.titre='Paranoia'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'22 days'   FROM beats b WHERE b.titre='Ghost Town'  AND b.beatmaker_id=bm_id;
  END IF;

  -- #20 Baptiste Leroux — FR — 1 achat (dernier=6 sem → Occasionnel, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Baptiste','Leroux',NULL,'baptiste.leroux@gmail.com','FR',true) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='baptiste.leroux@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'42 days' FROM beats b WHERE b.titre='Inferno' AND b.beatmaker_id=bm_id;
  END IF;

  -- #21 Maxime Bernard — FR — 1 achat Illimité (dernier=7 sem → Occasionnel, LTV=150€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Maxime','Bernard','MaxB','maxime.bernard@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='maxime.bernard@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_ill,p_ill,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'49 days' FROM beats b WHERE b.titre='Montagne Or' AND b.beatmaker_id=bm_id;
  END IF;

  -- #22 Antoine Leclerc — FR — 2 achats (dernier=5 sem → Occasionnel, LTV=50€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Antoine','Leclerc',NULL,'antoine.leclerc@yahoo.fr','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='antoine.leclerc@yahoo.fr';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Coco Loco'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'35 days'   FROM beats b WHERE b.titre='Montagne Or' AND b.beatmaker_id=bm_id;
  END IF;

  -- #23 Jules Fabre — FR — 2 achats (dernier=2 mois → Occasionnel, LTV=50€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Jules','Fabre',NULL,'jules.fabre@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='jules.fabre@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Favela King' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'60 days'   FROM beats b WHERE b.titre='Señorita'   AND b.beatmaker_id=bm_id;
  END IF;

  -- #24 Julien Moreau — FR — 1 achat (dernier=1 mois → Occasionnel, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Julien','Moreau',NULL,'julien.moreau@laposte.net','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='julien.moreau@laposte.net';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'30 days' FROM beats b WHERE b.titre='Babylon' AND b.beatmaker_id=bm_id;
  END IF;

  -- #25 Mathis Lambert — FR — 1 achat (dernier=2.5 mois → Occasionnel, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Mathis','Lambert',NULL,'mathis.lambert@hotmail.fr','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='mathis.lambert@hotmail.fr';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'75 days' FROM beats b WHERE b.titre='Playa' AND b.beatmaker_id=bm_id;
  END IF;

  -- #26 Moussa Koné — CI — 2 achats Afrobeats (dernier=3 sem → Occasionnel, LTV=70€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Moussa','Koné','MK-Music','moussa.kone@gmail.com','CI',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='moussa.kone@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'21 days'   FROM beats b WHERE b.titre='Voodoo'        AND b.beatmaker_id=bm_id;
  END IF;

  -- #27 Mohamed Benkhaled — TN — 2 achats (dernier=5 sem → Occasionnel, LTV=50€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Mohamed','Benkhaled',NULL,'m.benkhaled@gmail.com','TN',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='m.benkhaled@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months'  FROM beats b WHERE b.titre='Night Rider' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'35 days'   FROM beats b WHERE b.titre='Paranoia'   AND b.beatmaker_id=bm_id;
  END IF;

  -- #28 Marc-Antoine Bouchard — CA — 2 achats (dernier=2.5 mois → Occasionnel, LTV=70€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Marc-Antoine','Bouchard',NULL,'ma.bouchard@gmail.com','CA',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='ma.bouchard@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Coco Loco' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'75 days'   FROM beats b WHERE b.titre='Inferno'   AND b.beatmaker_id=bm_id;
  END IF;

  -- #29 Djamel Touati — DZ — 1 achat (dernier=5 sem → Occasionnel, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Djamel','Touati',NULL,'djamel.touati@gmail.com','DZ',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='djamel.touati@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'35 days' FROM beats b WHERE b.titre='Calor' AND b.beatmaker_id=bm_id;
  END IF;

  -- ════════════════════════════════════════════════════════
  -- DORMANTS — 6 clients (<3 achats, dernier >180j)
  -- ════════════════════════════════════════════════════════

  -- #30 Victor Poulain — FR — 1 achat WAV (dernier=7 mois → Dormant, LTV=45€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Victor','Poulain',NULL,'victor.poulain@outlook.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='victor.poulain@outlook.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'210 days' FROM beats b WHERE b.titre='Memories' AND b.beatmaker_id=bm_id;
  END IF;

  -- #31 Thomas Gallois — FR — 2 achats (dernier=8 mois → Dormant, LTV=50€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Thomas','Gallois',NULL,'thomas.gallois@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='thomas.gallois@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Calor'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'240 days'  FROM beats b WHERE b.titre='Señorita'  AND b.beatmaker_id=bm_id;
  END IF;

  -- #32 Florian Remy — FR — 1 achat (dernier=9 mois → Dormant, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Florian','Remy',NULL,'florian.remy@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='florian.remy@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'270 days' FROM beats b WHERE b.titre='Playa' AND b.beatmaker_id=bm_id;
  END IF;

  -- #33 Oumar Diallo — SN — 1 achat (dernier=10 mois → Dormant, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Oumar','Diallo',NULL,'oumar.diallo@gmail.com','SN',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='oumar.diallo@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'300 days' FROM beats b WHERE b.titre='Voodoo' AND b.beatmaker_id=bm_id;
  END IF;

  -- #34 Gabriel Matthey — CH — 1 achat (dernier=11 mois → Dormant, LTV=25€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Gabriel','Matthey',NULL,'gabriel.matthey@gmail.com','CH',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='gabriel.matthey@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'330 days' FROM beats b WHERE b.titre='Street Gospel' AND b.beatmaker_id=bm_id;
  END IF;

  -- #35 Loïc Gaultier — FR — 2 achats (dernier=14 mois → Dormant, LTV=70€)
  INSERT INTO clients(id,prenom,nom,nom_artiste,email,pays,newsletter_consent) VALUES (gen_random_uuid(),'Loïc','Gaultier',NULL,'loic.gaultier@gmail.com','FR',false) ON CONFLICT(email) DO NOTHING;
  SELECT id INTO cid FROM clients WHERE email='loic.gaultier@gmail.com';
  IF NOT EXISTS(SELECT 1 FROM commandes WHERE client_id=cid AND beatmaker_id=bm_id AND type_commande='LICENCE') THEN
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,cid,b.id,lic_mp3,p_mp3,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'20 months' FROM beats b WHERE b.titre='Night Rider' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,cid,b.id,lic_wav,p_wav,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'420 days'  FROM beats b WHERE b.titre='Inferno'     AND b.beatmaker_id=bm_id;
  END IF;

  RAISE NOTICE '35 clients et leurs commandes insérés avec succès';
END $$;
