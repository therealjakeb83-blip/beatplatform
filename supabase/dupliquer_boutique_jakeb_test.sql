-- ============================================================
-- Duplication boutique nicojacob83+test@gmail.com (jakeb-test)
-- → nicojacob83+test1@gmail.com ... +test8@gmail.com
--
-- Copie : beats + catégories personnalisées (source='beatmaker')
-- Ne copie PAS : licences, config boutique (branding/couleurs/logo),
-- clients/commandes/abonnements — hors scope de la demande.
--
-- Fichiers (mp3/wav/stems/image) : les URLs R2 sont réutilisées telles
-- quelles, aucune copie physique sur R2 nécessaire (le code ne supprime
-- jamais l'objet R2 sous-jacent, seule la ligne `beats` est soft-deletée
-- via `supprime_le` — donc partager les mêmes URLs entre les 8 boutiques
-- est sans risque).
--
-- Statut : tous les beats copiés sont remis à 'public', peu importe leur
-- statut d'origine (vendu/masqué/programmé n'a pas de sens dans une
-- boutique neuve sans aucune commande).
--
-- PRÉ-REQUIS : les 8 comptes doivent déjà exister (inscription normale
-- sur /connexion, avec un slug de boutique) — impossible de créer un
-- compte auth.users par SQL. Lance d'abord la vérification ci-dessous.
-- ============================================================

-- ── Étape 1 : vérification (à lancer avant toute copie) ──────────────
-- Doit renvoyer 9 lignes avec un id non-NULL. Si une ligne manque,
-- inscris le compte correspondant avant de continuer.
SELECT email, id, slug
FROM beatmakers
WHERE email IN (
  'nicojacob83+test@gmail.com',
  'nicojacob83+test1@gmail.com',
  'nicojacob83+test2@gmail.com',
  'nicojacob83+test3@gmail.com',
  'nicojacob83+test4@gmail.com',
  'nicojacob83+test5@gmail.com',
  'nicojacob83+test6@gmail.com',
  'nicojacob83+test7@gmail.com',
  'nicojacob83+test8@gmail.com'
)
ORDER BY email;

-- ── Étape 2 : copie (à lancer une fois les 9 lignes confirmées) ──────
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
    'nicojacob83+test8@gmail.com'
  ];
BEGIN
  SELECT id INTO source_id FROM beatmakers WHERE email = 'nicojacob83+test@gmail.com';
  IF source_id IS NULL THEN
    RAISE EXCEPTION 'Boutique source introuvable (nicojacob83+test@gmail.com)';
  END IF;

  FOREACH target_email IN ARRAY target_emails LOOP
    SELECT id INTO target_id FROM beatmakers WHERE email = target_email;

    IF target_id IS NULL THEN
      RAISE EXCEPTION 'Compte % introuvable — inscris-le normalement avant de relancer ce script', target_email;
    END IF;

    -- Catégories personnalisées du beatmaker source (styles/type_beat maison)
    INSERT INTO categories (type, nom, source, beatmaker_id, statut)
    SELECT type, nom, 'beatmaker', target_id, statut
    FROM categories
    WHERE beatmaker_id = source_id AND source = 'beatmaker'
    ON CONFLICT (type, nom, beatmaker_id) DO NOTHING;

    -- Beats (mêmes fichiers R2, nouvelle ligne par boutique, statut normalisé à 'public')
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
      'public', free_download_actif
    FROM beats
    WHERE beatmaker_id = source_id AND supprime_le IS NULL;

    RAISE NOTICE 'Boutique % (id %) : copie terminée', target_email, target_id;
  END LOOP;
END $$;
