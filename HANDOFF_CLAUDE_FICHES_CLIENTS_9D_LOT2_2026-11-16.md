# Passation — Rang 9d, lot 2 : les écrans lisent la fiche client PAR boutique

Date : 2026-11-16. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_FICHES_CLIENTS_9D_LOT1_2026-11-12.md`.

## État en arrivant

- **Calibrage 9d (10 décisions, 2026-11-12)** : mémoire `project_fiches_clients_9d_grillme_2026_11_12.md` ; `ROADMAP.md`, section « Détail — Fiches clients confidentielles par boutique ».
- **Lot 0 (failles) ✅ CLOS le 2026-11-12.**
- **Lot 1 ✅ CLOS le 2026-11-16 (T0-T10, T8 retiré)** — checklist et résultats dans `ROADMAP.md` :
  - `leads` = la fiche boutique. Colonnes ajoutées : `emails`, `telephones`, `adresses` (accumulés ; 1er email = principal ; adresse = jsonb `{ligne, adresse?, code_postal?, ville?, pays?}`), `prenom`, `nom`, `nom_artiste` (remplis une fois), `pays`, `langue` (dernière valeur), `premier_contact_le` (figé, `source` existait), `notes`, `tags`, `surnom`, `instagram`, `spotify`, `youtube`, `tiktok` (beatmaker seul), `champs_manuels` (noms des champs modifiés à la main = jamais touchés par l'automatique), `reconstruite_le`.
  - Fonction `reconstruire_fiches_boutique(p_ecrire boolean)` (`supabase/fiches_clients_lot1_reconstruction.sql`), **relançable** : cases vides seulement, listes complétées sans rien retirer, jamais un champ de `champs_manuels`, jamais `premier_contact_le` déjà posé. Exécutée : 59 fiches créées (clients liés par commande/abonnement sans fiche, source `achat`), 2 750 complétées.
  - Sources de la reconstruction : commandes de la boutique (`commandes.beatmaker_id` = vendeur principal, donc jamais le collaborateur), abonnements, ventes importées (+ coordonnées de la photo `imports_externes_contacts.snapshot` quand c'est SON import qui a créé le client), ajout manuel ; connexion = email seul ; notes/tags/surnom/nom d'artiste/réseaux/langue/emails secondaires de `clients` recopiés dans chaque boutique liée (décision 7).
  - **Faille 7 fermée** : `leads` était écrivable par `authenticated` (règles `*_own` ne vérifiant que la boutique) → un beatmaker se rattachait n'importe quel client depuis la console et la garde du lot 0 lui ouvrait la fiche. Maintenant : `authenticated` = SELECT de ses lignes seulement (`leads_select_own`), écriture = clé de service seule. L'ajout manuel (`app/api/contacts/route.ts`) passe par la clé de service (`595eef1`).
  - **Les pages lisent encore `clients`** : rien n'a changé à l'écran.

## Intention de Jake (à ne pas rouvrir)

**Une boutique = un commerce = ses propres clients, comme Shopify.** Une fiche client par boutique avec seulement ce que le client a donné ou fait chez elle, plus ce que le beatmaker y note. Une règle par information (accumulés / remplis une fois / dernière valeur / figés / beatmaker seul), et la main du beatmaker gagne. Données de test GARDÉES (décision du 2026-11-16 : elles servent aux tests des lots 2-5 ; ménage à l'étape 17).

## Plan (validé par Jake le 2026-11-12)

| Lot | Contenu |
|---|---|
| 0 ✅ | Failles |
| 1 ✅ | Fondation : `leads` enrichie + reconstruction |
| **2 — à faire** | Lectures : fiche contact (`app/dashboard/business/contacts/[id]/page.tsx` + ses 10 actions, qui ÉCRIVENT aujourd'hui dans `clients` → écrire dans `leads` + `champs_manuels`), liste Contacts (`contacts/page.tsx`), segments et campagnes (`_lib/contacts.ts`, `chargerContactsEnrichis`), listes, doublons/fusion (`fusions_crm` reste virtuelle et interne à la boutique ; emails/adresses de la fiche fusionnée rejoignent les listes accumulées), emails/automatisations (tokens prénom… dans `lib/mailing.ts`, `lib/automatisations.ts`), export newsletter ; masquer les liens vers la fiche d'un acheteur dans les vues d'un collaborateur |
| 3 | Écritures automatiques selon les règles : connexion (`lib/lier-compte-client.ts`), paiement (`resoudreOuCreerClient`, `lib/webhook-paiement.ts`), free download, abonnement (`lib/abonnement-boutique-webhook.ts`), import (`lib/import-externe/`, fonctions SQL `importer_commandes_externes`…), ajout manuel (ferme la faille 5 « existe déjà » ; normaliser le pays en majuscules, aujourd'hui `fr`) |
| 4 | RGPD + Admin : effacer un contact, export, « Supprimer mon compte » + cases newsletter, page Confidentialité de chaque boutique, vue Admin |
| 5 | Ménage : la fiche commune `clients` ne garde que le compte |

**Point d'ordre important** : entre le lot 2 (lectures sur `leads`) et le lot 3 (écritures automatiques dans `leads`), un nouvel achat ne remplit que `clients`. Prévoir dans la checklist du lot 2 : relancer `select reconstruire_fiches_boutique(true);` juste avant la bascule, et/ou enchaîner rapidement le lot 3 (ou faire écrire les deux pendant la transition). À trancher dans la checklist.

## Pour préparer le lot 2

- Lister les lectures de `clients` dans le CRM : `grep -rn "from('clients')" app/dashboard app/api lib` (≈ 34 fichiers) et repérer celles qui affichent des champs de fiche (prénom, nom, téléphone, adresse, notes, tags, réseaux, emails secondaires, pays, langue).
- La fiche contact a des actions « définir comme principal » (email), emails secondaires, identité, notes, tags, réseaux : chacune devient une écriture dans `leads` + ajout du champ dans `champs_manuels`.
- Colonnes de la commande (`acheteur_*`) inchangées : raison sociale / TVA restent sur la commande.
- Une aide appelée par une action serveur se définit au niveau du module, jamais dans la page (mémoire `feedback_action_serveur_capture_fonction.md`).
- Méthode qui a marché au lot 1 : essayer chaque SQL sur PGlite (Postgres en Node, `npm i @electric-sql/pglite@0.2.17` dans le scratchpad) avec de fausses données avant de le donner à Jake.

## Méthode attendue par Jake

1. Présenter la **checklist T0-TN du lot 2 AVANT de coder**, attendre le feu vert explicite.
2. Coder sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
3. SQL un par un, envoyé le plus tôt possible : gros = lien markdown cliquable vers le fichier, petit = dans le chat ; dire où cliquer (SQL Editor → New query → Run) ; vérification dans un onglet séparé.
4. Après le lot : tests seuls (dev-browser, scripts, journaux Vercel en lecture : `npx --yes vercel@latest logs --project beatplatform --scope jake-b-s-projects --since 30m --query 'level:error'`), valider ce qui est prouvé à 100 % par le code, reporter dans `ROADMAP.md`, listes « fait / validé » et « reste à tester » avec étapes, noms des boutons et comment défaire.
5. Faille trouvée = signalée et bloquée dans le lot.
6. Quand Jake attend en faisant autre chose : signal sonore (`(New-Object Media.SoundPlayer 'C:\Windows\Media\Alarm01.wav').PlaySync()` en PowerShell) au moment où il doit revenir.
7. Clôture : commande `/cloture` (`.claude/commands/cloture.md`).

## Règles (inchangées)

- Fonctionnel d'abord, pas d'apparence.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- SQL qui modifie : filtre exact + SELECT de contrôle avant, une transaction ; toute nouvelle fonction SQL = REVOKE public/anon/authenticated + GRANT service_role ; `leads` ne s'écrit qu'avec la clé de service.
- Lire `node_modules/next/dist/docs/` avant tout code Next.js.

## Ménage à faire par Jake (signalé)

- Supprimer la liste « test 9d » (jakeb-test).
- Contact de test « Test Lot1 » (`nicojacob83+9d-lot1@`) : avec les données de test, étape 17.
