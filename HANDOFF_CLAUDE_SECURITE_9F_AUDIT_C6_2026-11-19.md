# Passation — Rang 9f : audit `security-audit` par compartiments, suite au compartiment 6 (base SQL)

Date : 2026-11-19 (fin d'après-midi). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. **Remplace `HANDOFF_CLAUDE_SECURITE_9F_AUDIT_SUITE_2026-11-19.md`** (supprimé : compartiment 5 fait). La passation Codex `HANDOFF_CODEX_SECURITE_9F_AUDIT_COMPARTIMENTS_2026-11-19.md` reste valable si Jake repasse sur Codex.

## État en arrivant
- **Lot 0 ✅ CLOS** (double authentification sur 8 comptes, Skew Protection déjà active).
- **Audit `security-audit`** (skill officielle Cloudflare, commit `c1c8a8c`, copie dans `C:\Users\nicoj\.claude\skills\security-audit`), niveau quick, lecture du code seule. Rapports : `C:\Users\nicoj\security-audit-skill\beatplatform\run-N\`.
  - 1 paiement — Claude, 14 agents → run-1 (C1-C6) ;
  - 2 comptes, 3 Admin, 4 Marketing — Codex → run-2 à run-4 (D1-D10, A1-A5, M1-M8), relus par Claude ;
  - **5 Business, imports, exports — Claude, 10 agents / 13 → run-5** : 9 pistes, 8 à valider, 1 rejetée. Les plus importantes : **B1** (`beat_splits` : politique RLS « FOR ALL » du propriétaire + droit d'écriture `authenticated` → collaboration « active » forgée au nom d'un autre vendeur prêt à vendre), **B3-B5** (consentement newsletter : un « désinscrit » effaçable par la boutique — effacement, désinscription vendeur, inscription groupée qui ignore `efface_le`), **B6** (`nb_clients_crees` renvoyé par l'import = existence d'un email ailleurs sur Sonoo). Aussi B2 (invitation acceptée sans email confirmé), B7 (import libre : mémoire lignes × colonnes), B8 (source marketing visible du collaborateur). Détail : bloc Rang 9f de `ROADMAP.md` et `run-5\REPORT.md`.
- **Rien n'est codé.** Toutes les pistes sont « à valider », jamais « confirmées ».

## Intention de Jake (à ne pas rouvrir)
- Inventaire complet d'abord, corrections groupées par lots ensuite, chacune après son `/gocode`. Pas d'urgence sauf vraie donnée touchée (seul Jake utilise la plateforme, maintenance active).
- Quick par défaut ; standard pour le paiement et les compartiments très sensibles (comptes) ; peut-être un standard global avant le lancement.
- Un compartiment à la fois, arrêt et retour à Jake après chacun ; Jake surveille ses jetons (Claude ou Codex selon sa jauge).
- Une boutique = un commerce indépendant ; tout ce qui n'est pas affiché est caché ; un MP3 ne s'obtient que par achat ou free download. Très critique avec les conseils trouvés en ligne.
- **Décision du 2026-11-19 (A)** : pas de reprise complète des passages Codex 3 et 4. Juste avant la fusion des pistes, petite vérification à froid par 2-3 agents de ses rejets (A2, A4, A5, M6, M7, M8) + recherche des trous évidents.

## Plan
1. **Compartiment 6 — base SQL** (`supabase/*.sql` : politiques RLS, droits `GRANT`, fonctions `SECURITY DEFINER`, déclencheurs) : sur décision de Jake, par Claude (quick, plafond ~14 agents) ou Codex. Sortie **run-6** (vérifier qu'il n'existe pas ; jamais écraser). **À reprendre dedans** : le motif de B1 (politique FOR ALL + écriture `authenticated` alors que l'appli écrit avec la clé de service) sur TOUTES les tables ; les RPC qui ignorent `efface_le` (B5) ; `listes_crm_contacts` qui n'exige pas un client de la boutique (durcissement run-5) ; RPC analytics réservées à service_role. Rappel : les SQL sont posés à la main dans Supabase, le dépôt peut différer de la base → `needs_validation` + requête de lecture seule pour Jake.
2. Compartiment 7 (boutique publique, `app/[slug]/**`, `app/api/boutique/**`, newsletter publique, favoris) — inclure : sous-domaines `*.sonoo.app` comme origine « même site » (CSRF des routes Business, unité bloquée du run-5) et lecteurs du statut newsletter qui ignorent `efface_le`.
3. Relecture à froid des rejets Codex 3-4 (décision A).
4. Fusion de toutes les pistes (F1-F20, C, D, A, M, B) et lots revus (une décision à la fois), puis code du Lot 1 (`/gocode`), puis compartiment 8 (fichiers : y ajouter les adresses de fichiers des beats acceptées telles quelles, run-5).
5. Repasser en standard paiement + comptes quand Jake le décide. Validation réelle des pistes graves seulement dans un environnement isolé avec données factices, jamais sur sonoo.app.

## Reports à ne pas oublier
Course balayage multi-vendeurs / payer (run-1) ; courses brancher/retirer/vérifier des domaines (run-2) ; cohérence suspension/réactivation après erreur partielle (run-3) ; désinscription pendant un lot déjà préparé (run-4) ; **pages de listes Commandes / Abonnements / Litiges côté collaborateur (nom de l'acheteur lu sur la commande de l'autre boutique sans passer par la fiche, run-5, différé)**.

## Méthode éprouvée (run-5)
- Repérage par le parent (lecture directe) au lieu de 4 agents de reconnaissance, pour économiser les jetons : écart à signaler dans le rapport.
- Scripts du parent en **PowerShell** dans le scratchpad (Jake : « seul node permis = `valider.cjs` »). Pièges : `R` et `FL` sont des alias PowerShell (Invoke-History, Format-List) → nommer les fonctions autrement (`Get-SkLines`…). `[uri]::EscapeDataString` donne l'encodage RFC 3986 exigé pour `coverage_id` ; trier en ordinal (`[string]::CompareOrdinal`) ; `ConvertTo-Json -Depth 20`, UTF-8 sans BOM.
- 6 chasseurs (2 zones chacun), 1 critique finale, vérificateurs regroupés par thème qui n'ont pas chassé ce qu'ils vérifient. Résultats intermédiaires gardés dans le scratchpad (`rec-v*.json`, `wave1-results.json`) puis assemblés.
- Coût run-5 ≈ 1,2 M de jetons de sous-agents pour 10 agents.

## Règles
- Lecture du code seule pour l'audit : aucun `npm`/`npx`/`next`/`tsc`, aucun appel au site ni aux services, rien installé, jamais `.env`/`.env.local`. Seul `node` permis : `outils\valider.cjs`.
- Aucun email réel hors liste blanche. Ne toucher ni au WordPress, ni aux emails jakebmusic.com, ni aux mentions Sonoo. Aucun changement DNS sans relevé avant/après et accord.
- Dashboard Stripe sur le PC de Jake : Qustodio relit le HTTPS ; liste blanche + Ctrl + F5, sinon iPhone (Safari). Ne jamais proposer de contourner Qustodio.
- Commit + push sans hooks pour les commits documentaires de l'audit (le projet n'a aucun hook actif).
