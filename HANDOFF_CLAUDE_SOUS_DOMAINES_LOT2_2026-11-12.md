# Passation — Rang 9c bis, lot 2 : DNS et allumage des sous-domaines `slug.sonoo.app`

Date : 2026-11-12 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. Remplace `HANDOFF_CLAUDE_SOUS_DOMAINES_9CBIS_2026-11-12.md`.

## État en arrivant

- **Étude faite et plan en 3 lots validé par Jake le 2026-11-12.** 7 décisions (à ne pas rouvrir) dans `ROADMAP.md`, section « Détail — Boutiques en sous-domaine `slug.sonoo.app` », et dans la mémoire `project_sous_domaines_9cbis_etude_2026_11_12.md`.
- **Lot 1 ✅ CLOS (T0-T10)**, code `33834e3` :
  - `lib/slug-regles.ts` : 190 mots interdits, refus de tout slug contenant « sonoo », format valide d'adresse internet ;
  - `proxy.ts` : branche `slug.sonoo.app`, même traitement qu'un domaine perso ; mot réservé ou plusieurs niveaux = 404 « Aucune boutique » ; renvoi vers le domaine perso actif ; 503 si la boutique est invisible ;
  - `lib/boutique-du-domaine.ts` : `slugDuSiteBoutique`, `hotePropreDeLaBoutique` ;
  - `lib/adresse-boutique.ts` et `accueilSonoo` (`lib/referencement.ts`) préparés ;
  - page Profil : règles du slug, « monproducer.com/ » remplacé.
- **Interrupteur `SOUS_DOMAINES_OUVERTS = false`** (`lib/constantes.ts`). Il ne commande que les renvois et liens VERS les sous-domaines. L'affichage d'une boutique sur son sous-domaine marche déjà dès que le DNS y mène.
- **En ligne, rien n'a changé** : `jakeb-test.sonoo.app` n'existe pas encore sur internet (pas de ligne DNS). jakeb-test10 est remise en état (passe-droit rendu, aucun faux domaine).

## Ce qu'il faut faire maintenant

1. Présenter à Jake la checklist du lot 2 (T0-T16, déjà écrite dans `ROADMAP.md`) et **attendre son feu vert**.
2. **T0** : relevé DNS complet avant (lecture seule) + capture de la page DNS GoDaddy par Jake (`https://dcc.godaddy.com/control/portfolio/sonoo.app/settings?tab=dns`).
3. **Jake chez Vercel, guidé clic par clic** :
   - projet `beatplatform` → Settings → Domains → ajouter `*.sonoo.app` ;
   - équipe → Domains → sonoo.app → « Enable Vercel DNS », **sans changer les serveurs DNS** chez GoDaddy ;
   - **relire les valeurs exactes que Vercel affiche** avant de les donner à Jake.
4. **Jake chez GoDaddy**, avec son accord explicite juste avant : 3 lignes (2 `NS _acme-challenge` + 1 `CNAME *`). Vérifier à la source : `nslookup -type=NS _acme-challenge.sonoo.app ns67.domaincontrol.com`.
5. Relevé après (T3), puis emails (T4).
6. Seulement quand `https://jakeb-test.sonoo.app` répond avec un certificat valide (T5) : passer `SOUS_DOMAINES_OUVERTS` à `true`, traiter les points « À vérifier au lot 2 » de la ROADMAP, commit + push, tests T6-T16.

## Relevé DNS de sonoo.app (lecture du 2026-11-12, pour comparer)

| Nom | Type | Valeur |
|---|---|---|
| Serveurs | NS | `ns67.domaincontrol.com`, `ns68.domaincontrol.com` (GoDaddy) |
| `@` | A | `216.150.1.1` |
| `www` | CNAME | `a21d5db196248aea.vercel-dns-017.com` |
| `@` | MX | `1 smtp.google.com` |
| `@` | TXT | `google-site-verification=FBNNz1ad6ZxC9w-9l7RwUk5gz-HbvDSYux8602S8Cxs` |
| `@` | TXT | `v=spf1 include:dc-bdaca08905._spfm.sonoo.app ~all` |
| `dc-bdaca08905._spfm` | TXT | `v=spf1 include:_spf.google.com ~all` |
| `google._domainkey` | TXT | DKIM Google |
| `_dmarc` | TXT | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;` |
| `resend._domainkey` | TXT | DKIM Resend (sonoo.app) |
| `resend._domainkey.mail` | TXT | DKIM Resend (mail.sonoo.app) |
| `send` | CNAME | `send.forge.rmta.net` |
| `send.mail` | CNAME | `send.forge.rmta.net` |
| `_acme-challenge` | — | absent |

Un joker `*` ne remplace jamais un nom qui existe déjà. Les emails ne sont donc pas touchés. Il faut pourtant le prouver au T3/T4.

## Règles et méthode (inchangées)

- Coder sur `main`, commit + push après chaque changement ; Jake teste sur sonoo.app.
- Checklist présentée AVANT d'agir. Réglages DNS, Vercel et SQL donnés **un par un**, avec où cliquer. Requête de vérification dans un onglet séparé.
- **Aucun changement DNS de sonoo.app sans relevé avant/après et sans accord explicite de Jake.**
- Ne toucher ni au WordPress ni aux emails de jakebmusic.com, ni aux mentions Sonoo.
- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`. Logs Vercel : CLI en lecture seule (`npx vercel ls`, journaux).
- **Réflexe après chaque lot** : tester seul tout ce qui est possible, valider ce qui est prouvé par le code, reporter dans `ROADMAP.md`, puis donner deux listes « fait / validé » et « reste à tester ».

## Pièges appris (lot 1 et 9c)

- **Serveur local** :
  - `npm run dev` ne recharge PAS `proxy.ts` à chaud : arrêter puis relancer après chaque modification ;
  - arrêter la tâche npm laisse le serveur Next orphelin sur le port 3000 : vérifier avec `netstat -ano | grep :3000`, puis `taskkill //PID <pid> //T //F` (seulement pour un serveur lancé par Claude dans `beatplatform`).
- **Trop de `curl` en série sature Windows** (« fork: Resource temporarily unavailable »). Faire toutes les requêtes depuis un seul script Node avec un faux en-tête `Host` (`http.request({ host: '127.0.0.1', port: 3000, headers: { host: 'jakeb-test.sonoo.app' } })`).
- `sleep` long est bloqué par le harnais : le cache de `proxy.ts` dure 30 s, enchaîner simplement une autre vérification.
- **Mise en scène SQL sur jakeb-test10** :
  - faux domaine : `essai-9cbis-lot1.invalid` ;
  - invisible : `abonnement_exempte = false`, aucun abonnement ;
  - toujours remettre en état et vérifier en ligne.
- **GoDaddy** : lien DNS direct, ne jamais remplir l'assistant « Airo », MODIFIER au crayon plutôt que doubler une ligne, renommer si une suppression est refusée (mémoire `reference_godaddy_dns_pieges.md`).
- **Vercel** : un domaine fraîchement branché passe quelques minutes en « certificat en cours ».
- **Page de Jake périmée** après un déploiement : Ctrl+F5 avant de chercher un bug.
