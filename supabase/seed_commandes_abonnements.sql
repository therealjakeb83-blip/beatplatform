-- ============================================================
-- Seed : commandes CREATION_ABONNEMENT + RENOUVELLEMENT
--
-- Génère 1 commande parente + N renouvellements par abonnement,
-- en se basant sur mensualites_payees et date_debut.
-- Idempotent : external_order_id unique par commande seed.
-- ============================================================

DO $$
DECLARE
  bm_id  UUID;
  r      RECORD;
  i      INT;
  ext_id TEXT;
BEGIN
  SELECT id INTO bm_id
  FROM beatmakers
  WHERE email = 'nicojacob83+test@gmail.com'
  LIMIT 1;

  IF bm_id IS NULL THEN
    RAISE EXCEPTION 'Beatmaker de test introuvable (nicojacob83+test@gmail.com)';
  END IF;

  FOR r IN
    SELECT
      id, client_id, beatmaker_id, prix,
      date_debut, methode_paiement,
      GREATEST(COALESCE(mensualites_payees, 1), 1) AS nb
    FROM abonnements_boutique
    WHERE beatmaker_id = bm_id
      AND client_id IS NOT NULL
  LOOP

    -- ── Commande parente ──────────────────────────────────────
    ext_id := 'seed-abo-' || r.id || '-0';
    IF NOT EXISTS (
      SELECT 1 FROM commandes
      WHERE external_order_id = ext_id AND plateforme_source = 'my_producer'
    ) THEN
      INSERT INTO commandes (
        beatmaker_id, client_id, beat_id, licence_id,
        prix_paye, devise, methode_paiement, statut,
        type_commande, fichiers_livres, created_at,
        plateforme_source, external_order_id
      ) VALUES (
        r.beatmaker_id, r.client_id, NULL, NULL,
        r.prix, 'EUR', r.methode_paiement, 'payee',
        'CREATION_ABONNEMENT', true, r.date_debut,
        'my_producer', ext_id
      );
    END IF;

    -- ── Renouvellements ───────────────────────────────────────
    FOR i IN 1..(r.nb - 1) LOOP
      ext_id := 'seed-abo-' || r.id || '-' || i;
      IF NOT EXISTS (
        SELECT 1 FROM commandes
        WHERE external_order_id = ext_id AND plateforme_source = 'my_producer'
      ) THEN
        INSERT INTO commandes (
          beatmaker_id, client_id, beat_id, licence_id,
          prix_paye, devise, methode_paiement, statut,
          type_commande, fichiers_livres, created_at,
          plateforme_source, external_order_id
        ) VALUES (
          r.beatmaker_id, r.client_id, NULL, NULL,
          r.prix, 'EUR', r.methode_paiement, 'payee',
          'RENOUVELLEMENT', true, r.date_debut + (i || ' months')::INTERVAL,
          'my_producer', ext_id
        );
      END IF;
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Seed commandes abonnements terminé.';
END $$;
