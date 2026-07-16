-- ============================================================
-- Fusion de compte client — transaction atomique
-- ============================================================
-- Remplace la fusion faite en plusieurs appels JS successifs dans
-- lib/lier-compte-client.ts, qui laissait une fenêtre pendant laquelle un
-- webhook Stripe concurrent (invoice.payment_succeeded, quasi simultané à
-- checkout.session.completed) pouvait insérer une nouvelle commande
-- référençant la fiche invitée PILE entre la réassignation et la
-- suppression — bug reproductible à chaque test le 2026-07-15/16, pas
-- juste une coïncidence rare (les 2 événements Stripe arrivent
-- structurellement à quelques centaines de ms l'un de l'autre).
--
-- SELECT ... FOR UPDATE verrouille la fiche invitée : toute transaction
-- concurrente qui tente d'insérer une ligne référençant cette fiche (le
-- webhook, via la contrainte de clé étrangère) doit attendre que cette
-- fonction se termine avant de continuer — au lieu de deviner un délai
-- d'attente, Postgres synchronise lui-même les deux transactions.

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

  INSERT INTO clients (id, email, nom, prenom, newsletter_consent)
  VALUES (id_reel, email_reel, COALESCE(nom_reel, id_invite::text), prenom_reel, COALESCE(newsletter_consent_reel, false));
END;
$$;

GRANT EXECUTE ON FUNCTION fusionner_compte_client TO service_role;
