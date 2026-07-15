-- ============================================================
-- Signature d'email personnalisable par beatmaker
-- ============================================================
-- Jake signe "Jake" à ses clients mais "Jake B" (son pseudonyme complet)
-- à des labels/pros — le nom de boutique (nom_artiste) ne convient pas
-- toujours comme signature de fin de mail. Nouveau token {{signature}},
-- avec repli automatique sur nom_artiste si non configuré (comportement
-- identique à avant pour tout beatmaker qui ne touche pas ce champ).

ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS signature_emails text;
