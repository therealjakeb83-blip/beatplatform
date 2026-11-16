# Passation — Chantier « Préremplissage du paiement » : cadrage

Date : 2026-11-16 (nuit). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT5_2026-11-16.md` (lot 5 fait, rang 9d terminé).

## État en arrivant

- **Rang 9d (fiches clients confidentielles) ✅ TERMINÉ** (lots 0 à 5). Le détail est dans `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ». Mémoire : `project_fiches_clients_9d_grillme_2026_11_12.md`.
- **Lot 5 (ménage), fait le 2026-11-16** :
  - La table `clients` ne garde QUE le compte Sonoo : `id, email, nom, prenom, created_at, fusionne_dans, fusionne_le, supprime_le`. Les 20 colonnes CRM ont été retirées. SQL : `supabase/fiches_clients_lot5_menage.sql`.
  - Une ligne sans connexion (achat, free download, newsletter ou import sans compte) = email seul (`nom` = '', `prenom` NULL).
  - `resoudreOuCreerClient(supabase, email)` (`lib/webhook-paiement.ts`) ne recopie plus rien du paiement.
  - `reconstruire_fiches_boutique` n'existe plus.
- **Aujourd'hui, rien n'est prérempli au paiement**, sauf l'email d'un client connecté. C'est vérifié dans `app/paiement/[slug]/_components/PaiementClient.tsx` : `CHAMPS_VIDES`, et seul `clientEmail` est passé par `page.tsx`.

## Intention de Jake (à ne pas rouvrir)

Une boutique = un commerce indépendant, comme Shopify. Pour les fiches des boutiques, Sonoo est sous-traitant ; pour le compte Sonoo, Sonoo est responsable.

**Règle posée par Jake le 2026-11-16** :
1. **Rachat dans la MÊME boutique = préremplissage**, à partir de la fiche de cette boutique (`leads` : prénom, nom, téléphones, adresses, pays). C'est le modèle Shopify des « adresses enregistrées ».
2. **Achat chez B après un achat chez A = préremplissage SEULEMENT avec consentement explicite.** Une case sur le compte Sonoo, décochée par défaut (modèle Shop Pay). Les infos sont rangées à part sur le compte (Sonoo responsable), jamais tirées des fiches des boutiques. B ne reçoit rien avant que le client ait payé. Les infos sont retirées si la case est décochée ou si le compte est supprimé. Point à faire valider par le juriste (étape 17).

Ordre décidé par Jake : on finit le 9d (fait), puis ce chantier, puis le rang 9e (lenteur du dashboard).

## Ce qu'il faut faire en premier (cadrage)

1. **Relevé dans le code** :
   - tous les formulaires de paiement : `PaiementClient.tsx` (licences + abonnement `?abonnement=1`), `CartExpressPay.tsx`, paiement express et collab (`paiement-multi`), commande gratuite ;
   - d'où viennent les champs, et ce que le serveur connaît du client connecté (`app/paiement/[slug]/page.tsx`).
   - Apple Pay et Google Pay remplissent eux-mêmes : vérifier s'il y a quelque chose à faire.
2. **Points à trancher avec Jake** (une question à la fois, en situation, « comment fait Shopify », A/B + recommandation). Par exemple :
   - quelle adresse proposer quand la fiche en a plusieurs (la première = la plus récente) ;
   - le client peut-il choisir parmi ses adresses ;
   - préremplir aussi la raison sociale et la TVA (aujourd'hui sur la commande seulement, décision checkout 2026-09-16/18) ;
   - où ranger les infos « consentement » côté compte (nouvelle table ? décision technique de Claude) ;
   - comment l'activer (case dans Mon compte, ou proposée après un achat) ;
   - retrait à la suppression du compte ;
   - export ;
   - texte de la page Confidentialité.
3. **Garde-fou** : préremplissage pour un client **connecté** seulement. Le cookie d'abonné (`lib/cookie-abonne.ts`) ne suffit pas pour afficher une adresse : à confirmer pendant le relevé. Sinon, n'importe qui tapant un email verrait l'adresse = faille.
4. Puis présenter la checklist T0-TN. **Ne rien coder avant le feu vert de Jake.**

Estimation donnée à Jake (fourchette, non garantie) : 2 à 4 h (même boutique) + 4 à 6 h (consentement entre boutiques).

## Méthode attendue

- Code sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
- SQL un par un : gros = lien cliquable vers le fichier, petit = dans le chat, où cliquer, vérification dans un onglet séparé. Essayer d'abord sur PGlite. Le harnais du lot 5 se réutilise : `.scratch/9d-lot5-T4-pglite.mjs`, avec le chemin PGlite qu'il contient.
- Après le lot :
  - faire soi-même tous les tests faisables : achat visiteur via `jakeb-test.sonoo.app` (dev-browser, `--browser lot5`), car `test.jakebmusic.com` ne résout plus ; Admin et dashboard jakeb-test via le profil `domaine` ; journaux Vercel (`npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects ...`) ;
  - valider ce qui est prouvé à 100 % par le code ;
  - reporter dans `ROADMAP.md` ;
  - donner deux listes, « fait / validé » et « reste à tester », avec les étapes précises, les noms des boutons et comment défaire.
- Le profil `domaine` est un beatmaker : il ne permet pas de tester Mon compte d'un client. Pour un client connecté, il faudra un compte de test client (ex. `nicojacob83+9d4@`), ou que Jake teste à l'écran.
- Faille trouvée = signalée et bloquée dans le lot. Tester le fonctionnement, pas l'apparence.

## Règles

- Aucun email réel hors liste blanche.
- Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo.
- Aucun changement DNS sans relevé avant/après et sans l'accord de Jake.
- SQL qui modifie = filtre exact + SELECT avant, une transaction.
- Nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role.
- `leads` ne s'écrit qu'avec la clé de service.
- **Ne jamais réintroduire de donnée CRM ou de coordonnée de paiement dans `clients`** : le futur stockage « consentement » est un endroit à part, clairement séparé.
- Une ligne `clients` ne se supprime jamais (anonymisée à la suppression du compte).

## Données de test laissées (ménage à l'étape 17, pas avant)

- Achat visiteur `nicojacob83+9d5achat@gmail.com` chez jakeb-test (commande `94327e3c`, « Paul Lotcinq »).
- Inscription newsletter `nicojacob83+9d5nl@gmail.com` chez jakeb-test.
- Celles des lots précédents (voir `ROADMAP.md`).

## Noté hors chantier

- Dans Contacts, la colonne « 1ère action » affiche « Inscription » pour un contact venu d'un achat. C'est la valeur par défaut, et le comportement existait avant le 9d. À voir à la refonte UX/UI si Jake le souhaite.
- Textes légaux : Jake les retravaillera tous lui-même avant le lancement public (étape 17).
