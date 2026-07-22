-- ============================================================
-- Active les licences (beat_licences) sur les beats copiés dans
-- test1..test10 — la duplication précédente copiait les colonnes
-- de `beats` mais pas les liaisons beat_licences (actif/prix_override/
-- sur_demande), donc aucune licence n'était activée sur ces beats.
--
-- Correspondance : beat par titre (source ↔ cible), licence par
-- modèle (mp3/wav/stems/illimite/exclusive) — chaque boutique a déjà
-- ses propres 5 licences (créées automatiquement à l'inscription,
-- voir supabase/licences_init.sql), seuls les IDs diffèrent.
-- ============================================================

DO $$
DECLARE
  source_id     UUID;
  target_email  TEXT;
  target_id     UUID;
  target_emails TEXT[] := ARRAY[
    'nicojacob83+test1@gmail.com',
    'nicojacob83+test2@gmail.com',
    'nicojacob83+test3@gmail.com',
    'nicojacob83+test4@gmail.com',
    'nicojacob83+test5@gmail.com',
    'nicojacob83+test6@gmail.com',
    'nicojacob83+test7@gmail.com',
    'nicojacob83+test8@gmail.com',
    'nicojacob83+test9@gmail.com',
    'nicojacob83+test10@gmail.com'
  ];
BEGIN
  SELECT id INTO source_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com';
  IF source_id IS NULL THEN
    RAISE EXCEPTION 'Boutique source introuvable (nicojacob83+test@gmail.com)';
  END IF;

  FOREACH target_email IN ARRAY target_emails LOOP
    SELECT id INTO target_id FROM beatmakers WHERE email = target_email;

    IF target_id IS NULL THEN
      RAISE EXCEPTION 'Compte % introuvable', target_email;
    END IF;

    INSERT INTO beat_licences (beat_id, licence_id, actif, prix_override, sur_demande)
    SELECT
      cible_beat.id,
      cible_lic.id,
      src_bl.actif,
      src_bl.prix_override,
      src_bl.sur_demande
    FROM beat_licences src_bl
    JOIN beats     src_beat ON src_beat.id = src_bl.beat_id AND src_beat.beatmaker_id = source_id
    JOIN licences  src_lic  ON src_lic.id = src_bl.licence_id
    JOIN beats     cible_beat ON cible_beat.beatmaker_id = target_id AND cible_beat.titre = src_beat.titre
    JOIN licences  cible_lic  ON cible_lic.beatmaker_id = target_id AND cible_lic.modele = src_lic.modele
    ON CONFLICT (beat_id, licence_id) DO UPDATE SET
      actif         = EXCLUDED.actif,
      prix_override = EXCLUDED.prix_override,
      sur_demande   = EXCLUDED.sur_demande;

    RAISE NOTICE 'Boutique % : licences activées', target_email;
  END LOOP;
END $$;
