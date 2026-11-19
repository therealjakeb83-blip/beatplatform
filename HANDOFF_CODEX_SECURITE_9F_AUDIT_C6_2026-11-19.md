# Passation Claude → Codex — Rang 9f : audit `security-audit`, compartiment 6 (base SQL)

Date : 2026-11-19 (soir). Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Jake (beatmaker, aucune expérience de code, français, tutoiement) passe sur Codex faute de jetons Claude. **Tu ne codes RIEN** : audit en lecture seule, jusqu'au `/gocode` de Jake (qui n'est pas pour ce compartiment).

Ce fichier complète `HANDOFF_CODEX_SECURITE_9F_AUDIT_COMPARTIMENTS_2026-11-19.md` (règles générales Codex, limites, format du retour : toujours valables) et `HANDOFF_CLAUDE_SECURITE_9F_AUDIT_C6_2026-11-19.md` (état, plan, reports, méthode run-5 : à lire en entier).

## À lire avant de commencer
1. `CLAUDE.md` ; `ROADMAP.md`, bloc « Rang 9f » (lots, Lot 1 décidé + T0-T16, P1-P12, Lot 0, audit compartiments 1-5, relecture de Claude et décision A).
2. `docs/securite/inventaire-9f-2026-11-17.md` (F1-F20, pour trier : nouvelle / déjà F.. / rejetée).
3. Les deux passations ci-dessus.
4. `C:\Users\nicoj\security-audit-skill\beatplatform\run-1` à `run-5` : `REPORT.md` (+ `findings.json`, `coverage-ledger.json` de run-5 comme modèle de format). **run-5 surtout** (B1, B5, durcissements).
5. La skill : `C:\Users\nicoj\.claude\skills\security-audit\SKILL.md`, `RECONNAISSANCE.md`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md`, `ATTACK-CLASSES.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`. Ne la modifie pas, ne la réinstalle pas.
6. `git log --oneline -15`.

## État
- Lot 0 ✅ clos. Inventaire F1-F20 fait. Compartiments 1 (paiement, run-1), 2 comptes, 3 admin, 4 marketing (run-2 à run-4, par toi, relus par Claude), 5 Business/imports/exports (run-5, Claude) : faits en quick. **Rien codé**, toutes les pistes « à valider ».
- Pistes run-5 les plus importantes : **B1** `beat_splits` (politique RLS « FOR ALL » du propriétaire + droit d'écriture `authenticated` → collaboration « active » forgée au nom d'un autre vendeur) ; **B3-B5** consentement newsletter (désinscription effaçable, inscription groupée qui ignore `efface_le`) ; **B6** import qui révèle qu'un email existe ailleurs sur Sonoo.

## Mission : compartiment 6 — base SQL (quick)
Périmètre : `supabase/*.sql` (~180 fichiers) — politiques RLS, `GRANT`/`REVOKE`, fonctions `SECURITY DEFINER` (et leur `search_path`), déclencheurs, vues. Croiser avec le code qui les appelle (`lib/supabase*`, `.rpc(`, `.from(` côté client navigateur) seulement pour juger si une écriture `authenticated`/`anon` est atteignable.

À chercher en priorité :
1. **Le motif de B1 sur TOUTES les tables** : politique `FOR ALL` (ou INSERT/UPDATE) du propriétaire + `GRANT INSERT/UPDATE/DELETE … TO authenticated` (ou `anon`), alors que l'appli écrit avec la clé de service → un vendeur connecté peut écrire directement par l'API Supabase des lignes qui touchent un autre vendeur/une autre boutique.
2. **RPC qui ignorent `efface_le`** (motif B5) : contacts effacés réinscrits, comptés, exportés.
3. `listes_crm_contacts` qui n'exige pas un client de la boutique (durcissement run-5).
4. RPC analytics : bien réservées à `service_role` (`REVOKE … FROM public, anon, authenticated`).
5. `SECURITY DEFINER` sans `SET search_path`, ou qui prennent un id de boutique/vendeur en paramètre sans vérifier `auth.uid()`.
6. Tables sans RLS activée, ou RLS activée mais `GRANT` large à `anon`.

**Important** : les SQL sont posés à la main dans Supabase ; le dépôt peut différer de la base. Tout ce qui dépend de l'état réel de la base = `needs_validation` + une **requête SQL de lecture seule** (SELECT sur `pg_policies`, `information_schema.role_table_grants`, `pg_proc`…) que Jake collera lui-même dans l'éditeur SQL Supabase. Ne la lance pas toi-même. Rappel : l'éditeur SQL n'affiche que le dernier résultat → une requête par piste, ou une seule requête qui rassemble tout.

## Règles absolues
- Sortie : `C:\Users\nicoj\security-audit-skill\beatplatform\run-6` — **vérifie qu'il n'existe pas ; ne jamais écraser un run**.
- Lecture du code seule. Aucun appel à sonoo.app, Stripe, Supabase, Resend, R2, Vercel, ni API payante. Rien installé. Code du projet jamais lancé (ni `npm`, `npx`, `next`, `tsc`). Seul `node` permis : `node C:\Users\nicoj\security-audit-skill\outils\valider.cjs ledger|findings <fichier>`. Scripts éventuels en PowerShell (attention : `R` et `FL` sont des alias PowerShell, nommer les fonctions autrement ; JSON en UTF-8 sans BOM, tri ordinal, `[uri]::EscapeDataString` pour `coverage_id`).
- Jamais `.env` / `.env.local`. Aucun email envoyé. Ne pas toucher au WordPress, aux emails jakebmusic.com, aux mentions Sonoo, au DNS.
- Pas d'agents parallèles chez toi : jouer repérage → chasse par zone → contrôle de couverture → vérification à froid (essayer de réfuter chaque piste) ; le noter dans `REPORT.md`.
- Seules écritures permises : `run-6\`, puis à la fin le bloc Rang 9f de `ROADMAP.md` (« compartiment 6 ✅ », pistes S1…Sn) + commit/push `docs(roadmap): audit securite 9f compartiment 6 base SQL (run-6)`.

## Retour à Jake (puis ARRÊT)
En français simple, sans jargon : nombre de pistes ; pour chacune une phrase « ce qu'un malveillant pourrait faire », puis **nouvelle / déjà F.. (ou B.., C.., D.., A.., M..) / rejetée**, et le lot visé (1 à 8). Ce qui n'a pas été fouillé. Les requêtes de lecture seule à coller par Jake (où cliquer : Supabase → SQL Editor → New query → coller → Run ; quel résultat attendu). Puis : « On continue avec le compartiment 7 ? » — et attendre.

## Ensuite (pour mémoire, pas maintenant)
7 boutique publique (inclure sous-domaines `*.sonoo.app` comme origine « même site » et lecteurs du statut newsletter qui ignorent `efface_le`) → relecture à froid des rejets Codex 3-4 (A2, A4, A5, M6, M7, M8 ; décision A) → fusion de toutes les pistes et lots revus (une décision à la fois) → code du Lot 1 après `/gocode` → compartiment 8 fichiers.
