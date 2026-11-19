# Passation Claude → Codex — Rang 9f : audit Cloudflare `security-audit`, compartiments 2 à 7

Date : 2026-11-19. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Jake (beatmaker, aucune expérience de code, parle français, tutoiement) passe sur Codex pendant que ses tokens Claude se rechargent. **Tu ne codes RIEN** : c'est un audit en lecture seule.

## À lire d'abord
1. `CLAUDE.md` (paragraphe rang 9f) et `ROADMAP.md`, bloc « Rang 9f » : inventaire F1-F20, lots, Lot 0 ✅, « Audit Cloudflare — compartiment 1 ✅ » (pistes C1-C6).
2. `docs/securite/inventaire-9f-2026-11-17.md` (F1-F20, pour trier tes résultats : nouveau / déjà connu / rejeté).
3. La skill : `C:\Users\nicoj\.claude\skills\security-audit\SKILL.md` puis `RECONNAISSANCE.md`, `HUNTING.md`, `VALIDATION-AND-REPORTING.md`, `ATTACK-CLASSES.md` et les compagnons utiles (`WEB-PROTOCOL-AND-AUTH.md`, `DATA-ISOLATION-AND-LIFECYCLE.md`, `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`, `PROTOCOLS-RPC-AND-MESSAGING.md`, `CLIENT-SIDE.md` si une page affiche du HTML). Officielle Cloudflare, commit `c1c8a8c`, déjà lue et vérifiée. Ne la réinstalle pas, ne la modifie pas.
4. Le passage 1 (modèle à suivre) : `C:\Users\nicoj\security-audit-skill\beatplatform\run-1\` (`REPORT.md`, `architecture.md`, `coverage-ledger.json`, `findings.json`).

## Décisions de Jake (à ne pas rouvrir)
- Inventaire complet d'abord, corrections groupées par lots ensuite, chacune après son `/gocode`. Pas d'urgence (seul Jake utilise la plateforme, maintenance active), sauf faille qui toucherait de VRAIES données : la signaler tout de suite.
- Niveau **« quick »** par défaut. **« standard »** pour le paiement (déjà fait en quick, à repasser en standard plus tard) et les compartiments très sensibles. Peut-être un standard sur toute la plateforme avant le lancement.
- **Un compartiment à la fois, arrêt après chacun** : retour à Jake, qui décide de continuer.
- Règle générale : toute donnée non affichée sur une page est cachée ; un MP3 ne s'obtient que par achat ou free download.

## Règles de sécurité de coût (absolues)
- **Lecture du code seule.** Ne lance JAMAIS le code du projet (ni `npm`, `npx`, `next`, `tsc`, ni les scripts du projet). Aucun appel à sonoo.app, Stripe, Supabase, Resend, R2, Vercel ou à une API payante. Rien installé. Ne lis jamais `.env` ni `.env.local`.
- Lance Codex en mode **lecture seule** (sandbox read-only / approbation demandée) si possible.
- Ce qui demande une exécution devient `needs_validation`, jamais `confirmed`.
- Seule écriture permise : le dossier de sortie `C:\Users\nicoj\security-audit-skill\beatplatform\run-<N>` (hors du projet), et à la fin une entrée dans `ROADMAP.md` (bloc Rang 9f) + commit/push (`docs(roadmap): …`).

## Différences avec Claude (limites, à dire à Jake)
1. **Pas d'agents en parallèle** chez toi, a priori : joue les phases l'une après l'autre (repérage → chasse par zone → contrôle de couverture → vérification). Pour respecter l'esprit « vérificateur indépendant », relis chaque piste à froid en essayant de la réfuter. Indique dans le `REPORT.md` que la vérification n'était pas faite par un agent distinct ; Claude pourra la refaire.
2. **Validateurs de la skill bloqués sous Windows** (ils exigent `O_NOFOLLOW`). Utilise l'enveloppe `C:\Users\nicoj\security-audit-skill\outils\valider.cjs` : `node C:\Users\nicoj\security-audit-skill\outils\valider.cjs ledger <run>\coverage-ledger.json` et `… findings <run>\findings.json`. C'est le seul `node` autorisé : outil de l'audit, pas le code du projet. Les autres scripts de `outils\` (création de la liste, consignes) sont des exemples du passage 1.
3. Les identifiants de zone (`coverage_id`) suivent l'encodage décrit dans `RECONNAISSANCE.md` ; `seed-ledger.cjs` montre comment.

## Compartiments restants (ordre)
2. **Comptes, connexion, domaines** — `app/api/artiste/**`, `app/api/inscription/**`, `app/auth/**`, `app/artiste/**` (dont `nouveau-mot-de-passe`), passage boutique, `proxy.ts`, `lib/maintenance.ts`, `lib/compte-artiste.ts`, `lib/lier-compte-client.ts`, `lib/cookie-abonne.ts`, domaines et sous-domaines (`lib/domaine*.ts`, `lib/slug*.ts`, `lib/boutique-du-domaine.ts`). **Reprendre** : la zone hors compartiment du passage 1 (consommation du lien de récupération émis par `api/stripe/abonnement/succes`, piste C1) et F14a/F20a (jeton vers domaine perso).
3. Admin — `app/dashboard/admin/**`, `lib/admin*.ts` (reprendre `lib/admin-recherche.ts` `.or()`).
4. Marketing et emails — `lib/mailing.ts`, `lib/email*.ts`, `lib/emails.ts`, `app/api/cron/**`, désinscription, suivi de clic, webhook Resend, `app/dashboard/business/marketing/**`, `mailing/**`.
5. Dashboard Business — `app/api/business/**`, `app/dashboard/business/**` hors marketing, imports et exports.
6. Base SQL — `supabase/*.sql` (fonctions, RLS, déclencheurs).
7. Boutique publique — `app/[slug]/**`, `app/api/boutique/**`, newsletter publique, favoris.
(8. Fichiers et téléchargements : APRÈS le code du Lot 1, pas maintenant.)

## Retour à Jake après chaque compartiment (en français simple)
Nombre de pistes ; pour chacune, en une phrase : ce qu'un malveillant pourrait faire, puis « nouvelle » / « déjà F.. » / « rejetée », et le lot visé (1 à 8). Précise ce qui n'a pas été fouillé. Pas de jargon. Puis : « On continue avec le compartiment suivant ? »
