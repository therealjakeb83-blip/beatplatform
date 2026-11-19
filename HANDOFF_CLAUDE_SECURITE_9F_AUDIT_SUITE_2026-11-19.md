# Passation — Rang 9f : suite de l'audit `security-audit` par compartiments (après les compartiments 1 à 4)

Date : 2026-11-19 (après-midi). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. **Remplace `HANDOFF_CLAUDE_SECURITE_9F_LOT0_AUDIT_2026-11-19.md`** (supprimé : Lot 0 clos, audit lancé). La passation Codex `HANDOFF_CODEX_SECURITE_9F_AUDIT_COMPARTIMENTS_2026-11-19.md` reste valable pour Codex.

## État en arrivant
- **Lot 0 ✅ CLOS** : double authentification (Microsoft Authenticator, sauvegarde iCloud, codes de secours sur papier) sur GitHub, Vercel, Supabase, Stripe, Cloudflare (mot de passe créé, connexion GitHub gardée), GoDaddy, Google `jake@sonoo.app`, Gmail `therealjakeb83` ; adresses de secours toutes protégées. Skew Protection déjà active (12 h).
- **Audit `security-audit` (skill officielle Cloudflare, commit `c1c8a8c`, installée dans `C:\Users\nicoj\.claude\skills\security-audit`)**, niveau **quick**, lecture du code seule :
  - compartiment 1 paiement et webhooks — Claude, 14 agents (≈ 1,5 M tokens, ≈ 40 % de la fenêtre de Jake) → `run-1` : C1-C6 + F6-1/F6-3/F7-1/F7-2 confirmés comme pistes ;
  - compartiment 2 comptes / connexion / domaines — Codex → `run-2` : D1-D10 (D3 nouvelle) ;
  - compartiment 3 Admin — Codex → `run-3` : A1-A5 (A3 nouvelle) ;
  - compartiment 4 Marketing et emails — Codex → `run-4` : M1-M8 (M5 nouvelle).
  - Rapports : `C:\Users\nicoj\security-audit-skill\beatplatform\run-N\` (`REPORT.md`, `NEEDS-VALIDATION.md`, `findings.json`, `coverage-ledger.json`). Outils : `C:\Users\nicoj\security-audit-skill\outils\` (`valider.cjs` = enveloppe Windows des validateurs, qui refusent sinon de tourner ; scripts de création de liste / consignes du run-1).
- **Relecture par Claude** des passages Codex (détail dans le bloc Rang 9f de `ROADMAP.md`) : D3 exacte mais aggrave seulement C1 ; A3 vérifiée (routes de test en GET sans appelant) ; M5 retenue + **variante free download trouvée par Claude** (lien de confirmation journalisé en clair chez le vendeur, confirmer un free download inscrit toujours à la newsletter). Réserves : passages 3 et 4 sans vérificateur indépendant, liste des zones remplie après lecture.
- **Rien n'est codé.** Toutes les pistes sont « à valider » (aucune exécution permise), jamais « confirmées ».

## Intention de Jake (à ne pas rouvrir)
- Inventaire complet d'abord, corrections groupées par lots ensuite, chacune après son `/gocode`. Pas d'urgence (seul Jake utilise la plateforme, maintenance active), sauf faille touchant de vraies données.
- Niveau **quick** par défaut ; **standard** pour le paiement et les compartiments très sensibles ; peut-être un standard sur toute la plateforme avant le lancement.
- Un compartiment à la fois, arrêt et retour à Jake après chacun ; il surveille sa consommation de tokens (Claude ou Codex selon sa jauge).
- Toute donnée non affichée est cachée ; un MP3 ne s'obtient que par achat ou free download. Être très critique avec les conseils trouvés en ligne. Une boutique = un commerce indépendant.

## Plan
1. **Compartiment 5 — dashboard Business** (`app/api/business/**`, `app/dashboard/business/**` hors marketing, imports et exports) : sur décision de Jake, par Claude ou Codex (prompt de Codex : `run-4\PROMPT_REDEMARRAGE_COMPARTIMENT_5.md`). Sortie `run-5`, jamais écraser un run existant.
2. Compartiment 6 (base SQL), 7 (boutique publique). 8 (fichiers) APRÈS le code du Lot 1.
3. Repasser en **standard** le paiement (et les comptes, compartiment très sensible) quand Jake le décide.
4. **Fusion** de toutes les pistes (F1-F20, C1-C6, D1-D10, A1-A5, M1-M8) et lots revus (une décision à la fois), puis code du Lot 1 (`/gocode`).
5. Validation réelle des pistes graves (C1, C2, D3, M5…) seulement dans un environnement isolé avec données factices, jamais sur sonoo.app.

## Reports à ne pas oublier
Course balayage multi-vendeurs / payer (run-1) ; cookie d'abonné → annuler/reprendre/portail (repris en D3) ; courses brancher/retirer/vérifier des domaines (run-2) ; cohérence suspension/réactivation après erreur partielle (run-3) ; désinscription pendant un lot déjà préparé (run-4).

## Règles
- Lecture du code seule pour l'audit : aucun `npm`/`npx`/`next`/`tsc`, aucun appel au site ni aux services, rien installé, jamais `.env`/`.env.local`. Seul `node` permis : `outils\valider.cjs`.
- Aucun email réel hors liste blanche. Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- Dashboard Stripe sur le PC de Jake : Qustodio relit le HTTPS ; liste blanche + Ctrl + F5, sinon iPhone (Safari). Ne jamais proposer de contourner ni désactiver Qustodio.
- Scripts de réglage Stripe en mode réel = clé limitée (étape 17).
