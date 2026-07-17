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

-- Titre "Suis-moi sur les réseaux sociaux" du même bloc — personnalisable,
-- vide = texte par défaut.
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS titre_footer_reseaux text;

-- Titre de chaque email (ex. "Merci pour ton achat !") — personnalisable par
-- type en plus de l'intro déjà éditable, vide = texte par défaut de la
-- plateforme (voir TITRE_DEFAUT dans lib/emails.ts).
ALTER TABLE templates_transactionnels ADD COLUMN IF NOT EXISTS titre text;
