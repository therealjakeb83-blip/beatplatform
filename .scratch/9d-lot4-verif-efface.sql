-- 9d lot 4 : contrôle en LECTURE SEULE du dernier contact effacé (T3-T4) et du dernier compte supprimé (T8).
WITH e AS (
  SELECT client_id, beatmaker_id, efface_le FROM leads WHERE efface_le IS NOT NULL ORDER BY efface_le DESC LIMIT 1
), s AS (
  SELECT id, email, supprime_le FROM clients WHERE supprime_le IS NOT NULL ORDER BY supprime_le DESC LIMIT 1
)
SELECT 'effacé' AS quoi, 'boutique / date' AS controle, (SELECT slug FROM beatmakers WHERE id = e.beatmaker_id) || ' / ' || e.efface_le::text AS valeur, '' AS attendu FROM e
UNION ALL SELECT 'effacé', 'emails + téléphones + adresses restants sur la fiche',
  (SELECT (cardinality(emails) + cardinality(telephones) + jsonb_array_length(adresses))::text FROM leads l WHERE l.client_id = e.client_id AND l.beatmaker_id = e.beatmaker_id), '0' FROM e
UNION ALL SELECT 'effacé', 'commandes gardées', (SELECT count(*)::text FROM commandes c WHERE c.beatmaker_id = e.beatmaker_id AND c.client_id = e.client_id), 'inchangé' FROM e
UNION ALL SELECT 'effacé', 'commandes avec encore email ou téléphone',
  (SELECT count(*)::text FROM commandes c WHERE c.beatmaker_id = e.beatmaker_id AND c.client_id = e.client_id AND (c.acheteur_email IS NOT NULL OR c.acheteur_telephone IS NOT NULL)), '0' FROM e
UNION ALL SELECT 'effacé', 'commandes avec le nom de facture',
  (SELECT count(*)::text FROM commandes c WHERE c.beatmaker_id = e.beatmaker_id AND c.client_id = e.client_id AND c.acheteur_nom IS NOT NULL), 'comme avant' FROM e
UNION ALL SELECT 'effacé', 'fiches de cette personne dans d''autres boutiques, intactes',
  (SELECT count(*)::text FROM leads l WHERE l.client_id = e.client_id AND l.beatmaker_id <> e.beatmaker_id AND l.efface_le IS NULL), 'inchangé' FROM e
UNION ALL SELECT 'effacé', 'trace au journal', (SELECT count(*)::text FROM merchant_decisions_log m WHERE m.entity_type = 'client' AND m.entity_id = e.client_id AND m.action = 'contact_efface'), '1' FROM e
UNION ALL SELECT 'compte', 'date de suppression', s.supprime_le::text, '' FROM s
UNION ALL SELECT 'compte', 'anonymisé', CASE WHEN s.email LIKE 'compte-supprime-%@supprime.invalid' THEN 'oui' ELSE 'non' END, 'oui' FROM s
UNION ALL SELECT 'compte', 'connexion restante', (SELECT count(*)::text FROM auth.users u WHERE u.id = s.id), '0' FROM s
UNION ALL SELECT 'compte', 'favoris restants', (SELECT count(*)::text FROM favoris f WHERE f.client_id = s.id), '0' FROM s
UNION ALL SELECT 'compte', 'fiches dans les boutiques, gardées', (SELECT count(*)::text FROM leads l WHERE l.client_id = s.id), '≥ 1' FROM s
UNION ALL SELECT 'compte', 'boutiques désinscrites par la suppression',
  (SELECT count(*)::text FROM leads l WHERE l.client_id = s.id AND l.newsletter_statut_source = 'suppression_compte'), 'cases cochées' FROM s;
