# Passation — Rang 9d, lot 4 : RGPD + Admin (fiches clients PAR boutique)

Date : 2026-11-16. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT3_2026-11-16.md`.

## État en arrivant

- **Calibrage 9d (10 décisions, 2026-11-12)** : mémoire `project_fiches_clients_9d_grillme_2026_11_12.md` ; `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ».
- **Lots 0, 1, 2, 3 ✅ CLOS** (checklists et résultats dans `ROADMAP.md`).
- **Lot 3 en bref (2026-11-16)** : toute écriture AUTOMATIQUE d'une fiche boutique passe par la fonction SQL `ecrire_fiche_boutique` (`supabase/fiches_clients_lot3_ecriture.sql`), appelée par `lib/fiche-boutique-ecriture.ts` (`ecrireFicheBoutique`) et par l'import SQL. Règles : emails nouveau à la fin (principal jamais changé tout seul) ; téléphones/adresses récent en tête (à la fin si liste manuelle ou donnée « ancienne » d'import) ; prénom/nom/nom d'artiste remplis une fois ; pays/langue dernière valeur ; source + 1er contact figés ; champ de `champs_manuels` jamais touché. Ce que reçoit la boutique : connexion = email ; inscription = + prénom/nom saisis ; Google = + nom Google ; paiement/abonnement = coordonnées de la commande ; free download = formulaire (fiche toujours écrite) ; import = fichier ; ajout manuel = saisie marquée manuelle. `clients` ne reçoit plus que : ligne minimale (email, `nom = ''`), le compte (inscription/Google, `lierCompteClient`), les paiements de la personne (préremplissage de son paiement suivant), l'Admin.
- **Failles fermées au lot 3** : 5 (ajout manuel « existe déjà »), 9 (`api/artiste/lier-compte` sans session inscrivait n'importe qui ailleurs → connecté seulement), 10 (formulaire newsletter réinscrivait un désinscrit → email de confirmation). Perte de données corrigée : `fusionner_compte_client` transfère désormais `campagne_envois`, `commandes_externes`, `imports_externes_contacts`, `fusions_crm` (2 colonnes), `liste_membres`, `clients.fusionne_dans`.
- **`reconstruire_fiches_boutique` : NE PLUS LA RELANCER** (dernière exécution au T11 du lot 3 : 0 changement, 2 810 fiches, 0 sans email ; elle recopie encore la fiche commune).

## Intention de Jake (à ne pas rouvrir)

**Une boutique = un commerce = ses propres clients, comme Shopify.** Une fiche client par boutique, seulement ce que le client a donné ou fait chez elle, plus ce que le beatmaker y note. La main du beatmaker gagne. Données de test GARDÉES ; ne jamais proposer de les remettre « comme avant ».

Décisions newsletter du lot 3 (Jake, 2026-11-16) : formulaire public = un clic, MAIS adresse désinscrite = email « Confirme ton inscription » (modèle Mailchimp) ; achat : rien à changer ; inscription d'un compte : case appliquée à la confirmation du compte si désinscrit. Noté pour après le lancement : réglage « confirmation pour tous » par boutique (comme Shopify).

## Lot 4 — à faire (checklist T0-TN à présenter AVANT de coder)

D'après le calibrage (décisions 4, 8, 9) :
- **« Effacer ce contact »** dans chaque boutique : anonymise la fiche de CETTE boutique (emails, téléphones, adresses, noms, notes, tags, réseaux), garde commandes et factures (obligation 10 ans) ; à décider : ce que deviennent les copies d'identité sur les commandes (`acheteur_nom/adresse/telephone`), les listes, les fusions, les envois.
- **Exporter une fiche** (droit d'accès RGPD : la boutique répond) : format à proposer.
- **Supprimer son compte Sonoo** (`/mon-compte`) : supprime connexion, `/mon-compte`, favoris ; les fiches boutique RESTENT ; la personne est prévenue que les boutiques gardent leurs données ; liste des boutiques où elle est inscrite à la newsletter, une case par boutique + « Tout sélectionner », **cochées par défaut** (le plus protecteur, sauf avis contraire de Jake).
- **Page Confidentialité** de chaque boutique (et de Sonoo) adaptée : chaque boutique reçoit ce qui lui est transmis (connexion = email, etc.).
- **Vue Admin** : l'admin Sonoo voit tout (fiches de toutes les boutiques d'un client) ; `app/dashboard/admin/clients/[id]` lit et écrit encore `clients` (seule écriture CRM restante).
- Rôle juridique Sonoo vs boutiques : à faire valider par un juriste (étape 17), ne pas bloquer le lot.

Ensuite : lot 5 (ménage : `clients` ne garde que le compte ; supprimer `reconstruire_fiches_boutique` ; colonnes CRM de `clients` à retirer ; complément d'adresse des paiements dans `clients` à revoir).

## À lire / vérifier avant de commencer

- `ROADMAP.md` section 9d (lots 0-3).
- `app/dashboard/business/_lib/fiche-boutique.ts` (lecture, `modifierFicheBoutique`) et `lib/fiche-boutique-ecriture.ts` (écritures automatiques).
- Toutes les tables liées à `clients` (relevé T1 du lot 3 : CASCADE sur abonnements_boutique, automatisation_*, campagne_envois, commandes_externes, doublons_ignores, favoris, free_downloads, fusions_crm, imports_externes_contacts, leads, liste_membres, morceaux_clients ; NO ACTION sur commandes, licence_downloads, tentatives_paiement, clients.fusionne_dans ; SET NULL sur beat_plays, email_logs) : supprimer une ligne `clients` efface en cascade des données de boutiques → la suppression de compte ne doit PAS supprimer la ligne `clients` telle quelle.
- Mémoire `feedback_action_serveur_capture_fonction.md`.
- Piège : avant de conclure à un bug de comptage, vérifier `fusions_crm` de la boutique.

## Méthode attendue par Jake

1. Présenter la **checklist T0-TN du lot 4 AVANT de coder**, attendre le feu vert explicite. Poser les questions ouvertes en situation + A/B, avec recommandation.
2. Code sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
3. SQL un par un, envoyé le plus tôt possible : gros = lien markdown cliquable vers le fichier, petit = dans le chat ; dire où cliquer (SQL Editor → New query → Run) ; vérification dans un onglet séparé. Essayer d'abord sur PGlite (`.scratch/9d-lot3-T2-pglite.mjs` = modèle de base locale avec les tables utiles ; PGlite installé dans le scratchpad de session, à réinstaller : `npm i @electric-sql/pglite@0.2.17`).
4. **Tests : faire SOI-MÊME tout ce qui est faisable** (appels directs aux routes avec des adresses `nicojacob83+…`, achats via `dev-browser`, journaux Vercel) ; ne laisser à Jake que ce qui exige sa boîte mail, sa connexion beatmaker ou un SQL de lecture. Jake l'a rappelé au lot 3 (« il ne reste que les tests que tu ne peux pas faire seul et qui ne sont pas prouvés par le code ? »).
5. Journaux Vercel : `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'` ; requêtes : `vercel logs requests ... --query 'requestMethod:POST'` (montre ce que Jake a vraiment cliqué).
6. Faille trouvée = signalée et bloquée dans le lot.
7. Signal sonore (`(New-Object Media.SoundPlayer 'C:\Windows\Media\Alarm01.wav').PlaySync()`) quand Jake doit revenir.
8. Clôture : la commande `/cloture` n'est pas chargée comme commande dans toutes les sessions → lire `.claude/commands/cloture.md` et l'appliquer à la main.

## Piège vu au lot 3

Un compte de test créé par appel direct à `sonoo.app/api/artiste/inscription` a son lien de confirmation sur `sonoo.app` : la session est posée sur sonoo.app puis renvoyée vers la boutique (`jakeb-test.sonoo.app`, autre adresse) → pas connecté. Pas un bug (un vrai client s'inscrit depuis la boutique) : pour un test, donner à Jake email + mot de passe pour se connecter sur la boutique.

## Comptes de test

jakeb-test `nicojacob83+test@gmail.com` ; Beatmaker B `contact+test@jakebmusic.com` ; nic-beat-2809 `nicojacob83+2809a@gmail.com`. Comptes artistes du lot 3 : `nicojacob83+9d3@gmail.com`, `nicojacob83+9d3b@gmail.com` (mot de passe `Lot3-1305473516a3`).

## Règles (inchangées)

- Fonctionnel d'abord, pas d'apparence.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- SQL qui modifie : filtre exact + SELECT de contrôle avant, une transaction ; toute nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role ; `leads` ne s'écrit qu'avec la clé de service.
- Lire `node_modules/next/dist/docs/` avant tout code Next.js.

## Données de test laissées (pas de ménage demandé)

Lot 2 : chez Beatmaker B, fusion nicojacob83@gmail.com → nicojacob83+artiste@, liste « liste tests » ; chez jakeb-test, prénom « Test9 » sur nicojacob83@gmail.com. Lot 3 : comptes `+9d3@` et `+9d3b@` (jakeb-test), acheteur `+9d3achat@` (commande collab 95ec936b, beat « Ambitieux »), `+9d3nl@` inscrit à la newsletter de nic-beat-2809. Le tout part avec le ménage de l'étape 17.
