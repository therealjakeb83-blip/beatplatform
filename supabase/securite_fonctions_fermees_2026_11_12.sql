-- ============================================================
-- Sécurité (2026-11-12, trouvé au rang 9c bis lot 3) : fonctions à droits
-- élevés (SECURITY DEFINER) appelables par n'importe quel visiteur avec la clé
-- publique. Relevé en base : fusion de deux comptes clients au choix, recherche
-- de commandes/abonnements par préfixe (fuite), consommation de numéros de
-- facture d'une autre boutique, regroupement de catégories Admin, recalcul des
-- collaborations. Toutes sont appelées par le serveur (clé de service) ou par
-- des déclencheurs internes : les fermer ne casse aucun écran.
-- renommer_categorie_perso reste ouverte aux connectés (appelée avec leur
-- session, elle vérifie elle-même le propriétaire), fermée aux visiteurs.
-- rls_auto_enable appartient à Supabase : pas touchée.
-- ============================================================

begin;

revoke execute on function public.admin_chercher_abonnement_prefixe(text) from public, anon, authenticated;
revoke execute on function public.admin_chercher_commande_prefixe(text) from public, anon, authenticated;
revoke execute on function public.facturation_prochain_numero(uuid, integer) from public, anon, authenticated;
revoke execute on function public.fusionner_compte_client(uuid, uuid, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.recalculer_collaboration_beat(uuid) from public, anon, authenticated;
revoke execute on function public.traiter_groupe_certification(text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.renommer_categorie_perso(uuid, text) from public, anon;

grant execute on function public.admin_chercher_abonnement_prefixe(text) to service_role;
grant execute on function public.admin_chercher_commande_prefixe(text) to service_role;
grant execute on function public.facturation_prochain_numero(uuid, integer) to service_role;
grant execute on function public.fusionner_compte_client(uuid, uuid, text, text, text, boolean) to service_role;
grant execute on function public.recalculer_collaboration_beat(uuid) to service_role;
grant execute on function public.traiter_groupe_certification(text, text, text, boolean) to service_role;
grant execute on function public.renommer_categorie_perso(uuid, text) to authenticated, service_role;

-- Pour l'avenir : une nouvelle fonction créée dans public n'est plus ouverte à
-- tous par défaut ; chaque fichier SQL donne explicitement ses droits (déjà la
-- règle suivie : REVOKE + GRANT service_role).
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public grant execute on functions to service_role;

commit;
