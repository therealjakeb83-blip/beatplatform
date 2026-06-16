-- ============================================================
-- ABONNEMENTS TEST — 17 abonnements + achats abonnés avec -30%
--
-- Prix abonnement : 699 (6,99€ en centimes, convention Stripe)
-- Remise abonné  : -30% sur MP3/WAV/Stems (pas Illimité ni Exclusive)
--   → MP3=18€, WAV=32€, Stems=53€
--
-- Répartition :
--   actif                      : 9
--   actif (en essai)           : 2
--   actif + annulation_en_cours: 2
--   impaye                     : 1
--   annule                     : 3
--
-- Idempotent : NOT EXISTS check + ON CONFLICT DO NOTHING sur commandes
-- ============================================================

DO $$
DECLARE
  bm_id      UUID;
  plan_nom   TEXT;
  abo_prix   INT := 699;   -- 6,99€ en centimes
  mp3_abo    INT := 18;    -- 25 * 0.70 = 17.50 → 18€
  wav_abo    INT := 32;    -- 45 * 0.70 = 31.50 → 32€
  stm_abo    INT := 53;    -- 75 * 0.70 = 52.50 → 53€
  c_id       UUID;
  c_prenom   TEXT;
  c_nom_cl   TEXT;
  lic_mp3    UUID; lic_wav UUID; lic_stm UUID;
BEGIN
  SELECT id INTO bm_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com' LIMIT 1;
  IF bm_id IS NULL THEN RAISE EXCEPTION 'Beatmaker introuvable'; END IF;

  plan_nom := 'standard';

  SELECT id INTO lic_mp3 FROM licences WHERE beatmaker_id=bm_id AND modele='mp3'   LIMIT 1;
  SELECT id INTO lic_wav FROM licences WHERE beatmaker_id=bm_id AND modele='wav'   LIMIT 1;
  SELECT id INTO lic_stm FROM licences WHERE beatmaker_id=bm_id AND modele='stems' LIMIT 1;

  -- ════════════════════════════════════════════════════════════════
  -- ACTIFS — 9 abonnés
  -- ════════════════════════════════════════════════════════════════

  -- #1 Hugo Durand — 18 mois actif (abonné le plus ancien)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='hugo.durand@icloud.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'hugo.durand@icloud.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'18 months',NOW()+INTERVAL'13 days',plan_nom,abo_prix,'EUR','mensuel','stripe',18,18,NULL);
    -- Achats abonnés : beats privés ET publics à -30%
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'17 months' FROM beats b WHERE b.titre='Coco Loco'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'16 months' FROM beats b WHERE b.titre='Eclipse'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'12 months' FROM beats b WHERE b.titre='Paradise'     AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Shadow Realm'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 months'  FROM beats b WHERE b.titre='Cinématique'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months'  FROM beats b WHERE b.titre='Zone Grise'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'   FROM beats b WHERE b.titre='Utopia'       AND b.beatmaker_id=bm_id;
  END IF;

  -- #2 Rémi Charpentier — 10 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='remi.charpentier@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'remi.charpentier@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'10 months',NOW()+INTERVAL'22 days',plan_nom,abo_prix,'EUR','mensuel','stripe',10,10,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'9 months'  FROM beats b WHERE b.titre='Tsunami'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months'  FROM beats b WHERE b.titre='Night Rider'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months'  FROM beats b WHERE b.titre='Eclipse'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 weeks'   FROM beats b WHERE b.titre='Zone Grise'     AND b.beatmaker_id=bm_id;
  END IF;

  -- #3 Samba N'Diaye — 8 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='samba.ndiaye@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'samba.ndiaye@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'8 months',NOW()+INTERVAL'5 days',plan_nom,abo_prix,'EUR','mensuel','stripe',8,8,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 months' FROM beats b WHERE b.titre='Paradise'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 months' FROM beats b WHERE b.titre='Calor'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months' FROM beats b WHERE b.titre='Mambo'          AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'  FROM beats b WHERE b.titre='Overdose'       AND b.beatmaker_id=bm_id;
  END IF;

  -- #4 Amine Brahimi — 6 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='amine.brahimi@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'amine.brahimi@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'6 months',NOW()+INTERVAL'18 days',plan_nom,abo_prix,'EUR','mensuel','stripe',6,6,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months' FROM beats b WHERE b.titre='Dusk'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Ghost Town'   AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 weeks'  FROM beats b WHERE b.titre='Overdose'     AND b.beatmaker_id=bm_id;
  END IF;

  -- #5 Bilal Tazi — 5 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='bilal.tazi@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'bilal.tazi@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'5 months',NOW()+INTERVAL'26 days',plan_nom,abo_prix,'EUR','mensuel','stripe',5,5,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months' FROM beats b WHERE b.titre='Mambo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Summer Nights' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_wav,wav_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks'  FROM beats b WHERE b.titre='Paradise'      AND b.beatmaker_id=bm_id;
  END IF;

  -- #6 Nassim Aouad — 4 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='nassim.aouad@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'nassim.aouad@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'4 months',NOW()+INTERVAL'9 days',plan_nom,abo_prix,'EUR','mensuel','stripe',4,4,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Zone Grise'    AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'2 months' FROM beats b WHERE b.titre='Señorita'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks'  FROM beats b WHERE b.titre='Paradise'      AND b.beatmaker_id=bm_id;
  END IF;

  -- #7 Moussa Koné — 3 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='moussa.kone@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'moussa.kone@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'3 months',NOW()+INTERVAL'4 days',plan_nom,abo_prix,'EUR','mensuel','stripe',3,3,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'6 weeks' FROM beats b WHERE b.titre='Mambo'        AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks' FROM beats b WHERE b.titre='Playa'         AND b.beatmaker_id=bm_id;
  END IF;

  -- #8 Baptiste Leroux — 2 mois actif
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='baptiste.leroux@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'baptiste.leroux@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'2 months',NOW()+INTERVAL'14 days',plan_nom,abo_prix,'EUR','mensuel','stripe',2,2,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'7 weeks' FROM beats b WHERE b.titre='Voodoo'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 weeks' FROM beats b WHERE b.titre='Golden Hour'  AND b.beatmaker_id=bm_id;
  END IF;

  -- #9 Maxime Bernard — 1 mois actif (très nouveau)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='maxime.bernard@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'maxime.bernard@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,false,NOW()-INTERVAL'32 days',NOW()+INTERVAL'28 days',plan_nom,abo_prix,'EUR','mensuel','stripe',1,1,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 weeks' FROM beats b WHERE b.titre='Inferno'      AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 weeks' FROM beats b WHERE b.titre='Utopia'        AND b.beatmaker_id=bm_id;
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- EN ESSAI — 2 abonnés (mensualites_payees=0, en_essai=true)
  -- ════════════════════════════════════════════════════════════════

  -- Jules Fabre — en essai depuis 15 jours (30j d'essai)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='jules.fabre@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'jules.fabre@gmail.com',c_prenom||' '||c_nom_cl,'actif',true,false,NOW()-INTERVAL'15 days',NOW()+INTERVAL'15 days',plan_nom,abo_prix,'EUR','mensuel','stripe',0,0,NULL);
  END IF;

  -- Julien Moreau — en essai depuis 7 jours
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='julien.moreau@laposte.net';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'julien.moreau@laposte.net',c_prenom||' '||c_nom_cl,'actif',true,false,NOW()-INTERVAL'7 days',NOW()+INTERVAL'23 days',plan_nom,abo_prix,'EUR','mensuel','stripe',0,0,NULL);
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- ANNULATION EN COURS — 2 abonnés
  -- ════════════════════════════════════════════════════════════════

  -- Quentin Perrin — 6 mois, annulation demandée (accès jusqu'à date_fin)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='quentin.perrin@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'quentin.perrin@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,true,NOW()-INTERVAL'6 months',NOW()+INTERVAL'11 days',plan_nom,abo_prix,'EUR','mensuel','stripe',6,6,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'5 months' FROM beats b WHERE b.titre='Tsunami'       AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'4 months' FROM beats b WHERE b.titre='Dark Frequencies' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'3 months' FROM beats b WHERE b.titre='Eclipse'        AND b.beatmaker_id=bm_id;
  END IF;

  -- Tom Girard — 3 mois, annulation en cours
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='tom.girard@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'tom.girard@gmail.com',c_prenom||' '||c_nom_cl,'actif',false,true,NOW()-INTERVAL'3 months',NOW()+INTERVAL'20 days',plan_nom,abo_prix,'EUR','mensuel','stripe',3,3,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 weeks' FROM beats b WHERE b.titre='Montagne Or'  AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'8 weeks'  FROM beats b WHERE b.titre='Zone Grise'   AND b.beatmaker_id=bm_id;
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- IMPAYÉ — 1 abonné
  -- ════════════════════════════════════════════════════════════════

  -- Mathis Lambert — 2 mois puis impayé depuis 10 jours
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='mathis.lambert@hotmail.fr';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'mathis.lambert@hotmail.fr',c_prenom||' '||c_nom_cl,'impaye',false,false,NOW()-INTERVAL'3 months',NOW()-INTERVAL'10 days',plan_nom,abo_prix,'EUR','mensuel','stripe',2,2,NULL);
  END IF;

  -- ════════════════════════════════════════════════════════════════
  -- ANNULÉS — 3 anciens abonnés
  -- ════════════════════════════════════════════════════════════════

  -- Sofiane Khelifi — abonné 8 mois, annulé il y a 7 mois → statut 'ancien'
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='sofiane.khelifi@hotmail.fr';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'sofiane.khelifi@hotmail.fr',c_prenom||' '||c_nom_cl,'annule',false,false,NOW()-INTERVAL'15 months',NOW()-INTERVAL'7 months',plan_nom,abo_prix,'EUR','mensuel','stripe',8,8,NULL);
    -- Achats pendant qu'il était abonné
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'14 months' FROM beats b WHERE b.titre='Overdose' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Eclipse'  AND b.beatmaker_id=bm_id;
  END IF;

  -- Corentin Dupuis — abonné 12 mois, annulé il y a 12 mois (très ancien)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='corentin.dupuis@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'corentin.dupuis@gmail.com',c_prenom||' '||c_nom_cl,'annule',false,false,NOW()-INTERVAL'24 months',NOW()-INTERVAL'12 months',plan_nom,abo_prix,'EUR','mensuel','stripe',12,12,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'22 months' FROM beats b WHERE b.titre='Cinématique' AND b.beatmaker_id=bm_id UNION ALL
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'18 months' FROM beats b WHERE b.titre='Zone Grise'  AND b.beatmaker_id=bm_id;
  END IF;

  -- Adrien Dupont — abonné 3 mois puis annulé il y a 8 mois (essai non converti long terme)
  SELECT id,prenom,nom INTO c_id,c_prenom,c_nom_cl FROM clients WHERE email='adrien.dupont@gmail.com';
  IF c_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM abonnements_boutique WHERE beatmaker_id=bm_id AND client_id=c_id) THEN
    INSERT INTO abonnements_boutique(id,beatmaker_id,client_id,acheteur_email,acheteur_nom,statut,en_essai,annulation_en_cours,date_debut,date_fin,plan,prix,devise,periode,methode_paiement,mensualites_payees,mois_consecutifs,stripe_subscription_id)
    VALUES(gen_random_uuid(),bm_id,c_id,'adrien.dupont@gmail.com',c_prenom||' '||c_nom_cl,'annule',false,false,NOW()-INTERVAL'11 months',NOW()-INTERVAL'8 months',plan_nom,abo_prix,'EUR','mensuel','stripe',3,3,NULL);
    INSERT INTO commandes(beatmaker_id,client_id,beat_id,licence_id,prix_paye,devise,methode_paiement,statut,type_commande,fichiers_livres,created_at)
    SELECT bm_id,c_id,b.id,lic_mp3,mp3_abo,'EUR','stripe','payee','LICENCE',true,NOW()-INTERVAL'10 months' FROM beats b WHERE b.titre='Dusk' AND b.beatmaker_id=bm_id;
  END IF;

  RAISE NOTICE '17 abonnements + achats abonnés insérés avec succès';
END $$;
