# Passation — Rang 9d : fiches clients confidentielles par boutique

Date : 2026-11-12 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_SOUS_DOMAINES_LOT3_2026-11-12.md`.

## État en arrivant

- **Rang 9c bis (boutiques en sous-domaine `slug.sonoo.app`) ✅ TERMINÉ le 2026-11-12, lots 1 à 3.**
  - Un slug ne se change QUE par `changerSlugBoutique` (`lib/slug-boutique.ts`, fonction SQL `changer_slug_boutique`) :
    - choix unique du beatmaker dans le Profil (`app/dashboard/profil/ChoixSlug.tsx`, adresse à retaper), puis figé ;
    - ensuite, changement par l'Admin seulement (fiche boutique, bloc « Adresse de la boutique »).
  - Tout ancien slug, automatique compris, va dans `anciens_slugs` et renvoie pour toujours (`proxy.ts`, `renvoiAncienNom`), jusqu'à « Libérer » dans l'Admin.
- **Deux failles bloquées le 2026-11-12** (règle de Jake : « bloquer toutes les failles dès qu'on en trouve une », mémoire `feedback_bloquer_failles_des_trouvees.md`) :
  1. **Verrou en base `beatmakers_verrou_colonnes`** : slug, role, statut, passe-droit, Stripe, numérotation des factures, mandats et libellé bancaire ne s'écrivent qu'avec la clé de service. Jamais `createClient()` pour ces colonnes.
  2. **Fonctions de la base** : toute fonction SECURITY DEFINER est fermée au public (`supabase/securite_fonctions_fermees_2026_11_12.sql`). C'est aussi le droit par défaut en base. Toute nouvelle fonction = `REVOKE public, anon, authenticated` + `GRANT service_role`.
- Données de test laissées :
  - nic-beat-2809 s'appelle `nic-beat-2809` (ancien `nic-beat-2809-22410af7` réservé, qui renvoie vers lui) et garde une tagline « test » ;
  - jakeb-test10 est revenue à son état de départ, avec 3 noms libérés en historique.

## Chantier suivant : rang 9d (BLOQUANT lancement)

**Règle de Jake (2026-11-10), à ne pas rouvrir : il n'existe pas de fiche client uniforme.**

- La fiche d'un même client chez A et chez B peut être 100 % différente : chaque boutique ne voit que ce que le client lui a montré (achats, interactions).
- A ne sait rien d'un client jamais passé chez lui.
- Seul l'admin Sonoo voit tout.
- Le client garde sa page globale `/mon-compte`, accessible à lui seul.

**Écarts vus dans le code, non testés en réel** (`app/dashboard/business/contacts/[id]/page.tsx`) :

1. La fiche charge le client avec `createAdminClient()` sans vérifier qu'il est lié au beatmaker connecté. Un beatmaker qui connaît l'identifiant d'un client voit sa fiche et peut la modifier. Selon la règle « faille = bloquée tout de suite », c'est probablement le premier morceau.
2. `notes`, `tags`, `surnom`, `telephone`, `nom_artiste`, réseaux et `emails_secondaires` sont écrits sur la fiche `clients`, commune à toutes les boutiques.
3. « Définir comme principale » change `clients.email` pour toutes les boutiques.

**À auditer aussi** :

- la liste Contacts (`app/dashboard/business/_lib/contacts.ts`) ;
- les Doublons et la fusion (`fusionner_compte_client`, désormais réservée au serveur) ;
- l'import de commandes externes (coordonnées écrites sur les fiches CRÉÉES par l'import, fiche commune) ;
- l'identité venue du paiement (adresse, pays) ;
- les segments et les listes ;
- les emails et les automatisations qui lisent `clients` ;
- la fermeture de `/mon-compte` ;
- l'Admin (voit tout, voulu).

Ce qui existe déjà par boutique :

- `leads` = relation client ↔ boutique, avec `newsletter_statut` par boutique (lot 1 de l'import, `lib/newsletter.ts`, à ne jamais réintroduire en global) ;
- les commandes portent `beatmaker_id`.

Lire aussi :

- la mémoire `project_failles_avant_lancement_2026_10_20.md` (paragraphes 2026-11-10 et 2026-11-11 : rôles, un beatmaker qui achète chez lui) ;
- `ROADMAP.md`, ligne « 9d » du tableau des rangs.

## Méthode attendue par Jake

1. **Calibrage d'abord, une question à la fois**, avec la méthode « grill-me » : situation + question + choix A/B, en langage simple (mémoire `feedback_reformuler_simplement.md`). Rien n'est codé avant la fin du calibrage. Questions probables :
   - quelles informations appartiennent à chaque boutique ;
   - ce que voit un beatmaker d'un client qui a seulement fait un free download ;
   - le sort des notes et tags existants ;
   - l'email principal ;
   - les doublons et la fusion ;
   - les coordonnées de l'import ;
   - l'Admin.
2. Plan en lots, puis **checklist T0-TN de chaque lot présentée AVANT de coder**, et feu vert explicite de Jake.
3. Coder sur `main`, commit et push après chaque changement. Jake teste sur sonoo.app.
4. SQL un par un :
   - gros SQL = fichier avec **lien markdown cliquable** (`[nom.sql](supabase/nom.sql)`) ;
   - petit SQL = dans le chat ;
   - où cliquer dans Supabase, et requête de vérification dans un onglet séparé ;
   - donnés le plus tôt possible, sans brûler les étapes.
5. Après chaque lot :
   - tester seul tout ce qui est possible (dev-browser, scripts Node, serveur local, journaux Vercel en lecture seule) ;
   - valider ce qui est prouvé à 100 % par le code ;
   - reporter dans `ROADMAP.md` ;
   - donner les deux listes « fait / validé » et « reste à tester ».
6. Toute faille trouvée en route est signalée en une phrase et bloquée dans le lot en cours.

## Règles (inchangées)

- Fonctionnel d'abord, pas d'apparence (la charte Sonoo n'est pas encore là).
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Ne toucher ni au WordPress ni aux emails de jakebmusic.com, ni aux mentions Sonoo.
- Aucun changement DNS de sonoo.app sans relevé avant/après et accord explicite.
- SQL qui modifie : filtre exact + SELECT de contrôle avant, jamais `LIKE 'slug%'`.
- Lire `node_modules/next/dist/docs/` avant tout code Next.js (version différente de la mémoire d'entraînement).
- Fin de session : mettre à jour `ROADMAP.md`, la page « Où on en est » (même URL, mémoire `reference_roadmap_human_friendly.md`), le compteur de temps (`reference_compteur_temps_passe.md`), la mémoire, `C:\Users\nicoj\wiki-brain\log.md`, et préparer la passation suivante.
