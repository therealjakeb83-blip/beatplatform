# Passation — Rang 9d, lot 5 : ménage (la fiche commune `clients` ne garde que le compte)

Date : 2026-11-16 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT4_CODE_2026-11-16.md` (lot 4 codé, testé et clos).

## État en arrivant

- **Lots 0, 1, 2, 3, 4 ✅ CLOS.** Les checklists et leurs résultats sont dans `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ». Le lot 4 (RGPD + Admin) a été clos le 2026-11-16 au soir : T0-T13 validés. T7 a été testé à l'écran par Jake, le reste en ligne par Claude.
- **Lot 5 : rien n'est cadré en détail.** Le plan validé le 2026-11-12 dit seulement : « lot 5 ménage (la fiche commune ne garde que le compte) ».
- Ce que le lot 4 a mis en place, et qu'il faut respecter :
  - `leads.efface_le` = contact effacé par la boutique. Il doit être caché de tout nouvel écran, export, envoi ou automatisation (`chargerEffacesBoutique`, `clientsLiesNonEffaces`).
  - `clients.supprime_le` = compte Sonoo supprimé. La ligne est anonymisée (`compte-supprime-<id>@supprime.invalid`, nom « Compte supprimé ») et ne doit **JAMAIS être supprimée**, car des cascades la relient aux données des boutiques.
  - `licence_downloads.ip_effacer_apres` = IP d'un contact effacé, gardée 120 jours puis vidée la nuit (`lib/ip-echues.ts`, tâche `paiements-multi`).
  - Fonctions SQL : `effacer_contact_boutique`, `supprimer_compte_client`, et `ecrire_fiche_boutique`, qui repart de zéro pour un effacé.
- Rappels des lots précédents :
  - Écriture automatique d'une fiche = `ecrire_fiche_boutique` (`lib/fiche-boutique-ecriture.ts`).
  - Lecture et écriture d'une fiche = `app/dashboard/business/_lib/fiche-boutique.ts`.
  - Appartenance = `_lib/appartenance.ts`.
  - **`reconstruire_fiches_boutique` : NE JAMAIS LA RELANCER.**

## Intention de Jake (à ne pas rouvrir)

Une boutique = un commerce indépendant, comme Shopify. Chaque boutique a sa propre fiche client, qui ne contient que ce que le client a donné ou fait chez elle. La main du beatmaker gagne. Pour les fiches des boutiques, Sonoo est **sous-traitant** ; pour le compte Sonoo, Sonoo est responsable. **Les données de test restent** : ne jamais proposer de les remettre « comme avant ».

## Ce que le lot 5 doit faire (à cadrer avec Jake)

Objectif : la ligne `clients` ne doit plus porter que le **compte Sonoo** de la personne (identifiant, email de connexion, nom du compte, `supprime_le`, `fusionne_dans`, ce dont « Mon compte » a besoin). Les colonnes CRM recopiées dans les fiches au lot 1 n'ont plus de raison d'y rester : notes, tags, surnom, réseaux, emails secondaires, téléphone, nom d'artiste…

Avant de proposer la checklist :
1. **Relevé dans le code** : lister chaque lecture et chaque écriture des colonnes CRM de `clients`. Chercher `from('clients')` et les `select` contenant ces colonnes, en particulier dans les routes publiques, le paiement, le free download, l'import, `lib/automatisations.ts`, Analytics et `/mon-compte`. Toute lecture restante doit passer par la fiche de la boutique, ou disparaître.
2. **Relevé en base** (SQL en lecture, envoyé à Jake) : colonnes réelles de `clients`, vues ou fonctions qui les lisent (`pg_depend`, définitions des fonctions), nombre de lignes non vides par colonne.
3. Point noté au lot 3, à trancher : un free download **sans** case newsletter ne crée aucune fiche dans la boutique, et le prénom, le nom et le pays saisis dans le formulaire n'existent alors que dans la fiche commune. Que deviennent-ils une fois la fiche commune vidée ?
4. Méthode : vider ou supprimer les colonnes en SQL (une transaction, essayé d'abord sur PGlite), sans jamais supprimer de ligne `clients`. Comparer avec ce que fait Shopify : le compte client est séparé du profil de chaque boutique.

Ensuite : présenter la checklist T0-TN à Jake, une question à la fois si une décision est nécessaire, et **ne rien coder avant son feu vert**.

## Méthode attendue

- Code sur `main`, commit et push après chaque changement ; Jake teste sur sonoo.app.
- SQL donnés un par un : un gros SQL = lien cliquable vers le fichier, un petit = collé dans le chat. Toujours préciser où cliquer, et donner la vérification à lancer dans un onglet séparé.
- Après le lot : faire **soi-même tous les tests faisables** avant de donner la liste de Jake : appels directs aux routes, dev-browser avec le profil `domaine` (session jakeb-test + Admin), journaux Vercel. Valider ce qui est prouvé à 100 % par le code, reporter dans `ROADMAP.md`, puis donner deux listes, « fait / validé » et « reste à tester », avec des étapes précises, les noms des boutons, et comment défaire.
- Une faille trouvée est signalée et bloquée dans le lot. On teste le fonctionnement, pas l'apparence.

## Règles

Aucun email réel hors liste blanche. Ne jamais lire `.env.local`. Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et sans l'accord de Jake. SQL qui modifie = filtre exact + SELECT avant, une transaction. Nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role. La table `leads` ne s'écrit qu'avec la clé de service.

## Données de test laissées (ménage à l'étape 17, pas avant)

- « Test Lot3 » (`+lot3-t13abo`) : effacé chez jakeb-test, et compte Sonoo supprimé.
- `nicojacob83+9d4fiche@gmail.com` : email ajouté sur la fiche « Test Lot4 » chez jakeb-test.
- Comptes `nicojacob83+9d4@` (créé) et `+9d4b@` (supprimé ; fiche jakeb-test gardée, NWT désinscrit).
- Pour le juriste (étape 17), déjà listé dans `ROADMAP.md` : un beatmaker suspendu ne peut plus effacer un contact.
