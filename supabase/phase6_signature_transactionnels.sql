-- ============================================================
-- PHASE 6 — Signature dédiée aux emails transactionnels
-- ============================================================
-- Jusqu'ici signature_emails était partagée entre Automatisations et
-- Transactionnels — Jake veut pouvoir signer différemment ("Jake" en
-- automatisation, plus personnel, vs "Jake B" en transactionnel, plus
-- officiel). signature_emails reste inchangée pour Automatisations/
-- Campagnes ; les emails transactionnels utilisent désormais cette
-- nouvelle colonne (repli sur nom_artiste si vide, comme avant).

ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS signature_transactionnels text;

-- Phrase sous "Suis-moi sur les réseaux sociaux" dans le footer des emails
-- transactionnels — personnalisable, vide = texte par défaut de la plateforme.
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS footer_message_reseaux text;
