# Passation — Rang 9f « Tests de sécurité avant l'audit externe » : Lot 0 puis audit Cloudflare par compartiments

Date : 2026-11-19. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Site de test : **https://sonoo.app**. **Remplace `HANDOFF_CLAUDE_SECURITE_9F_2026-11-17.md`** (supprimé ; son contenu utile est repris ici ou dans `ROADMAP.md`).

## État en arrivant

- **Rang 9e** : entièrement terminé, T10 compris (✅ 2026-11-19 : tâches de nuit du 18/11 et 19/11 passées sans erreur). Attention, appris : la colonne « région » des journaux Vercel = point d'ENTRÉE de la requête (planificateur des crons = `iad1`, visiteurs = `cdg1`), PAS la région d'exécution (réglage du projet = Dublin `dub1`, vérifiable par l'en-tête `x-vercel-id`).
- **Rang 9f** : inventaire F1-F20 ✅ (2026-11-17, `docs/securite/inventaire-9f-2026-11-17.md` + bloc « Rang 9f » de `ROADMAP.md`). **Rien n'est codé.**
- **Lot 1 (fichiers et données publiques) : toutes les décisions prises le 2026-11-18** + checklist T0-T16 (bloc « Rang 9f » de `ROADMAP.md`). Le code attend le `/gocode`, APRÈS le Lot 0 et l'audit des compartiments 1 à 7.
- **Liste de conseils Instagram de Jake** (53 points) triée et décidée point par point (P1-P12, bloc « Rang 9f »).
- Refonte UX/UI (rang 10) : toujours en attente du brand style guide définitif. Ne pas la commencer.

## Intention de Jake (à ne pas rouvrir)

- Trouver et corriger un maximum de failles AVANT l'entreprise d'audit (« plus on trouve, plus mince est la facture »). Inventaire complet d'abord, corrections groupées par lots ensuite.
- Pas d'urgence (personne d'autre que Jake n'utilise la plateforme, maintenance active), sauf faille qui toucherait de vraies données = signalée et bloquée tout de suite.
- Une boutique = un commerce indépendant. Aucun changement de sécurité pour gagner de la vitesse. Les données de test restent.
- **Règle du 2026-11-18 : toute donnée non affichée explicitement sur la page est cachée ; un MP3 ne s'obtient QUE par achat ou par le free download si le beatmaker l'a activé.**
- **Listes de conseils trouvées en ligne : être très critique**, dire « non » franchement quand un point n'a pas lieu d'être chez Sonoo.
- **Audit : compartimenter pour ne pas exploser les tokens d'un coup, et AUCUNE facture de service** (aucun appel massif à une clé API payante, Vercel, Stripe, Resend, Supabase, R2…).

## Décisions du Lot 1 (résumé ; détail dans `ROADMAP.md`)

1. `beats` et `beatmakers` fermées aux visiteurs ET comptes artistes ; boutique lue sur le serveur (clé de service, colonnes affichées seulement) ; le beatmaker garde sa ligne et ses beats.
2. MP3 tagué aussi dans l'espace privé ; lecteur = lien temporaire préparé avec la page et renouvelé tout seul (jamais de rechargement) ; beats privés = abonnés seulement. Condition : aucune gêne à l'écoute (T5 mesure avant/après). Preuve faite : le MP3 tagué d'une page BeatStars de Jake (flux HLS non chiffré, adresse permanente) se récupère en 2 min.
3. Une adresse Sonoo permanente par document (facture, contrat, avoir) avec contrôle d'accès avant le PDF ; couvre les factures d'abonnement (aujourd'hui sans page). 3 bis : 5 essais d'email ratés par commande → bloqué 1 h.
4. Journal de téléchargement = acheteur seulement (session vendeur / collab / admin prioritaire = jamais enregistré ; cookie `dl_` signé qui dit qui a confirmé). 4 bis : lien signé dans l'email de confirmation ; preuves envoyables à Stripe = appareil qui a payé, compte acheteur, lien signé ; email tapé = accès sans valeur de preuve. Trouvé : « Renvoyer l'email » peut viser l'email de la FICHE (modifiable par le vendeur) → lien signé seulement vers l'email de la commande ou du compte.
5. `myproducer-beats` : adresse publique coupée (réversible), fichiers gardés, supprimé à l'étape 17.

## Tri de la liste Instagram (résumé ; détail dans `ROADMAP.md` et l'inventaire)

P1 interface avant le serveur = gestes sans conséquence seulement, pendant la refonte (noté dans la ligne du rang 10) · P2 Redis non · P3 file de jobs non · P4 plantages du navigateur = petit système maison avant le lancement (pas Sentry) · P5 limites = pare-feu Vercel + compteur Supabase + Radar, pas d'Upstash, écoutes pas prioritaires (compteur non public) · P6 en-têtes simples + CSP en rapport seulement · P7 validation = balayage ciblé au Lot 3 · P8 échappement à l'affichage · P9 vitesse à la mesure (étape 17) · P10 double authentification maintenant (Lot 0) · P11 Skew Protection (Lot 0) · P12 audit Cloudflare par compartiments. Nouveaux points : tables sans RLS (ajouté au T0 du Lot 1), `fichiers.sonoo.app` au lieu de r2.dev (étape 17, DNS + accord), Lot 8 attaque de l'extérieur (Strix, clé d'IA payante, à cadrer).

## Plan, dans l'ordre

1. **Lot 0 — actions de Jake, guidé pas à pas (aucun code)** :
   - Double authentification sur GitHub, Vercel, Supabase, Stripe, GoDaddy, Cloudflare, Google Workspace (`jake@sonoo.app`) ; Resend se connecte par GitHub. Application d'authentification ou passkey. **Codes de secours notés hors de l'ordinateur** (sinon risque de se bloquer soi-même). Un compte à la fois, demander à Jake de dire lesquels l'ont déjà.
   - Skew Protection : Vercel → projet `beatplatform` → Settings → Advanced → Skew Protection. Vérifier d'abord sur l'écran qu'elle n'est pas déjà active et qu'il n'y a pas de surcoût (documentation : incluse dans Pro, à confirmer).
   - Reporter le résultat dans `ROADMAP.md`.
2. **Audit avec la skill officielle Cloudflare `security-audit`, compartiment par compartiment** :
   - Dépôt : `https://github.com/cloudflare/security-audit-skill`, lu en entier le 2026-11-18 au commit `c1c8a8c` (2026-09-14). Re-télécharger dans un dossier isolé du scratchpad, vérifier que le commit n'a pas changé (sinon relire ce qui a changé), puis COPIER `skills/security-audit/` dans `C:\Users\nicoj\.claude\skills\security-audit` (pas l'outil `npx skills`). Une skill ajoutée en cours de session peut n'apparaître qu'à la session suivante : sinon suivre `SKILL.md` et ses fichiers à la main.
   - Mode « full audit », profil `standard` **scopé** (« scoped run » de la skill), plafond **~10-15 agents par compartiment** (`budget` dans `run-metadata.json`), sortie hors du projet : `C:\Users\nicoj\security-audit-skill\beatplatform\run-<N>`.
   - Compartiments : (1) paiement et webhooks (`app/api/stripe/**`, `lib/pricing.ts`, `lib/webhook-paiement.ts`, `lib/paiement-multi.ts`, `lib/abonnement-boutique*.ts`, `lib/remboursement.ts`, `lib/litiges.ts`, `app/api/commande-gratuite`, `app/paiement/**`) ; (2) comptes, connexion, domaines (`app/api/artiste/**`, `app/api/inscription/**`, `app/auth/**`, `app/artiste/**`, passage boutique, `proxy.ts`, `lib/maintenance.ts`, domaines et sous-domaines) ; (3) admin (`app/dashboard/admin/**`, `lib/admin*.ts`) ; (4) marketing et emails (`lib/mailing.ts`, `lib/email*.ts`, `lib/emails.ts`, `app/api/cron/**`, désinscription, suivi de clic, webhook Resend, `app/dashboard/business/marketing/**`, `mailing/**`) ; (5) dashboard Business (`app/api/business/**`, `app/dashboard/business/**` hors marketing, imports et exports) ; (6) base SQL (`supabase/*.sql` : fonctions, RLS, déclencheurs) ; (7) boutique publique (`app/[slug]/**`, `app/api/boutique/**`, newsletter publique, favoris) ; (8) fichiers et téléchargements = APRÈS le code du Lot 1.
   - **Règles de sécurité de coût** : lecture du code seule ; ne JAMAIS lancer le code du projet, ni appeler sonoo.app, Stripe, Resend, Supabase, R2, Vercel ou une API payante ; rien installer. Ce qui demande une exécution = « needs_validation », vérifié plus tard par nous avec les précautions habituelles.
   - **Après CHAQUE compartiment** : s'arrêter, retour à Jake (nouveau / déjà dans F1-F20 / rejeté), il décide de continuer (il surveille son abonnement Claude ; atteindre la limite = pause de tout).
3. Fusion des résultats avec F1-F20 et la liste triée, **lots revus** (une décision à la fois si de nouvelles questions apparaissent, notamment sur le Lot 1).
4. **Code du Lot 1** (`/gocode`) : T0 commence par le SQL en lecture seule (règles d'accès réelles de `beats` / `beatmakers`, tables sans RLS, lignes pointant vers `myproducer-beats`).
5. Audit du compartiment 8 (fichiers), puis lots 2 à 7, puis Lot 8 (Strix, à cadrer : boutiques de test seulement, limites, coût de la clé).

## À lire avant de commencer

`CLAUDE.md`, ce fichier, `ROADMAP.md` bloc « Rang 9f » (F1-F5, classement, lots, décisions du Lot 1 + checklist T0-T16, liste triée P1-P12, ordre), `docs/securite/inventaire-9f-2026-11-17.md`, mémoires `project_securite_9f_avant_audit_externe.md`, `feedback_donnees_cachees_sauf_affichees.md`, `feedback_external_prompts_scrutiny.md`, et `git log` récent.

## Méthode attendue

- Code sur `main`, commit + push après chaque changement ; toujours `npx tsc --noEmit -p . && … && git commit`. Jake teste sur sonoo.app.
- SQL un par un : petit = dans le chat, gros = lien cliquable vers le fichier ; dire où cliquer (Supabase → SQL Editor → New query), ce qu'il doit voir, et une vérification dans un onglet séparé. Essayer d'abord sur PGlite.
- Une décision par message, en situation, A/B + recommandation. Actions de Jake en étapes numérotées dans le message final.
- Après chaque lot : tests autonomes (appels directs, dev-browser profil `domaine`, achats visiteur via `jakeb-test.sonoo.app`, journaux Vercel), validation de ce qui est prouvé à 100 % par le code, report dans `ROADMAP.md`, listes « fait / validé » et « reste à tester » (étapes précises, noms des boutons, comment défaire).

## Règles

- Aucun email réel hors liste blanche. Ne jamais lire `.env.local`. Ne jamais contourner un refus du système.
- Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord de Jake.
- Ne jamais réintroduire de donnée CRM ou de coordonnée de paiement dans `clients`.
- Les données de test restent jusqu'à l'étape 17.

## Ménage signalé

- Fichier de démonstration BeatStars récupéré le 2026-11-18 (`Ensemble-beatstars-recupere.ts`, beat de Jake) dans le scratchpad de la session précédente : temporaire, disparaît avec le scratchpad ; Jake n'a pas demandé de le garder.
- Données de test du 9e et du préremplissage : voir `ROADMAP.md` (étape 17).
