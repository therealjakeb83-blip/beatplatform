# Passation — Rang 9c bis, lot 3 : slug figé, anciens noms, Admin

Date : 2026-11-12 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_SOUS_DOMAINES_LOT2_2026-11-12.md`.

## État en arrivant

- **Lots 1 et 2 ✅ CLOS le 2026-11-12.** Les boutiques vivent sur `slug.sonoo.app` :
  - DNS de sonoo.app gardé chez GoDaddy, 21 lignes, dont 3 ajoutées au lot 2 :
    - 2 lignes `NS _acme-challenge` → `ns1.vercel-dns.com` / `ns2.vercel-dns.com` ;
    - 1 ligne `CNAME *` → `cname.vercel-dns-0.com`.
  - Chez Vercel : `*.sonoo.app` est sur le projet `beatplatform` (Production) et la zone Vercel DNS de sonoo.app est active (sans changer les serveurs DNS). Le certificat `*.sonoo.app` est émis et se renouvelle seul.
  - L'interrupteur `SOUS_DOMAINES_OUVERTS = true` (`lib/constantes.ts`) fait que `sonoo.app/slug/...` renvoie en 307 vers `slug.sonoo.app/...`, paramètres gardés.
  - `sousDomainePossible` (`lib/slug-regles.ts`) laisse sur sonoo.app/slug tout slug mal formé (> 63 caractères, accent, tiret en tête) ou réservé.
- Les 7 décisions de l'étude ne se rouvrent pas : `ROADMAP.md`, section « Détail — Boutiques en sous-domaine », et la mémoire `project_sous_domaines_9cbis_etude_2026_11_12.md`.
- Limites connues, acceptées :
  - deux niveaux (`a.slug.sonoo.app`) donnent une erreur de certificat ;
  - `www.sonoo.app/slug` passe par 2 renvois ;
  - le sommaire `sonoo.app/sitemap.xml` reste 1 h en cache chez Vercel.
- Noté hors lot (apparence) : la pastille « MP » (ancien nom) en haut des pages artiste connexion / inscription / nouveau mot de passe, à remplacer avec la charte.

## Lot 3 à faire (décisions 4 et 4 bis)

1. **Choix unique du slug** : le beatmaker remplace UNE fois le slug automatique `nom-xxxxxxxx`.
   - Avertissement, puis le slug est à retaper (« tape lilbeat »).
   - Ensuite le slug est figé, avec le message « Une erreur ? Contacte le support ».
2. **Table des anciens noms** : tout ancien slug CHOISI renvoie pour toujours vers le nouveau, et personne d'autre ne peut le prendre.
   - La table est vérifiée au moment du choix d'un slug.
   - Le slug automatique n'est jamais gardé.
3. **Admin** : Jake seul change un slug ou libère un ancien nom.
4. **Slug automatique nettoyé** : le trigger `supabase/fix_trigger_role.sql` ne retire ni accents ni tirets doublés ou en tête, et n'a pas de longueur maximale. Il faut ensuite un SQL de contrôle des slugs existants.
5. Le changement de slug touche maintenant aussi l'adresse `slug.sonoo.app`. Il faut vérifier les renvois depuis l'ancien sous-domaine, ainsi que les liens dans les emails déjà envoyés.

Présenter la checklist T0-TN à Jake AVANT de coder.

## Outils et pièges (lot 2)

- **Relevé DNS** : `node .scratch/9cbis-lot2-releve-dns.mjs <sortie.json> [comparer-avec.json]`, interrogé directement chez ns67. Le relevé de référence est `.scratch/9cbis-lot2-dns-apres.json`.
  - Le `nslookup` de Windows ajoute « .home » aux noms : utiliser Node `dns.Resolver`, ou un point final (`_acme-challenge.sonoo.app.`).
- **Tests en ligne avec le certificat** : `node .scratch/9cbis-lot2-https.mjs hote/chemin ...`.
- **Tests locaux** : `npm run dev`, puis `.scratch/9cbis-lot2-local.mjs` (faux en-tête Host).
  - Relancer le serveur après toute modification de `proxy.ts`.
  - À la fin, arrêter le serveur orphelin : `netstat -ano | grep :3000`, puis `taskkill //PID <pid> //T //F`.
- **Git Bash** transforme `-d chemin=/beats` en chemin Windows : encoder `%2F`.
- **Vrai slug de nic-beat-2809** : `nic-beat-2809-22410af7`.
- **Mises en scène SQL sur jakeb-test10** : fichiers `.scratch/9cbis-lot2-T15-*.sql`. Toujours remettre en état et vérifier en ligne.
- **dev-browser** : le 1er script après un redémarrage du démon bloque. Faire un TaskStop, puis relancer avec `dev-browser --browser <profil> --timeout 110 run script.js`.
- **Comptes de test créés au lot 2**, à nettoyer à l'étape 17 :
  - le compte artiste `nicojacob83+9cbis-insc@` ;
  - la commande `78c3ebdd` (carte, collab) ;
  - la commande Apple Pay de Mélancholia.

## Règles (inchangées)

- Coder sur `main`, commit et push après chaque changement ; Jake teste sur sonoo.app.
- Réglages et SQL un par un, avec où cliquer, et une requête de vérification dans un onglet séparé.
- Aucun changement DNS de sonoo.app sans relevé avant/après et accord explicite de Jake.
- Ne toucher ni au WordPress ni aux emails de jakebmusic.com, ni aux mentions Sonoo.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`.
- Journaux Vercel : CLI en lecture seule.
- Réflexe après chaque lot : tester seul, valider ce qui est prouvé par le code, reporter dans `ROADMAP.md`, puis donner les deux listes « fait / validé » et « reste à tester ».
