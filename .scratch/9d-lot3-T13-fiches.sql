-- 9d lot 3 : lecture seule. Fiches créées par les tests du lot 3 (adresses nicojacob83+9d3…).
SELECT b.slug AS boutique, l.source, l.emails, l.prenom, l.nom, l.pays, l.telephones,
       l.adresses -> 0 ->> 'ligne' AS adresse, l.newsletter_statut, l.champs_manuels,
       l.premier_contact_le::date AS premier_contact,
       c.prenom AS commune_prenom, c.nom AS commune_nom, c.telephone AS commune_tel, c.adresse AS commune_adresse,
       EXISTS (SELECT 1 FROM automatisation_evenements e WHERE e.reference_id = l.id AND e.type = 'bienvenue_perso') AS bienvenue_prevu
FROM leads l
JOIN beatmakers b ON b.id = l.beatmaker_id
JOIN clients c ON c.id = l.client_id
WHERE c.email LIKE 'nicojacob83+9d3%@gmail.com'
ORDER BY c.email, b.slug;
