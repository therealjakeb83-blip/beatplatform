-- Import de commandes externes — lot 1 : consentement newsletter PAR BOUTIQUE
-- 3 statuts sur leads (relation client ↔ boutique) :
--   'inscrit'     : a dit oui à CETTE boutique
--   'non_inscrit' : n'a jamais dit oui ni non (défaut)
--   'desinscrit'  : a dit non (lien de désinscription, décoché lui-même)
-- clients.newsletter_consent (global) n'est plus lu ; il sera supprimé par
-- newsletter_statut_par_boutique_menage.sql une fois le nouveau code en ligne.

BEGIN;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS newsletter_statut text NOT NULL DEFAULT 'non_inscrit';
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_newsletter_statut_check;
ALTER TABLE leads ADD CONSTRAINT leads_newsletter_statut_check
  CHECK (newsletter_statut IN ('inscrit', 'non_inscrit', 'desinscrit'));

ALTER TABLE leads ADD COLUMN IF NOT EXISTS newsletter_statut_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS newsletter_statut_source text;

-- Reprise : inscrit chez CETTE boutique uniquement (le drapeau global est ignoré)
UPDATE leads
SET newsletter_statut = 'inscrit',
    newsletter_statut_at = created_at,
    newsletter_statut_source = 'reprise'
WHERE newsletter_inscrit = true;

-- Reprise : désinscrit via un lien de campagne de CETTE boutique
UPDATE leads l
SET newsletter_statut = 'desinscrit',
    newsletter_statut_at = d.derniere,
    newsletter_statut_source = 'reprise'
FROM (
  SELECT ce.client_id, c.beatmaker_id, max(ce.desinscrit_at) AS derniere
  FROM campagne_envois ce
  JOIN campagnes c ON c.id = ce.campagne_id
  WHERE ce.desinscrit_at IS NOT NULL
  GROUP BY ce.client_id, c.beatmaker_id
) d
WHERE l.client_id = d.client_id
  AND l.beatmaker_id = d.beatmaker_id
  AND l.newsletter_inscrit = false;

CREATE INDEX IF NOT EXISTS leads_beatmaker_newsletter_statut_idx
  ON leads (beatmaker_id, newsletter_statut);

COMMIT;

-- Contrôle (à lancer après) : répartition par statut, et cohérence avec l'ancien booléen
-- SELECT newsletter_statut, newsletter_inscrit, count(*)
-- FROM leads GROUP BY 1, 2 ORDER BY 1, 2;
