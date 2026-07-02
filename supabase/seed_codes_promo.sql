-- ============================================================
-- DONNÉES TEST — Codes promo × 10 + Commandes liées × 30
-- À exécuter dans l'éditeur SQL Supabase (idempotent, peut être relancé)
--
-- Prérequis : seed_donnees_test.sql doit avoir déjà tourné sur
-- nicojacob83+test@gmail.com (clients, beats, licences en place).
--
-- Ce script :
--   1. Nettoie les codes promo/commandes d'un run précédent (même noms de codes)
--   2. Insère 10 codes promo couvrant les cas d'UI :
--      panier/produit/abonnement, %/montant fixe, actif/inactif/expiré/à venir,
--      restriction email, restriction beats, limite d'utilisation
--   3. Insère 30 commandes réparties sur ~11 mois, réutilisant les clients/
--      beats/licences déjà existants sur la boutique test
-- ============================================================

DO $$
DECLARE
  bm_id       UUID;

  lic_mp3 UUID; p_mp3 NUMERIC;
  lic_wav UUID; p_wav NUMERIC;
  lic_stm UUID; p_stm NUMERIC;

  client_ids  UUID[];
  n_clients   INT;
  beats_arr   UUID[];
  n_beats     INT;

  pack_beat1     UUID;
  pack_beat2     UUID;
  client_insta_id UUID;

  CODES TEXT[] := ARRAY['WELCOME10','VIP20','SUMMER25','FLASH5','PACKWAV','WELCOMEBACK','BLACKFRIDAY','INSTA15','ABOFIDELE','NOEL2025'];
BEGIN
  -- ── 0. Beatmaker cible ──────────────────────────────────────────
  SELECT id INTO bm_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com' LIMIT 1;
  IF bm_id IS NULL THEN
    RAISE EXCEPTION 'Beatmaker nicojacob83+test@gmail.com introuvable';
  END IF;

  -- ── 1. Licences (id + prix courant, tolère un renommage/re-prix) ─
  SELECT id, prix INTO lic_mp3, p_mp3 FROM licences WHERE beatmaker_id = bm_id AND modele = 'mp3'   LIMIT 1;
  SELECT id, prix INTO lic_wav, p_wav FROM licences WHERE beatmaker_id = bm_id AND modele = 'wav'   LIMIT 1;
  SELECT id, prix INTO lic_stm, p_stm FROM licences WHERE beatmaker_id = bm_id AND modele = 'stems' LIMIT 1;

  IF lic_mp3 IS NULL OR lic_wav IS NULL OR lic_stm IS NULL THEN
    RAISE EXCEPTION 'Licences MP3/WAV/Stems introuvables pour % — lancer seed_donnees_test.sql d''abord', bm_id;
  END IF;

  -- ── 2. Pool de clients et de beats existants ─────────────────────
  SELECT ARRAY_AGG(DISTINCT client_id ORDER BY client_id) INTO client_ids
  FROM leads WHERE beatmaker_id = bm_id;

  SELECT ARRAY_AGG(id ORDER BY created_at) INTO beats_arr
  FROM beats WHERE beatmaker_id = bm_id AND statut = 'public';

  n_clients := COALESCE(array_length(client_ids, 1), 0);
  n_beats   := COALESCE(array_length(beats_arr, 1), 0);

  IF n_clients < 5 OR n_beats < 5 THEN
    RAISE EXCEPTION 'Pas assez de clients (%) ou de beats (%) sur % — lancer seed_donnees_test.sql d''abord', n_clients, n_beats, bm_id;
  END IF;

  pack_beat1 := beats_arr[1];
  pack_beat2 := beats_arr[n_beats];

  SELECT c.id INTO client_insta_id
  FROM clients c JOIN leads l ON l.client_id = c.id
  WHERE l.beatmaker_id = bm_id AND c.email = 'nicojacob83+artiste@gmail.com'
  LIMIT 1;
  IF client_insta_id IS NULL THEN client_insta_id := client_ids[1]; END IF;

  RAISE NOTICE 'Beatmaker % | % clients | % beats publics', bm_id, n_clients, n_beats;

  -- ── 3. Nettoyage run précédent ────────────────────────────────────
  DELETE FROM commandes WHERE beatmaker_id = bm_id AND code_promo = ANY(CODES);
  DELETE FROM codes_promo WHERE beatmaker_id = bm_id AND code = ANY(CODES);

  -- ── 4. Codes promo ────────────────────────────────────────────────
  INSERT INTO codes_promo (
    beatmaker_id, code, description, type_remise, type_valeur, valeur,
    mensualites, date_debut, date_expiration, premiere_commande, utilisation_individuelle,
    beats_inclus, emails_autorises, limite_par_code, limite_par_utilisateur, statut, utilisations
  ) VALUES
    (bm_id,'WELCOME10',  'Réduction premier achat',     'panier','pourcentage',10, NULL, NULL, NULL,
      true,  false, NULL, '{}', NULL, NULL, 'actif',   10),
    (bm_id,'VIP20',      'Clients fidèles',             'panier','pourcentage',20, NULL, NULL, NULL,
      false, true,  NULL, '{}', NULL, NULL, 'actif',   5),
    (bm_id,'SUMMER25',   'Promo été 2025',              'panier','pourcentage',25, NULL,
      NOW() - INTERVAL '5 months', NOW() - INTERVAL '3 months',
      false, false, NULL, '{}', NULL, NULL, 'actif',   4),
    (bm_id,'FLASH5',     'Vente flash -5€',             'panier','montant',5, NULL,
      NOW() - INTERVAL '2 months', NOW() + INTERVAL '4 months',
      false, false, NULL, '{}', 50, NULL, 'actif',     2),
    (bm_id,'PACKWAV',    'Promo pack MP3+WAV (2 beats)','produit','pourcentage',15, NULL, NULL, NULL,
      false, false, ARRAY[pack_beat1, pack_beat2], '{}', NULL, 1, 'actif', 3),
    (bm_id,'WELCOMEBACK','Relance clients inactifs',    'panier','montant',10, NULL, NULL, NULL,
      false, false, NULL, '{}', NULL, NULL, 'inactif', 1),
    (bm_id,'BLACKFRIDAY','Black Friday 2025',           'panier','pourcentage',30, NULL,
      NOW() - INTERVAL '8 months', NOW() - INTERVAL '7 months 5 days',
      false, false, NULL, '{}', NULL, NULL, 'actif',   4),
    (bm_id,'INSTA15',    'Campagne Instagram',          'panier','pourcentage',15, NULL, NULL, NULL,
      false, false, NULL, ARRAY['nicojacob83+artiste@gmail.com'], NULL, NULL, 'actif', 1),
    (bm_id,'ABOFIDELE',  'Fidélité abonnement (illimité)','abonnement','pourcentage',20, NULL, NULL, NULL,
      false, false, NULL, '{}', NULL, NULL, 'actif',   0),
    (bm_id,'NOEL2025',   'Promo Noël (à venir)',        'panier','montant',15, NULL,
      NOW() + INTERVAL '3 months', NOW() + INTERVAL '4 months',
      false, false, NULL, '{}', NULL, NULL, 'actif',   0);

  RAISE NOTICE '10 codes promo insérés';

  -- ── 5. Commandes (30) ─────────────────────────────────────────────
  -- k = 0..29, client = client_ids[1 + k % n_clients], beat = beats_arr[1 + k % n_beats]
  -- (sauf PACKWAV : beats fixes pack_beat1/pack_beat2 ; INSTA15 : client fixe client_insta_id)

  INSERT INTO commandes (beatmaker_id, client_id, beat_id, licence_id, prix_paye, devise, methode_paiement, statut, type_commande, fichiers_livres, code_promo, reduction_montant, created_at)
  VALUES
    -- WELCOME10 (k0-9)
    (bm_id, client_ids[1+0%n_clients],  beats_arr[1+0%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '11 months'),
    (bm_id, client_ids[1+1%n_clients],  beats_arr[1+1%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '10 months'),
    (bm_id, client_ids[1+2%n_clients],  beats_arr[1+2%n_beats],  lic_wav, p_wav - round(p_wav*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_wav*0.10,2), NOW()-INTERVAL '9 months'),
    (bm_id, client_ids[1+3%n_clients],  beats_arr[1+3%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '8 months'),
    (bm_id, client_ids[1+4%n_clients],  beats_arr[1+4%n_beats],  lic_wav, p_wav - round(p_wav*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_wav*0.10,2), NOW()-INTERVAL '7 months'),
    (bm_id, client_ids[1+5%n_clients],  beats_arr[1+5%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '6 months'),
    (bm_id, client_ids[1+6%n_clients],  beats_arr[1+6%n_beats],  lic_stm, p_stm - round(p_stm*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_stm*0.10,2), NOW()-INTERVAL '5 months'),
    (bm_id, client_ids[1+7%n_clients],  beats_arr[1+7%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '4 months'),
    (bm_id, client_ids[1+8%n_clients],  beats_arr[1+8%n_beats],  lic_wav, p_wav - round(p_wav*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_wav*0.10,2), NOW()-INTERVAL '2 months'),
    (bm_id, client_ids[1+9%n_clients],  beats_arr[1+9%n_beats],  lic_mp3, p_mp3 - round(p_mp3*0.10,2), 'EUR','stripe','payee','LICENCE',true,'WELCOME10',   round(p_mp3*0.10,2), NOW()-INTERVAL '3 weeks'),

    -- VIP20 (k10-14)
    (bm_id, client_ids[1+10%n_clients], beats_arr[1+10%n_beats], lic_wav, p_wav - round(p_wav*0.20,2), 'EUR','stripe','payee','LICENCE',true,'VIP20',       round(p_wav*0.20,2), NOW()-INTERVAL '6 months'),
    (bm_id, client_ids[1+11%n_clients], beats_arr[1+11%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.20,2), 'EUR','stripe','payee','LICENCE',true,'VIP20',       round(p_mp3*0.20,2), NOW()-INTERVAL '4 months'),
    (bm_id, client_ids[1+12%n_clients], beats_arr[1+12%n_beats], lic_stm, p_stm - round(p_stm*0.20,2), 'EUR','stripe','payee','LICENCE',true,'VIP20',       round(p_stm*0.20,2), NOW()-INTERVAL '3 months'),
    (bm_id, client_ids[1+13%n_clients], beats_arr[1+13%n_beats], lic_wav, p_wav - round(p_wav*0.20,2), 'EUR','stripe','payee','LICENCE',true,'VIP20',       round(p_wav*0.20,2), NOW()-INTERVAL '6 weeks'),
    (bm_id, client_ids[1+14%n_clients], beats_arr[1+14%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.20,2), 'EUR','stripe','payee','LICENCE',true,'VIP20',       round(p_mp3*0.20,2), NOW()-INTERVAL '2 weeks'),

    -- SUMMER25 (k15-18) — fenêtre [-5 mois, -3 mois]
    (bm_id, client_ids[1+15%n_clients], beats_arr[1+15%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.25,2), 'EUR','stripe','payee','LICENCE',true,'SUMMER25',    round(p_mp3*0.25,2), NOW()-INTERVAL '4 months 20 days'),
    (bm_id, client_ids[1+16%n_clients], beats_arr[1+16%n_beats], lic_wav, p_wav - round(p_wav*0.25,2), 'EUR','stripe','payee','LICENCE',true,'SUMMER25',    round(p_wav*0.25,2), NOW()-INTERVAL '4 months 5 days'),
    (bm_id, client_ids[1+17%n_clients], beats_arr[1+17%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.25,2), 'EUR','stripe','payee','LICENCE',true,'SUMMER25',    round(p_mp3*0.25,2), NOW()-INTERVAL '3 months 20 days'),
    (bm_id, client_ids[1+18%n_clients], beats_arr[1+18%n_beats], lic_wav, p_wav - round(p_wav*0.25,2), 'EUR','stripe','payee','LICENCE',true,'SUMMER25',    round(p_wav*0.25,2), NOW()-INTERVAL '3 months 5 days'),

    -- FLASH5 (k19-20) — fenêtre [-2 mois, +4 mois]
    (bm_id, client_ids[1+19%n_clients], beats_arr[1+19%n_beats], lic_mp3, p_mp3 - 5, 'EUR','stripe','payee','LICENCE',true,'FLASH5',      5, NOW()-INTERVAL '3 weeks'),
    (bm_id, client_ids[1+20%n_clients], beats_arr[1+20%n_beats], lic_wav, p_wav - 5, 'EUR','stripe','payee','LICENCE',true,'FLASH5',      5, NOW()-INTERVAL '5 days'),

    -- PACKWAV (k21-23) — beats fixes (beats_inclus du code)
    (bm_id, client_ids[1+21%n_clients], pack_beat1,               lic_wav, p_wav - round(p_wav*0.15,2), 'EUR','stripe','payee','LICENCE',true,'PACKWAV',     round(p_wav*0.15,2), NOW()-INTERVAL '4 months'),
    (bm_id, client_ids[1+22%n_clients], pack_beat2,               lic_wav, p_wav - round(p_wav*0.15,2), 'EUR','stripe','payee','LICENCE',true,'PACKWAV',     round(p_wav*0.15,2), NOW()-INTERVAL '2 months'),
    (bm_id, client_ids[1+23%n_clients], pack_beat1,               lic_wav, p_wav - round(p_wav*0.15,2), 'EUR','stripe','payee','LICENCE',true,'PACKWAV',     round(p_wav*0.15,2), NOW()-INTERVAL '3 weeks'),

    -- WELCOMEBACK (k24) — code aujourd'hui inactif, usage passé pendant qu'il était actif
    (bm_id, client_ids[1+24%n_clients], beats_arr[1+24%n_beats], lic_mp3, p_mp3 - 10, 'EUR','stripe','payee','LICENCE',true,'WELCOMEBACK', 10, NOW()-INTERVAL '7 months'),

    -- BLACKFRIDAY (k25-28) — fenêtre [-8 mois, -7 mois 5 jours]
    (bm_id, client_ids[1+25%n_clients], beats_arr[1+25%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.30,2), 'EUR','stripe','payee','LICENCE',true,'BLACKFRIDAY', round(p_mp3*0.30,2), NOW()-INTERVAL '7 months 25 days'),
    (bm_id, client_ids[1+26%n_clients], beats_arr[1+26%n_beats], lic_wav, p_wav - round(p_wav*0.30,2), 'EUR','stripe','payee','LICENCE',true,'BLACKFRIDAY', round(p_wav*0.30,2), NOW()-INTERVAL '7 months 20 days'),
    (bm_id, client_ids[1+27%n_clients], beats_arr[1+27%n_beats], lic_mp3, p_mp3 - round(p_mp3*0.30,2), 'EUR','stripe','payee','LICENCE',true,'BLACKFRIDAY', round(p_mp3*0.30,2), NOW()-INTERVAL '7 months 12 days'),
    (bm_id, client_ids[1+28%n_clients], beats_arr[1+28%n_beats], lic_stm, p_stm - round(p_stm*0.30,2), 'EUR','stripe','payee','LICENCE',true,'BLACKFRIDAY', round(p_stm*0.30,2), NOW()-INTERVAL '7 months 8 days'),

    -- INSTA15 (k29) — client fixe (email autorisé du code)
    (bm_id, client_insta_id,            beats_arr[1+29%n_beats], lic_wav, p_wav - round(p_wav*0.15,2), 'EUR','stripe','payee','LICENCE',true,'INSTA15',     round(p_wav*0.15,2), NOW()-INTERVAL '2 weeks');

  RAISE NOTICE '30 commandes insérées';
END $$;
