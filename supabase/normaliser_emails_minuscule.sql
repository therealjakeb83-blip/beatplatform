-- ============================================================
-- Normalisation email — tous les champs email existants en base
-- ============================================================
-- Demande Jake (2026-09-18) : un email tapé/enregistré avec une majuscule ne
-- doit plus jamais casser un rapprochement (connexion, restriction de code
-- promo, dédoublonnage CRM...). Le code applicatif normalise désormais en
-- minuscule à l'écriture (voir lib/email.ts) — cette migration met à jour les
-- données déjà en base pour que ce soit vrai partout, pas seulement pour les
-- nouvelles écritures.
--
-- Étape 0 (préalable obligatoire) : un seul doublon de casse existait sur
-- clients.email (contrainte unique) — nicojacob83+artiste@gmail.com vs
-- NICOJACOB83+artiste@GMAIL.COM, deux comptes test de Jake avec de vraies
-- commandes/abonnements sur chacun. Fusionné manuellement ci-dessous (garde
-- le plus ancien, 13 commandes) avant la normalisation en masse, sinon
-- l'UPDATE sur clients.email échoue en violation de contrainte unique.
-- Confirmé par Jake : ce sont des comptes de test, pas de vrais clients.
--
-- Sans danger à rejouer : chaque étape est idempotente (lower() sur une
-- valeur déjà en minuscule ne change rien, WHERE ne retrouve plus rien à la
-- 2e exécution).
--
-- Plusieurs des tables réassignées ci-dessous portent une contrainte
-- unique impliquant client_id (leads : (client_id, beatmaker_id) ;
-- favoris : (client_id, beat_id) ; listes_crm_contacts : (liste_id,
-- client_id) ; campagne_envois : (campagne_id, client_id) ;
-- doublons_ignores : (client_id_1, client_id_2, beatmaker_id) ;
-- fusions_crm : (beatmaker_id, client_id_archive) ; abonnements_boutique :
-- (client_id, beatmaker_id) tant que statut actif/impayé). Réassigner en
-- aveugle plante ces tables-là dès que les deux comptes ont déjà chacun
-- leur propre ligne pour la même clé (trouvé en le lançant : conflit sur
-- leads_client_id_beatmaker_id_key). Pour ces tables, on supprime d'abord
-- la ligne du doublon quand le compte conservé a déjà l'équivalent, puis on
-- réassigne le reste normalement.

begin;

-- --------------------------------------------------------------
-- 0. Fusion du seul doublon de casse connu (clients.email)
-- --------------------------------------------------------------
do $$
declare
  id_invite uuid := '0514f618-8302-428a-bd23-9faca90046c6'; -- NICOJACOB83+artiste@GMAIL.COM
  id_reel   uuid := '9e500759-3f0c-4d0a-8d14-b03588a22595'; -- nicojacob83+artiste@gmail.com
begin
  if exists (select 1 from clients where id = id_invite) then
    -- leads : unique (client_id, beatmaker_id)
    delete from leads
      where client_id = id_invite
        and exists (select 1 from leads l2 where l2.client_id = id_reel and l2.beatmaker_id = leads.beatmaker_id);
    update leads set client_id = id_reel where client_id = id_invite;

    -- favoris : unique (client_id, beat_id)
    delete from favoris
      where client_id = id_invite
        and exists (select 1 from favoris f2 where f2.client_id = id_reel and f2.beat_id = favoris.beat_id);
    update favoris set client_id = id_reel where client_id = id_invite;

    -- listes_crm_contacts : unique (liste_id, client_id)
    delete from listes_crm_contacts
      where client_id = id_invite
        and exists (select 1 from listes_crm_contacts c2 where c2.client_id = id_reel and c2.liste_id = listes_crm_contacts.liste_id);
    update listes_crm_contacts set client_id = id_reel where client_id = id_invite;

    -- campagne_envois : unique (campagne_id, client_id)
    delete from campagne_envois
      where client_id = id_invite
        and exists (select 1 from campagne_envois c2 where c2.client_id = id_reel and c2.campagne_id = campagne_envois.campagne_id);
    update campagne_envois set client_id = id_reel where client_id = id_invite;

    -- abonnements_boutique : index unique partiel (client_id, beatmaker_id) où statut actif/impayé
    delete from abonnements_boutique
      where client_id = id_invite
        and statut in ('actif', 'impaye')
        and exists (
          select 1 from abonnements_boutique a2
          where a2.client_id = id_reel and a2.beatmaker_id = abonnements_boutique.beatmaker_id
            and a2.statut in ('actif', 'impaye')
        );
    update abonnements_boutique set client_id = id_reel where client_id = id_invite;

    -- doublons_ignores : unique (client_id_1, client_id_2, beatmaker_id)
    delete from doublons_ignores
      where client_id_1 = id_invite
        and exists (
          select 1 from doublons_ignores d2
          where d2.client_id_1 = id_reel and d2.client_id_2 = doublons_ignores.client_id_2 and d2.beatmaker_id = doublons_ignores.beatmaker_id
        );
    update doublons_ignores set client_id_1 = id_reel where client_id_1 = id_invite;
    delete from doublons_ignores
      where client_id_2 = id_invite
        and exists (
          select 1 from doublons_ignores d2
          where d2.client_id_2 = id_reel and d2.client_id_1 = doublons_ignores.client_id_1 and d2.beatmaker_id = doublons_ignores.beatmaker_id
        );
    update doublons_ignores set client_id_2 = id_reel where client_id_2 = id_invite;

    -- fusions_crm : unique (beatmaker_id, client_id_archive) — client_id_conserve n'a pas cette contrainte
    delete from fusions_crm
      where client_id_archive = id_invite
        and exists (select 1 from fusions_crm f2 where f2.client_id_archive = id_reel and f2.beatmaker_id = fusions_crm.beatmaker_id);
    update fusions_crm set client_id_archive = id_reel where client_id_archive = id_invite;
    update fusions_crm set client_id_conserve = id_reel where client_id_conserve = id_invite;

    -- Tables sans contrainte unique sur client_id — réassignation directe
    update commandes                 set client_id = id_reel where client_id = id_invite;
    update liste_membres             set client_id = id_reel where client_id = id_invite;
    update free_downloads            set client_id = id_reel where client_id = id_invite;
    update morceaux_clients          set client_id = id_reel where client_id = id_invite;
    update beat_plays                set client_id = id_reel where client_id = id_invite;
    update email_logs                set client_id = id_reel where client_id = id_invite;
    update licence_downloads         set client_id = id_reel where client_id = id_invite;
    update tentatives_paiement       set client_id = id_reel where client_id = id_invite;
    update automatisation_evenements set client_id = id_reel where client_id = id_invite;
    update automatisation_envois     set client_id = id_reel where client_id = id_invite;
    update clients                   set fusionne_dans = id_reel where fusionne_dans = id_invite;

    delete from clients where id = id_invite;
  end if;
end $$;

-- --------------------------------------------------------------
-- 1. Colonnes email simples (texte)
-- --------------------------------------------------------------
update clients               set email = lower(trim(email))               where email <> lower(trim(email));
update beatmakers            set email = lower(trim(email))               where email <> lower(trim(email));
update beatmakers            set email_contact_public = lower(trim(email_contact_public))
  where email_contact_public is not null and email_contact_public <> lower(trim(email_contact_public));
update beat_splits           set email_invite = lower(trim(email_invite))
  where email_invite is not null and email_invite <> lower(trim(email_invite));
update split_payments        set email_invite = lower(trim(email_invite))
  where email_invite is not null and email_invite <> lower(trim(email_invite));
update commandes             set acheteur_email = lower(trim(acheteur_email))
  where acheteur_email is not null and acheteur_email <> lower(trim(acheteur_email));
update abonnements_boutique  set acheteur_email = lower(trim(acheteur_email))
  where acheteur_email is not null and acheteur_email <> lower(trim(acheteur_email));
update tentatives_paiement   set email = lower(trim(email))
  where email is not null and email <> lower(trim(email));

-- --------------------------------------------------------------
-- 2. Colonnes tableau d'emails — lower() + dédoublonnage (une majuscule
--    différente pouvait faire exister 2 fois la "même" adresse dans le
--    tableau une fois normalisée)
-- --------------------------------------------------------------
update clients
  set emails_secondaires = (select array_agg(distinct lower(trim(e))) from unnest(emails_secondaires) as e)
  where emails_secondaires <> (select array_agg(distinct lower(trim(e))) from unnest(emails_secondaires) as e);

update codes_promo
  set emails_autorises = (select array_agg(distinct lower(trim(e))) from unnest(emails_autorises) as e)
  where cardinality(emails_autorises) > 0
    and emails_autorises <> (select array_agg(distinct lower(trim(e))) from unnest(emails_autorises) as e);

update codes_promo
  set emails_exclus = (select array_agg(distinct lower(trim(e))) from unnest(emails_exclus) as e)
  where cardinality(emails_exclus) > 0
    and emails_exclus <> (select array_agg(distinct lower(trim(e))) from unnest(emails_exclus) as e);

update campagnes
  set cible_emails = (select array_agg(distinct lower(trim(e))) from unnest(cible_emails) as e)
  where cible_emails is not null and cardinality(cible_emails) > 0
    and cible_emails <> (select array_agg(distinct lower(trim(e))) from unnest(cible_emails) as e);

update fusions_crm
  set emails_archives = (select array_agg(distinct lower(trim(e))) from unnest(emails_archives) as e)
  where cardinality(emails_archives) > 0
    and emails_archives <> (select array_agg(distinct lower(trim(e))) from unnest(emails_archives) as e);

commit;
