# Passation — Rang 9c bis : boutiques en sous-domaine `slug.sonoo.app`

Date : 2026-11-12. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_DOMAINE_PERSO_LOT5_2026-11-11.md`.

## État en arrivant

- **Rang 9c (domaine personnalisé par boutique) ✅ TERMINÉ le 2026-11-12, lots 1 à 5.** Détail, 13 décisions et résultats des 5 checklists : `ROADMAP.md`, section « Détail — Domaine personnalisé par boutique » ; journal des décisions : mémoire `project_domaine_perso_grillme_2026_11_10.md`.
- **Aucun domaine personnalisé branché actuellement** :
  - `test.jakebmusic.com` est retiré ; sa ligne chez GoDaddy est renommée `test-retire` et ne mène nulle part ;
  - testjakeb.com est abandonné (renouvellement coupé, expire le 11 nov. 2027 ; ses lignes A/www/_sonoo pointent encore vers Vercel, sans effet).
- jakeb-test s'affiche donc sur `sonoo.app/jakeb-test`.

## Le chantier 9c bis (décidé par Jake le 2026-11-11)

Chaque boutique sans domaine perso aurait son sous-domaine (`jakeb-test.sonoo.app`) au lieu de `sonoo.app/jakeb-test`, comme Shopify, BeatStars ou Bandcamp. À faire **avant le lancement** : aucune vraie adresse de boutique ne circule encore.

**Première étape = une ÉTUDE, sans coder**, présentée à Jake avec les difficultés, puis plan + checklist T0-TN, puis feu vert. Points à étudier (voir `ROADMAP.md`, ligne « 9c bis » du tableau des priorités) :

1. **Joker `*.sonoo.app` chez Vercel**
   - Vercel exige-t-il que le DNS de sonoo.app soit géré chez Vercel (nameservers) pour un joker avec certificat ?
   - Si oui, il faudrait déplacer le DNS de GoDaddy vers Vercel en recréant tous les enregistrements : MX Google Workspace (`jake@sonoo.app`), Resend (`sonoo.app` et `mail.sonoo.app` : SPF, DKIM, DMARC, MX de retour), vérification Google. Risque direct pour les emails : relevé DNS complet avant/après obligatoire.
   - Vérifier dans la doc Vercel actuelle (« wildcard domains »).
2. **Routage** : `proxy.ts` traite aujourd'hui « tout hôte qui n'est pas la plateforme » comme un domaine perso (`domaines_boutique`). Il faut une branche « sous-domaine de sonoo.app » qui trouve la boutique par son slug, sans ligne en base.
   - Sous-domaines réservés à exclure : `www`, `mail`, `api`, etc.
   - Que faire si un slug ressemble à un mot réservé ?
3. **Domaine perso + sous-domaine** : quelle est l'adresse officielle ? Probablement le domaine perso s'il est actif, sinon le sous-domaine. `lib/adresse-boutique.ts`, la redirection `sonoo.app/slug` → … et les plans de site (`lib/referencement.ts`) sont à adapter.
4. **Session et cookies** : connexion par sous-domaine (comme un domaine perso, déjà géré) ou cookie partagé `.sonoo.app` ? Attention : un cookie partagé exposerait la session sonoo.app (dashboard beatmaker) à toutes les boutiques. Recommandation probable : garder une connexion par adresse, déjà prouvée.
5. **Apple Pay / Google Pay** : déclaration du domaine par sous-domaine sur le compte Stripe du vendeur (`lib/stripe-domaines-paiement.ts`, rattrapage dans `app/api/stripe/contexte-paiement`).
6. **Supabase** : redirections autorisées (`https://*.sonoo.app/**` accepté ? À vérifier), emails « confirme ton compte » / « mot de passe oublié » (lot 3 du 9c : liens vers le site où se trouve le client).
7. **Google OAuth** : le détour par sonoo.app existe déjà (lot 4) ; vérifier que le retour accepte un sous-domaine (aujourd'hui seul un domaine `actif` en base est accepté).
8. **Changement de slug** : un beatmaker peut-il changer son slug ? Si oui, il faut un renvoi de l'ancien sous-domaine.
9. **Maintenance** : la page de maintenance (`lib/maintenance.ts`) ne doit pas fermer les sous-domaines de boutique.
10. **Ce qui est réutilisable du 9c** :
    - `lib/boutique-visible.ts` (règle unique de visibilité, page 503 « indisponible ») ;
    - `lib/boutique-du-domaine.ts` / `siteDeLaPage` ;
    - assistants de liens (`useLienBoutique`, `lienBoutiqueServeur`, `lienPaiement`, `lienConnexionArtiste`) ;
    - laissez-passer `/api/artiste/passage-boutique` ;
    - pages `/artiste/*` qui lisent la boutique sur l'adresse.

## Règles et méthode (inchangées)

- Coder sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
- Plan + checklist T0-TN présentés AVANT de coder.
- **Réflexe après chaque lot** : tester seul tout ce qui est possible (dev-browser, curl, scripts sur le vrai code, serveur local `npm run dev` avec un faux en-tête `Host`), valider ce qui est prouvé par le code, reporter dans `ROADMAP.md`, puis donner à Jake deux listes : « fait / validé » et « reste à tester ».
- SQL et réglages donnés un par un, avec où cliquer. Requête de vérification dans un onglet séparé.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`. Logs Vercel : CLI en lecture seule.
- Ne toucher ni au WordPress ni aux emails de jakebmusic.com ; aucun réglage DNS de sonoo.app sans relevé avant/après et sans accord explicite de Jake.

## Pièges appris au 9c (utiles ici)

- **GoDaddy** :
  - l'assistant « Airo » (start.godaddy.com) n'est pas la page DNS ;
  - « Nouvel enregistrement » ajoute une ligne : il faut MODIFIER au crayon les lignes par défaut ;
  - les suppressions sont souvent refusées : renommer ;
  - le renouvellement auto se coupe dans « Abonnements », en cochant le domaine puis la barre du bas.
- **Vercel** : le service d'un domaine retiré peut s'arrêter tout de suite ou 10 à 20 min plus tard. Un domaine fraîchement branché passe par « certificat en cours » quelques minutes.
- **dev-browser** : après un redémarrage du PC, le premier script se bloque. Lancer d'abord un petit `ping.js` (goto + title).
- **Slugs de test** : les boutiques de test sans abonnement (nic-beat-2809, jakeb-test1…4, nico-beats, test-beat-2809) n'existent plus. jakeb-test5…10 sont exemptées. Une mise en scène « sans abonnement » = SQL sur jakeb-test10 (retirer `abonnement_exempte`), puis le rendre.
