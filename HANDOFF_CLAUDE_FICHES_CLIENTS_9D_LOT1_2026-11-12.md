# Passation — Rang 9d, lot 1 : une fiche client PAR boutique

Date : 2026-11-12 (nuit). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_2026-11-12.md`.

## État en arrivant

- **Calibrage du rang 9d fait le 2026-11-12 (10 questions)**. Journal complet : mémoire `project_fiches_clients_9d_grillme_2026_11_12.md` ; résumé dans `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ».
- **Lot 0 (failles) ✅ CLOS (T0-T12)**, commits `bc089ba` + `28c95ad`, SQL `supabase/fiches_clients_lot0_menage_clients.sql` exécuté :
  - cookie d'abonné `abo_<slug>` signé : `lib/cookie-abonne.ts` (`lireEmailCookieAbonne`, `poserCookieAbonne`), jamais lu en clair ;
  - garde d'appartenance `clientsLiesABoutique` / `clientLieABoutique` (`app/dashboard/business/_lib/appartenance.ts` : leads, commandes, abonnements de la boutique), posée sur la fiche contact et ses 10 actions, la fusion, « ignorer », les listes ;
  - favoris filtrés par `beats.beatmaker_id` (fiche, liste Contacts, `chargerContactsEnrichis`) ;
  - `clients` : règles `*_own` supprimées, plus aucun droit pour anon/authenticated (aucun code ne lisait `clients` avec la session de l'utilisateur).
- Leçon : une aide appelée par une action serveur `'use server'` se définit au niveau du module, jamais dans la page (sinon la page entière plante ; mémoire `feedback_action_serveur_capture_fonction.md`).

## Intention de Jake (à ne pas rouvrir)

**Une boutique = un commerce = ses propres clients, comme Shopify.** A n'a jamais accès aux données ni aux clients de B, même si le même client est passé partout. Deux niveaux :

1. le **compte Sonoo** de la personne (connexion + `/mon-compte`), à elle seule + l'admin ;
2. la **fiche client de chaque boutique** : seulement ce que le client a donné/fait DANS cette boutique, plus ce que le beatmaker y note.

Décisions (détail dans la mémoire) :

- connexion/inscription sur une boutique = devenir contact ; la boutique reçoit ce qui est transmis à ce moment (email ; + nom à l'inscription ; ce que Google transmet) ;
- modifier `/mon-compte` ne change aucune fiche boutique ;
- notes/tags : boutique + admin, jamais le client ;
- collab : l'acheteur n'est pas contact du collaborateur (phases 12/13) ;
- **règles par champ** : accumulés (emails, adresses postales, téléphones) ; remplis une fois (prénom, nom, nom d'artiste) ; dernière valeur (pays, langue) ; figés (source, date du 1er contact) ; beatmaker seul (notes, tags, surnom, réseaux) ; **la main du beatmaker gagne** (champ modifié à la main = plus jamais touché par l'automatique) ; raison sociale/TVA restent sur la commande ;
- migration : reconstruire chaque fiche à partir de ce que la boutique a reçu (ses commandes, sa source, son import) ; notes/tags/surnom/réseaux/emails secondaires actuels recopiés dans les boutiques liées (données de test) ;
- suppression du compte Sonoo : compte, `/mon-compte`, favoris supprimés ; fiches boutique gardées ; bouton « Effacer ce contact » (anonymise, garde factures) ; à la suppression, une case par boutique où le client est inscrit + « Tout sélectionner » (Claude part sur cochées par défaut) ;
- RGPD exigé dans chaque lot ; rôle juridique Sonoo/boutiques à valider par un juriste (étape 17).

## Plan validé par Jake

| Lot | Contenu |
|---|---|
| 0 ✅ | Failles |
| **1 — à faire** | Fondation : fiche boutique = table `leads` enrichie (unique `(client_id, beatmaker_id)` déjà en place) avec les champs du tableau + marqueurs « modifié à la main » ; SQL de reconstruction (Q7) |
| 2 | Lectures : fiche contact, liste Contacts, segments (`_lib/contacts.ts`), listes, doublons/fusion, emails/automatisations (tokens prénom…) lisent la fiche boutique |
| 3 | Écritures automatiques selon le tableau : connexion (`lib/lier-compte-client.ts`), paiement (`resoudreOuCreerClient` dans `lib/webhook-paiement.ts`), free download, abonnement (`lib/abonnement-boutique-webhook.ts`), import (`lib/import-externe/`, fonctions SQL `importer_commandes_externes`…), ajout manuel (`app/api/contacts/route.ts`, ferme la faille 5 « existe déjà ») |
| 4 | RGPD + Admin : effacer un contact, export, « Supprimer mon compte » + cases newsletter, page Confidentialité de chaque boutique, vue Admin (compte + toutes ses fiches) |
| 5 | Ménage : la fiche commune `clients` ne garde que le compte |

## Pour préparer le lot 1

- Lister les écritures et lectures de `clients` : `grep -rn "from('clients')" app lib` (≈ 37 fichiers relevés le 2026-11-12) et les fonctions SQL qui écrivent `clients`/`leads` (`supabase/import_externe_lot*.sql`, `fusionner_compte_client`, `inscrire_newsletter_groupe`).
- Vérifier en base les colonnes réelles de `leads` et `clients` (requête `information_schema.columns`, petit SQL dans le chat, Jake colle, Claude lit) avant d'écrire la migration.
- `leads` : vérifier les droits (`contacts/page.tsx` dit « leads n'a pas GRANT service_role », alors que d'autres fichiers l'écrivent avec la clé de service) — relever en base.
- Fusion de doublons : reste virtuelle et interne à la boutique (`fusions_crm`, annulable) ; ses emails/adresses rejoindront les listes accumulées.
- Noté pour le lot 2 : liens vers la fiche de l'acheteur dans les vues d'un collaborateur (commande collab, analytics d'un beat collab) → mènent à Contacts, à masquer.

## Méthode attendue par Jake

1. Présenter la **checklist T0-TN du lot 1 AVANT de coder**, attendre le feu vert explicite.
2. Coder sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
3. SQL un par un, envoyé le plus tôt possible sans brûler les étapes : gros SQL = lien markdown cliquable vers le fichier ; petit SQL = dans le chat ; dire où cliquer (SQL Editor → New query → Run) ; vérification dans un 2e onglet séparé.
4. Après le lot : tester seul tout ce qui est possible (dev-browser, scripts Node, journaux Vercel en lecture seule : `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'`), valider ce qui est prouvé à 100 % par le code, reporter dans `ROADMAP.md`, donner « fait / validé » et « reste à tester » ; pour les tests de Jake, étapes précises avec noms de boutons et comment défaire.
5. Faille trouvée en route = signalée en une phrase et bloquée dans le lot.

## Règles (inchangées)

- Fonctionnel d'abord, pas d'apparence.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- SQL qui modifie : filtre exact + SELECT de contrôle avant, une transaction ; toute nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role.
- Lire `node_modules/next/dist/docs/` avant tout code Next.js.
- Fin de session : `ROADMAP.md`, page « Où on en est » (même URL, v68 actuellement, mémoire `reference_roadmap_human_friendly.md`), compteur (`reference_compteur_temps_passe.md`, ≈ 472 h), mémoire, `C:\Users\nicoj\wiki-brain\log.md`, passation suivante.

## Ménage à faire par Jake (signalé)

- Supprimer la liste « test 9d » (jakeb-test) ; la paire nicojacob83+test@ / +10@ a été fusionnée puis défusionnée (de nouveau visible dans Doublons).
