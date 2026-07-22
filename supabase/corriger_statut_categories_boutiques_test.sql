-- ============================================================
-- Correctif ponctuel (2026-07-22)
-- 1. test1..test8 : les beats avaient été copiés avec un statut forcé
--    à 'public' — on les réaligne sur le statut + catégories exacts
--    de la boutique source (jointure par titre, unique par boutique).
-- 2. test9/test10 : copie complète manquante (0 beat) — probablement
--    lancés avec une ancienne version du script sans ces deux comptes.
-- ============================================================

DO $$
DECLARE
  source_id UUID;
BEGIN
  SELECT id INTO source_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com';

  -- ── 1. Réalignement test1..test8 (statut + catégories exacts) ───────
  UPDATE beats AS cible
  SET
    statut      = src.statut,
    styles      = src.styles,
    ambiances   = src.ambiances,
    instruments = src.instruments,
    type_beat   = src.type_beat
  FROM beats AS src
  JOIN beatmakers bm ON bm.id = src.beatmaker_id
  WHERE bm.id = source_id
    AND src.supprime_le IS NULL
    AND cible.titre = src.titre
    AND cible.beatmaker_id IN (
      SELECT id FROM beatmakers WHERE email IN (
        'nicojacob83+test1@gmail.com','nicojacob83+test2@gmail.com','nicojacob83+test3@gmail.com',
        'nicojacob83+test4@gmail.com','nicojacob83+test5@gmail.com','nicojacob83+test6@gmail.com',
        'nicojacob83+test7@gmail.com','nicojacob83+test8@gmail.com'
      )
    );

  RAISE NOTICE 'Réalignement test1-8 terminé';

  -- ── 2. Copie complète manquante pour test9/test10 ───────────────────
  DECLARE
    target_email  TEXT;
    target_id     UUID;
    target_emails TEXT[] := ARRAY['nicojacob83+test9@gmail.com', 'nicojacob83+test10@gmail.com'];
  BEGIN
    FOREACH target_email IN ARRAY target_emails LOOP
      SELECT id INTO target_id FROM beatmakers WHERE email = target_email;
      IF target_id IS NULL THEN
        RAISE EXCEPTION 'Compte % introuvable', target_email;
      END IF;

      INSERT INTO categories (type, nom, source, beatmaker_id, statut)
      SELECT type, nom, 'beatmaker', target_id, statut
      FROM categories
      WHERE beatmaker_id = source_id AND source = 'beatmaker'
      ON CONFLICT (type, nom, beatmaker_id) DO NOTHING;

      INSERT INTO beats (
        beatmaker_id, date_sortie, titre, titre_beatstars, bpm, cle,
        styles, ambiances, instruments, type_beat,
        image_url, mp3_tague_url, mp3_propre_url, wav_url, stems_url,
        statut, free_download_actif
      )
      SELECT
        target_id, date_sortie, titre, titre_beatstars, bpm, cle,
        styles, ambiances, instruments, type_beat,
        image_url, mp3_tague_url, mp3_propre_url, wav_url, stems_url,
        statut, free_download_actif
      FROM beats
      WHERE beatmaker_id = source_id AND supprime_le IS NULL;

      RAISE NOTICE 'Boutique % : copie complète terminée', target_email;
    END LOOP;
  END;
END $$;
