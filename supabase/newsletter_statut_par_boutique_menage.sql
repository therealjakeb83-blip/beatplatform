-- Import de commandes externes — lot 1 : ménage APRÈS mise en ligne du code
-- Supprime le drapeau global clients.newsletter_consent et l'ancien booléen
-- leads.newsletter_inscrit, remplacés par leads.newsletter_statut (par boutique).
-- À lancer seulement quand le nouveau code est déployé sur Vercel.

BEGIN;

-- La fusion de compte ne recopie plus aucun consentement global (le paramètre
-- est gardé pour ne pas casser l'appel, il est ignoré).
CREATE OR REPLACE FUNCTION fusionner_compte_client(
  id_invite uuid,
  id_reel uuid,
  email_reel text,
  nom_reel text,
  prenom_reel text,
  newsletter_consent_reel boolean
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM clients WHERE id = id_invite FOR UPDATE;

  UPDATE clients SET email = email || '.fusion-tmp-' || id_reel::text WHERE id = id_invite;

  INSERT INTO clients (id, email, nom, prenom)
  VALUES (id_reel, email_reel, COALESCE(nom_reel, id_invite::text), prenom_reel);

  UPDATE commandes SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE abonnements_boutique SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE leads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE favoris SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE free_downloads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE licence_downloads SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE tentatives_paiement SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE morceaux_clients SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE beat_plays SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE email_logs SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE listes_crm_contacts SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE doublons_ignores SET client_id_1 = id_reel WHERE client_id_1 = id_invite;
  UPDATE doublons_ignores SET client_id_2 = id_reel WHERE client_id_2 = id_invite;
  UPDATE automatisation_evenements SET client_id = id_reel WHERE client_id = id_invite;
  UPDATE automatisation_envois SET client_id = id_reel WHERE client_id = id_invite;

  DELETE FROM clients WHERE id = id_invite;
END;
$$;

GRANT EXECUTE ON FUNCTION fusionner_compte_client TO service_role;

ALTER TABLE clients DROP COLUMN IF EXISTS newsletter_consent;
ALTER TABLE leads   DROP COLUMN IF EXISTS newsletter_inscrit;

COMMIT;

-- Contrôle (à lancer après) : doit renvoyer 0 ligne
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND ((table_name = 'clients' AND column_name = 'newsletter_consent')
--     OR (table_name = 'leads'   AND column_name = 'newsletter_inscrit'));
