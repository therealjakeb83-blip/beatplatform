# Passation — Rang 9f : code du Lot 1 (fichiers et données publiques)

Date : 2026-11-19 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. **Remplace** `HANDOFF_CLAUDE_SECURITE_9F_AUDIT_C6_2026-11-19.md`, `HANDOFF_CLAUDE_SECURITE_9F_APRES_C7_2026-11-19.md`, `HANDOFF_CODEX_SECURITE_9F_AUDIT_C6_2026-11-19.md` et `HANDOFF_CODEX_SECURITE_9F_AUDIT_COMPARTIMENTS_2026-11-19.md` (supprimés : audit 1-7 et fusion terminés).

## État en arrivant
- **Lot 0 ✅.** **Audit `security-audit` compartiments 1 à 7 ✅** (quick, lecture du code seule ; rapports `C:\Users\nicoj\security-audit-skill\beatplatform\run-1` à `run-7`, `run-6-relecture-claude`, `relecture-rejets-c3-c4-2026-11-19`). Bilan : `docs/securite/bilan-9f-compartiments-1-7-2026-11-19.md`.
- **Fusion des pistes ✅** : `docs/securite/fusion-9f-2026-11-19.md` (liste unique, lots, décisions 1-5). **Rien n'est codé.**
- Validations en base faites par Jake le 2026-11-19 : politique `templates_email` conforme, verrou `beatmakers_verrou_colonnes` actif (protège `role`), `UNSUBSCRIBE_SECRET` et `RESEND_WEBHOOK_SECRET` présents sur Vercel.
- Requêtes de lecture préparées, **pas encore exécutées** : `run-6\01-tables.sql` à `04-rls-global.sql`, `run-7\01-lecture-publique.sql`, `run-7\02-newsletter.sql` (mode d'emploi dans leur `REQUETES.md`). Elles servent au **T0** du Lot 1 et au Lot 1 bis.

## Intention de Jake (à ne pas rouvrir)
- **Une session par lot.** Code seulement après `/gocode` (`.claude/commands/gocode.md`).
- Règle générale : **toute donnée non affichée explicitement est cachée ; un fichier (MP3 compris) ne s'obtient que par achat ou par le free download activé.**
- Décisions du Lot 1 (2026-11-18) : 1 A (beats / beatmakers fermées, lecture serveur des colonnes affichées), 2 A (MP3 tagué privé, lien temporaire renouvelé tout seul, aucune gêne à l'écoute), 3 A + 3 bis (adresse Sonoo par document qui vérifie l'accès ; 5 essais ratés → 1 h), 4 A + 4 bis (journal = acheteur seulement ; preuves Stripe = appareil qui a payé, compte acheteur, lien signé de l'email ; email tapé jamais envoyé comme preuve), 5 A (`myproducer-beats` : adresse publique coupée, fichiers gardés). Détail : bloc « Rang 9f » de `ROADMAP.md`.
- **Ajouts de la fusion (2026-11-19)** : P2 (favori ancien qui garde l'audio d'un beat devenu privé / masqué / vendu), P3 (beat public à date future visible sur sa fiche et dans les suggestions), S4 (journal de téléchargement écrivable directement en base par un compte connecté : retirer INSERT à `authenticated`, les écritures légitimes passent déjà par la clé de service). Tests **T17-T19**.
- Ordre ensuite : **Lot 1 bis** (verrous d'écriture en base : S10, B1/S1, S2/S3, S7, B6, B8, droits techniques) → audit **compartiment 8** (fichiers) seulement après le code ET la validation du Lot 1 → Lots 2 à 7.
- Règle « Brevo » (newsletter, hors Lot 1) : vendeur libre de réinscrire avec avertissement ; formulaire public en un clic ; protections Lot 7.

## Première étape attendue
1. Lire : `CLAUDE.md`, cette passation, dans `ROADMAP.md` le bloc « Rang 9f » (décisions du Lot 1 + checklist T0-T19 + fusion), `docs/securite/fusion-9f-2026-11-19.md` (section Lot 1), `docs/securite/inventaire-9f-2026-11-17.md` (F1, F2a, F9, F19C), la mémoire `project_securite_9f_avant_audit_externe.md`, `git log` récent.
2. Présenter à Jake le plan de code du Lot 1 et la checklist T0-T19 (déjà écrite, à rappeler en langage simple), puis attendre `/gocode`.
3. Au `/gocode` : commencer par le **T0** (relevé en lecture seule : `run-6\01-tables.sql` et `04-rls-global.sql` couvrent beats / beatmakers / licence_downloads + tables sans RLS ; ajouter les lignes qui pointent encore vers `myproducer-beats`), SQL le plus tôt possible, actions Cloudflare / Vercel de Jake guidées pas à pas (T1).

## Méthode
- Code sur `main`, `tsc && … && git commit` puis push après chaque changement ; Jake teste sur sonoo.app.
- SQL un par un, essayé d'abord sur PGlite ; gros = lien cliquable vers le fichier, petit = dans le chat ; où cliquer ; vérification dans un onglet séparé ; toujours un SQL inverse pour défaire.
- Après le lot : tests autonomes (dev-browser profil `domaine` = session jakeb-test + Admin), validation de ce qui est prouvé à 100 % par le code, report dans `ROADMAP.md`, listes « fait / validé » et « reste à tester » avec étapes précises, noms des boutons et comment défaire. Faille trouvée = signalée et bloquée dans le lot. Fonctionnel, pas l'apparence.
- Le déménagement des fichiers (T3) est lancé par Jake, d'abord à blanc avec décompte.

## Règles
- Aucun email réel hors liste blanche (`lib/email-liste-blanche.ts`). Ne jamais lire `.env.local` (scripts via le terminal de Jake). Ne jamais contourner un refus du système.
- Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord de Jake.
- Dashboard Stripe sur le PC de Jake : Qustodio, vérifier par script/API ou iPhone ; ne jamais proposer de le contourner.

## Ménage / reports signalés
- Petites corrections hors sécurité : campagnes planifiées sur segment / liste probablement envoyées à zéro destinataire (`lib/mailing.ts:30,43`, client clé publique sans session dans le cron) ; groupe « newsletter » (retrait du blocage vendeur + avertissement, B5, bienvenue avec désinscription, case newsletter du free download).
- Reports pour le passage « standard » : courses run-1/run-2, erreurs partielles run-3, désinscription pendant un lot préparé run-4, listes collaborateur run-5, historiques juridiques run-6, deux différés run-7.
