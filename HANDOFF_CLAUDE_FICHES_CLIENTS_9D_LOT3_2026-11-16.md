# Passation — Rang 9d, lot 3 : écritures automatiques dans la fiche client PAR boutique

Date : 2026-11-16. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT2_2026-11-16.md`.

## État en arrivant

- **Calibrage 9d (10 décisions, 2026-11-12)** : mémoire `project_fiches_clients_9d_grillme_2026_11_12.md` ; `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ».
- **Lot 0 (failles) ✅, lot 1 (fiche boutique = `leads` enrichie + `reconstruire_fiches_boutique`) ✅, lot 2 ✅ CLOS le 2026-11-16 (T0-T13)** — checklist et résultats dans `ROADMAP.md`.
- **Lot 2 en bref** : tous les écrans CRM (fiche contact et ses actions, Contacts, Segments, Campagnes, export newsletter, Listes, Doublons/Fusion/Historique/Ignorés), Commandes, Abonnements, Codes promo, Analytics, Journal des emails, file des automatisations, automatisations (destinataire, prénom, code de relance), facture d'abonnement, renvoi des fichiers, email de remboursement, litiges lisent la fiche de la boutique. Module unique : `app/dashboard/business/_lib/fiche-boutique.ts` (`chargerFichesBoutique`, `modifierFicheBoutique` = clé de service + `champs_manuels`, `remplacerClientsParFiches`, `identiteAcheteurBoutique`, `chargerFusionsBoutique`).
- **Faille 8 fermée** : « Définir comme principal » réécrivait `clients.email` (adresse d'envoi des automatisations de toutes les boutiques) → ne réordonne plus que `leads.emails` de la boutique.
- Prénom et Nom modifiables à la main sur la fiche ; contact sans nom = début de l'email affiché dans Contacts (rien enregistré) ; Listes : un contact fusionné = une ligne sous la fiche conservée (compte, campagne vers une liste, « Retirer »).
- **Les écritures automatiques remplissent encore `clients` seulement** : une nouvelle connexion / un nouvel achat crée une ligne `leads` VIDE (sans email) → la fiche n'a ni email ni nom, et ses automatisations (bienvenue…) sont sautées jusqu'au lot 3.

## Intention de Jake (à ne pas rouvrir)

**Une boutique = un commerce = ses propres clients, comme Shopify.** Une fiche client par boutique avec seulement ce que le client a donné ou fait chez elle, plus ce que le beatmaker y note. Une règle par information (accumulés / remplis une fois / dernière valeur / figés / beatmaker seul), la main du beatmaker gagne. Données de test GARDÉES ; **Jake ne veut pas qu'on remette les données de test « comme avant » après ses essais** (2026-11-16).

## Lot 3 — à faire (checklist T0-TN à présenter AVANT de coder)

Écritures automatiques dans `leads` selon les règles par champ, à chaque endroit qui écrit aujourd'hui `clients` :
- connexion / inscription / Google (`lib/lier-compte-client.ts`, `app/auth/callback/route.ts`, `app/api/artiste/google/retour/route.ts`, `app/api/artiste/compte-confirme/route.ts`) : email seul (+ nom saisi à l'inscription, + ce que Google transmet) ;
- paiement (`resoudreOuCreerClient` et le bloc lead de `lib/webhook-paiement.ts`), abonnement (`lib/abonnement-boutique-webhook.ts`, `app/api/stripe/abonnement/succes/route.ts`) : email, nom, téléphone, adresse, pays de la commande ;
- free download (`lib/free-download.ts`, `app/api/free-download/route.ts`) : prénom, nom, nom d'artiste, pays du formulaire ; **aujourd'hui un free download sans case newsletter ne crée AUCUNE fiche** → décider ;
- newsletter publique (`app/api/artiste/newsletter-publique/route.ts`) ;
- import (`lib/import-externe/`, fonctions SQL `importer_commandes_externes`…) ;
- ajout manuel (`app/api/contacts/route.ts`) : ferme la faille 5 (« existe déjà » révèle un client d'ailleurs) ; normaliser le pays en majuscules (aujourd'hui `fr`).

Points à trancher dans la checklist : (a) relancer `select reconstruire_fiches_boutique(true);` en TÊTE du lot ; (b) listes accumulées marquées « à la main » (`emails`, `telephones`) : l'automatique peut-il AJOUTER sans réordonner ? (aujourd'hui la reconstruction ne les touche plus du tout) ; (c) « dernière valeur » (pays, langue) : l'automatique remplace même si rempli, sauf champ manuel ; (d) une seule fonction d'écriture partagée (TypeScript ou SQL) pour éviter 8 copies des règles.

Ensuite : lot 4 (RGPD + Admin : effacer, exporter, supprimer son compte + cases newsletter, Confidentialité, vue Admin), lot 5 (ménage : `clients` ne garde que le compte).

## À lire / vérifier avant de commencer

- `ROADMAP.md` section 9d (lots 0-2, « Noté pour le lot 3 »).
- `supabase/fiches_clients_lot1_reconstruction.sql` : règles déjà codées en SQL (réutilisables).
- Relevé des écritures : `grep -rn "from('clients')" app lib` (≈ 24 fichiers restants, liste justifiée au T12 du lot 2).
- Mémoire `feedback_action_serveur_capture_fonction.md` : une aide appelée par une action serveur se définit au niveau du module.
- Piège vu au lot 2 : avant de conclure à un bug de comptage (segment, LTV, liste), vérifier les **fusions** de la boutique (`fusions_crm`) — un contact fusionné disparaît sous la fiche conservée.

## Méthode attendue par Jake

1. Présenter la **checklist T0-TN du lot 3 AVANT de coder**, attendre le feu vert explicite.
2. Code sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
3. SQL un par un, envoyé le plus tôt possible : gros = lien markdown cliquable vers le fichier, petit = dans le chat ; dire où cliquer (SQL Editor → New query → Run) ; vérification dans un onglet séparé. Essayer d'abord sur PGlite (scratchpad) avec de fausses données.
4. Après le lot : tests seuls (journaux Vercel : `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'`), valider ce qui est prouvé à 100 % par le code, reporter dans `ROADMAP.md`, listes « fait / validé » et « reste à tester » avec étapes, noms des boutons. Tests à l'écran : peu de pages, une par façon de faire (Jake préfère un échantillon représentatif à tout tester).
5. Faille trouvée = signalée et bloquée dans le lot.
6. Signal sonore (`(New-Object Media.SoundPlayer 'C:\Windows\Media\Alarm01.wav').PlaySync()`) quand Jake doit revenir.
7. Clôture : `/cloture`.

## Comptes de test

jakeb-test `nicojacob83+test@gmail.com` ; Beatmaker B `contact+test@jakebmusic.com` (2e boutique de `nicojacob83@gmail.com`, sert à l'isolation) ; nic-beat-2809 `nicojacob83+2809a@gmail.com`.

## Règles (inchangées)

- Fonctionnel d'abord, pas d'apparence.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- SQL qui modifie : filtre exact + SELECT de contrôle avant, une transaction ; toute nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role ; `leads` ne s'écrit qu'avec la clé de service.
- Lire `node_modules/next/dist/docs/` avant tout code Next.js.

## Données de test laissées (pas de ménage demandé)

Chez Beatmaker B : fusion nicojacob83@gmail.com → fiche nicojacob83+artiste@, liste « liste tests ». Chez jakeb-test : prénom « Test9 » sur nicojacob83@gmail.com. Le tout part avec le ménage de l'étape 17.
