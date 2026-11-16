# Passation — Rang 9d, lot 4 : RGPD + Admin, décisions prises → coder (fiches clients PAR boutique)

Date : 2026-11-16 (fin d'après-midi). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT4_2026-11-16.md`.

## État en arrivant

- **Lots 0, 1, 2, 3 ✅ CLOS** (checklists dans `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique »).
- **Lot 4 : rien n'est codé.** La session du 2026-11-16 (fin d'après-midi) a servi à trancher, une question à la fois, les 10 points ouverts. La checklist T0-T13 est écrite dans `ROADMAP.md` (juste après « Lot 3 ✅ CLOS »). **Jake n'a PAS encore donné son feu vert pour coder** : il a clôturé pour libérer le contexte.
- Rappels du lot 3 : toute écriture automatique d'une fiche = `ecrire_fiche_boutique` (`lib/fiche-boutique-ecriture.ts`) ; lire/écrire une fiche = `app/dashboard/business/_lib/fiche-boutique.ts` ; garde d'appartenance = `clientsLiesABoutique` (`_lib/appartenance.ts`). **`reconstruire_fiches_boutique` : NE PLUS LA RELANCER.**

## Intention de Jake (à ne pas rouvrir)

Une boutique = un commerce indépendant, comme Shopify ; une fiche client par boutique, seulement ce que le client a donné ou fait chez elle ; la main du beatmaker gagne. Données de test gardées, ne jamais proposer de les remettre « comme avant ».

**Rôle RGPD posé dans cette session** : pour les fiches des boutiques, Sonoo est **sous-traitant** (exécutant technique, comme Shopify) — la boutique est responsable et répond aux demandes de ses clients ; Sonoo fournit les outils, ne consulte que pour le service, n'agit jamais à la place d'une boutique. Pour le **compte Sonoo** de la personne, Sonoo est responsable. Levier de Jake contre une boutique qui ne respecte pas le RGPD : la suspension existante (Admin → Boutiques → Suspendre, motif « Motif légal »), droit contractuel à écrire dans les conditions beatmaker.

## Décisions du lot 4 (Jake, 2026-11-16)

1. **« Effacer ce contact »** — geste du beatmaker, dans SA boutique seulement. Fiche `leads` vidée (emails, téléphones, adresses, prénom/nom/nom d'artiste, notes, tags, surnom, réseaux, pays, langue) ; contact caché de Contacts, segments, listes, doublons, campagnes, automatisations ; fiche affichée « Contact effacé le … » ; fusions, doublons ignorés, membres de listes de cette boutique retirés. Sur les commandes, free downloads, tentatives de paiement, ventes importées et journaux d'emails de CETTE boutique : **on garde seulement ce qui est sur la facture** (nom, adresse, raison sociale, TVA, pays) ; **email et téléphone effacés pour de bon** (option B, entre WooCommerce par défaut et Shopify). Commandes, factures, Analytics intacts ; la personne garde ses achats dans « Mon compte ».
2. **Retour après effacement** : fiche neuve (seulement ce qui est redonné), anciennes commandes retrouvées via le compte (`client_id`) ; aucune donnée effacée ne revient.
3. **Export** : UN fichier CSV lisible en rubriques (fiche, commandes, abonnements, free downloads, ventes importées, emails envoyés, listes, favoris de la boutique).
4. **Notes et tags INCLUS dans l'export**, avec un avertissement avant téléchargement (le beatmaker relit avant d'envoyer).
5. **Suppression du compte Sonoo** : connexion + favoris supprimés ; ligne `clients` **anonymisée (email technique, nom/téléphone/adresse effacés), JAMAIS supprimée** ; fiches des boutiques intactes ; retour = nouveau compte (Doublons de la boutique signale la nouvelle fiche).
6 bis. **Pas de bouton client « effacer mes données d'une boutique »** : le client demande, la boutique efface (comme Shopify).
6. **Abonnement actif** : suppression du compte ET effacement du contact BLOQUÉS (« annule d'abord ton abonnement chez X » / « ce contact a un abonnement actif »), jamais d'annulation automatique.
7. **Bloc Sonoo obligatoire sur les pages légales** : non modifiable, affiché sous le texte du beatmaker (`app/[slug]/_components/PageLegale.tsx`), mis à jour partout d'un coup. **Il n'existe aujourd'hui que dans les contrats PDF** (« RÔLE DE LA PLATEFORME ») ; dans les pages légales la phrase Sonoo fait partie du texte adopté (figé, modifiable). Contenu dans ce lot : **Confidentialité seulement** (ce que reçoit la boutique : connexion = email, inscription = + nom, Google = + nom Google, paiement = coordonnées de la commande, newsletter ; export/effacement à demander à la boutique ; compte Sonoo séparé, lien vers `sonoo.app/confidentialite`). Mettre aussi le modèle (`lib/pages-legales.ts`) à jour. Créer la page `sonoo.app/confidentialite` (compte Sonoo), ouverte malgré la maintenance (`lib/maintenance.ts`). Pas d'email automatique aux beatmakers : Jake les prévient via Admin → Mails plateforme.
8. **Admin (option C1)** : `app/dashboard/admin/clients/[id]` = compte Sonoo (actif / supprimé) + fiche complète de chaque boutique en **lecture seule**, pour le support ; **chaque consultation tracée** dans le journal des décisions (`lib/decisions-log.ts`) ; seule action = « Supprimer le compte » Sonoo ; `corrigerClientAction` retirée (dernière écriture CRM de `clients`) ; la recherche Admin trouve aussi un email présent seulement dans une fiche de boutique. Pas d'effacement ni d'export à la place d'une boutique.
9. **Email « Ton compte Sonoo a été supprimé le … »** (rappel : les boutiques gardent leurs fiches, leur écrire pour être effacé ; « si ce n'est pas toi : contact@sonoo.app »), via `EMAIL_EXPEDITEUR_PLATEFORME` ; liste blanche toujours active.

Décidé par Claude sans question : confirmations en tapant `EFFACER` / `SUPPRIMER` ; suppression du compte = session obligatoire (cookie d'abonné refusé) ; cases newsletter cochées par défaut + « Tout sélectionner », cochée = « désinscrit » (geste du client) ; suppression refusée si la connexion est aussi une boutique (`beatmakers.id` référence `auth.users` en CASCADE dans `supabase/schema.sql` → supprimer la connexion supprimerait la boutique).

## Pour le juriste (étape 17, ne bloque pas le lot)

Conditions beatmaker : accord au bloc Sonoo mis à jour sans nouvel accord ; contrat de sous-traitance (art. 28 RGPD, consultation pour le support) ; motifs de suspension dont non-respect de la loi / RGPD ; règlements P2B / DSA (motif, préavis avant fermeture définitive ?). À vérifier dans le code : un beatmaker suspendu peut-il encore ouvrir Contacts pour effacer (sinon, noter pour l'étape 17 un accès Contacts pendant une suspension « Motif légal »).

## Première étape attendue

Jake doit donner son **feu vert explicite** sur la checklist T0-T13 (`ROADMAP.md`). Rappeler en 5 lignes les décisions, puis attendre. Ensuite : T0 (relevé des colonnes personnelles client × boutique), puis le SQL de lecture du T1 (liens vers `auth.users` et `clients` en base — la FK `clients.id → auth.users` a été retirée par `supabase/etape11b_client_resolution.sql`, à confirmer ; nullabilité de `commandes.client_id` / `acheteur_email` ; unicité de `clients.email`).

## À lire / vérifier avant de coder

- `ROADMAP.md` section 9d (décisions + checklist du lot 4).
- `app/[slug]/mon-compte/page.tsx` (`clientId = user.id` : l'identifiant du compte = identifiant de connexion), `app/[slug]/confidentialite/page.tsx`, `app/[slug]/_components/PageLegale.tsx`, `lib/pages-legales.ts`, `app/dashboard/legal/`.
- `app/dashboard/admin/clients/[id]/` (page, `ClientDetailClient.tsx`, `_lib/actions.ts`), `app/dashboard/admin/recherche`.
- Tables liées à `clients` (relevé du lot 3) : CASCADE sur abonnements_boutique, automatisation_*, campagne_envois, commandes_externes, doublons_ignores, favoris, free_downloads, fusions_crm, imports_externes_contacts, leads, liste_membres, morceaux_clients ; NO ACTION sur commandes, licence_downloads, tentatives_paiement, clients.fusionne_dans ; SET NULL sur beat_plays, email_logs.
- `lib/suspension.ts`, `lib/admin-boutiques.ts` (suspension existante).
- Mémoires `feedback_action_serveur_capture_fonction.md` (aide d'une action serveur au niveau du module), `feedback_questions_une_par_une_shopify.md`.
- Piège : avant de conclure à un bug de comptage, vérifier `fusions_crm` de la boutique.

## Méthode attendue par Jake

1. Questions : **une à la fois, en situation**, avec la comparaison « comment font Shopify / les autres » ; ne jamais attribuer à Claude une affirmation qu'il n'a pas faite (vérifier avant de répondre).
2. Code sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app. Lire `node_modules/next/dist/docs/` avant tout code Next.js.
3. SQL un par un, le plus tôt possible : gros = lien cliquable vers le fichier, petit = dans le chat ; où cliquer (SQL Editor → New query → Run) ; vérification dans un onglet séparé. Essayer d'abord sur PGlite (modèle `.scratch/9d-lot3-T2-pglite.mjs` ; `npm i @electric-sql/pglite@0.2.17` dans le scratchpad).
4. Après le lot : tous les tests faisables seul (routes en direct avec `nicojacob83+…`, dev-browser, journaux Vercel `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'`) AVANT la liste de Jake ; valider ce qui est prouvé par le code ; reporter dans `ROADMAP.md` ; deux listes « fait / validé » et « reste à tester » (boutons exacts, une page par façon de faire).
5. Faille trouvée = signalée et bloquée dans le lot. Fonctionnel, pas l'apparence.
6. Signal sonore (`(New-Object Media.SoundPlayer 'C:\Windows\Media\Alarm01.wav').PlaySync()`) quand Jake doit revenir.
7. Clôture : lire `.claude/commands/cloture.md` et l'appliquer.

## Comptes de test

jakeb-test `nicojacob83+test@gmail.com` ; Beatmaker B `contact+test@jakebmusic.com` ; nic-beat-2809 `nicojacob83+2809a@gmail.com`. Comptes artistes du lot 3 : `nicojacob83+9d3@gmail.com`, `nicojacob83+9d3b@gmail.com` (mot de passe `Lot3-1305473516a3`) — bons candidats pour tester la suppression de compte (créer plutôt un nouveau compte `+9d4…` pour garder ceux-là).

## Règles (inchangées)

Aucun email réel hors liste blanche ; ne jamais lire `.env.local` ; ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo ; aucun changement DNS sans relevé avant/après et accord. SQL qui modifie : filtre exact + SELECT de contrôle avant, une transaction ; toute nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role ; `leads` ne s'écrit qu'avec la clé de service.

## Données de test laissées (pas de ménage demandé)

Inchangées depuis le lot 3 (voir `ROADMAP.md`) ; cette session n'a rien écrit en base.
