# Passation Codex → Claude — Sonoo, rang 9f après le compartiment 7

Date : 2026-11-19. Projet : `C:\Users\nicoj\beatplatform`, branche `main`. Jake parle français, tutoiement, aucune expérience de code. Cette passation actualise la suite de la passation C6, sans supprimer les anciens documents ni leurs règles.

## État fiable à la transmission

- Compartiments **1 à 7 parcourus en quick**, rapports `C:\Users\nicoj\security-audit-skill\beatplatform\run-1` à `run-7`.
- **Rien corrigé. Aucun `/gocode` donné pour les corrections.** Lot 0 clos, Lot 1 décidé mais non codé. Aucun compartiment 8 commencé.
- Bilan global : `docs/securite/bilan-9f-compartiments-1-7-2026-11-19.md`. C'est une synthèse de transmission, **pas la fusion dédupliquée des pistes**.
- Dernier commit publié à la rédaction : `76c4291`, uniquement une entrée au Rang 9f de `ROADMAP.md`, push `origin/main` réussi sans hooks. `2b7beb0` juste avant = contre-relecture Claude du run-6.
- Cette passation et le bilan sont de nouveaux documents locaux ; ne pas les supposer déjà commités/poussés. Vérifier `git status` et `git log` en reprenant.
- Les requêtes SQL run-6/run-7 ont été préparées, **pas exécutées par Codex**. Ne supposer aucun résultat de validation ni aucune nouvelle relecture : lire les documents apparus depuis.

## Lectures de reprise

1. `CLAUDE.md`, `AGENTS.md`, bloc Rang 9f de `ROADMAP.md`, puis le bilan global cité ci-dessus.
2. `docs/securite/inventaire-9f-2026-11-17.md` (F1-F20), passations générales et C6 si nécessaires aux règles.
3. `run-7\REPORT.md`, `findings.json`, `coverage-ledger.json`, `NEEDS-VALIDATION.md`, `COLD-REVIEW.md`, `coverage-critic.json`, `REQUETES.md`, `VALIDATION.md`, `DELIVERY.md`.
4. `run-6-relecture-claude\RELECTURE.md` et rapports run-6/run-5 pour déduplication S/B ; ne jamais modifier ces rapports d'origine.
5. Pour la prochaine relecture : rapports, records et couverture des **run-3/run-4**, puis `C:\Users\nicoj\.claude\skills\security-audit\SKILL.md` et compagnons nécessaires. La skill est déjà installée, pas de réinstallation.
6. Git log récent et état du dépôt ; source courante des chemins retenus, sans présumer qu'un ref documentaire prouve leur absence de changement.

## Ce que le run-7 ajoute

**7 pistes : 5 à valider, 2 rejetées, zéro confirmed, aucune gravité.**

- **P2 nouvelle, Lot 1** : favoris existants relus en clé de service sans réévaluer visibilité ni abonnement ; un beat devenu privé/masqué/vendu/supprimé logiquement peut rester livré au player. Favori conservé et audio non nul requis ; suppression physique en cascade exclue. Conserver le favori après vente est prévu, pas le droit audio.
- **P3 nouvelle, Lot 1** : fiche et suggestions sans filtre de date pour un beat **public avec date future**. Ne pas affirmer que le statut `programme` passe : il est exclu.
- **P1** = F1/F9/S9, projection audio privée sur membres, dépend des droits réels ; **P4** = B5/S5, conséquences publiques de l'inscription groupée d'un effacé, déjà décrites ; **P7** = F19A, null de visibilité, scénario de panne mixte limité par proxy.
- **P5 rejetée de façon limitée** : aucune voie de formulaire/script hostile hébergé sur boutique établie ; même site reste pertinent mais ne suffit pas à une chaîne CSRF. Texte React et images externes ne prouvent pas exécution. Pas de certificat général de sûreté CSRF.
- **P6 rejetée** : changement de sélecteur seul, identité/boutique filtrées. C1/D3/D7/C5 restent distinctes, pas réfutées.
- Différés par la critique : action newsletter après déconnexion/changement compte ; ancien jeton après nouvelle opposition. Aucune seconde chasse, aucune nouvelle faille affirmée.

**Pas de vérificateur indépendant au run-7.** Protocole `incomplete` mais passage source terminé ; les JSON sont les décisions du parent dans l'adaptation demandée. Ledger 15 unités, deux validateurs PASS = formats seulement. Ne transformer ni cela, ni la contre-relecture source de Claude sur S2/S10, en preuve d'exploitation réelle.

## Prochaine étape prévue, bornée

Décision A de Jake : petite contre-relecture à froid des rejets **A2, A4, A5, M6, M7, M8**, avec **2–3 agents** et recherche des trous évidents, environ un quart de compartiment. Pas de reprise complète de 3/4, ni nouveau quick global de l'application. La rédaction de cette passation n'a pas lancé cette relecture. Le prompt ci-dessous sert à la demander explicitement dans la prochaine conversation.

Chaque vérificateur doit tenter de réfuter le rejet depuis la source courante, préciser la frontière, reconnaître le contrôle le plus fort et distinguer même racine/variante/nouveauté. Éviter qu'un simple manque de meilleure pratique devienne une faille. Conserver les fingerprints quand la racine est identique. Les gaps découverts hors mission deviennent reports, pas une extension silencieuse du travail.

Les codes sont **A2/A4/A5 du run-3 et M6/M7/M8 du run-4** : ne pas les confondre avec les nouveaux P5/P6. Le point P5 CSRF ne fait pas partie des six rejets demandés ; le garder comme contexte et limite.

Sortie proposée pour cette relecture : dossier distinct `C:\Users\nicoj\security-audit-skill\beatplatform\relecture-rejets-c3-c4-2026-11-19`. Vérifier son absence avant création ; s'il existe, arrêter sans écraser et le signaler. **Ne pas utiliser `run-8` : ce nom doit rester sans ambiguïté pour le futur compartiment fichiers.**

À la fin de cette petite relecture : retour simple à Jake, décisions et limites, puis arrêt avant fusion/corrections/compartiment 8. La fusion est une étape suivante, pas déjà accomplie par le bilan.

## Règles à conserver

- Lecture de code seule. Aucun npm/npx/next/tsc, script du projet, navigateur cible, installation, appel sonoo.app/Stripe/Supabase/Resend/R2/Vercel/API payante. Jamais `.env` ni `.env.local`.
- Seul Node autorisé pour ces audits : `node C:\Users\nicoj\security-audit-skill\outils\valider.cjs ledger|findings <fichier>`. Les scripts d'origine rencontrent la limite Windows `O_NOFOLLOW` ; l'enveloppe contrôle les formats, pas l'exploitation.
- SQL réel non observé = `needs_validation` et SELECT de métadonnées que Jake colle lui-même. Ne pas les exécuter. Aucune gravité ni confirmed sans preuve autorisée.
- Ne pas modifier le code, anciens rapports, sources `raw/`, wiki ou journal pour cette reprise bornée. Écritures : nouveau dossier de relecture et bilan dans Rang 9f à la fin ; pas de `/gocode` implicite. Préserver les nouveaux documents de transmission locaux.
- Une boutique = un commerce indépendant ; toute donnée non explicitement affichée est cachée ; MP3 obtenu seulement par achat ou free download activé. Ne pas rouvrir les décisions du Lot 1 sans nouveau fait.
- Aucun email, DNS, WordPress, domaine ou configuration hébergée à modifier. Aucun contournement de Qustodio.
- Commit/push documentaire seulement si Jake le demande pour la reprise, sans hooks. Ne pas supposer que l'autorisation du push `76c4291` autorise tous les futurs commits.

## Ordre après la relecture

Fusion F1-F20/C/D/A/M/B/S/P et lots revus avec Jake → `/gocode` du Lot 1 → code **et validation** du Lot 1 → **audit compartiment 8 fichiers/téléchargements** → lots suivants. Paiement/comptes en standard plus tard sur décision de Jake.

Reports à préserver : courses run-1/run-2, erreurs partielles run-3, consentement pendant lot préparé run-4, listes collaborateur run-5, historiques/références run-6, deux différés run-7. Fichiers : reprendre aussi les champs d'URL acceptés tels quels au run-5, sans commencer ce travail avant Lot 1.

## Prompt prêt à coller à Claude

```text
Reprends Sonoo, rang 9f. Lis EN ENTIER :
C:\Users\nicoj\beatplatform\HANDOFF_CLAUDE_SECURITE_9F_APRES_C7_2026-11-19.md
puis les sources et rapports qu'il prescrit, git status et git log récents.

Les compartiments 1 à 7 sont parcourus en quick. Rien n'est corrigé.
Le commit documentaire 76c4291 est poussé sur origin/main ; vérifie l'état actuel.
Le bilan global et cette passation sont des documents de transmission, pas une fusion des pistes.
Ne présume aucun résultat des SELECT run-6/run-7 : Codex ne les a pas exécutés.

Je te demande maintenant UNIQUEMENT la petite contre-relecture à froid prévue par la décision A : rejets A2/A4/A5 du run-3 et M6/M7/M8 du run-4, avec 2–3 agents et recherche des trous évidents dans ces frontières. Pas de réaudit complet de 3/4 ni de toute l'application.

Lecture du code seule, aucun code du projet lancé, aucun appel au site/service/API payante, aucune installation, jamais .env/.env.local. Seul Node : l'enveloppe valider.cjs. Aucun correctif sans mon /gocode. Respecte les limites d'écriture de la passation et n'écrase aucun rapport existant.

Vérifie l'absence du dossier de sortie proposé avant création ; s'il existe, arrête et signale-le. N'utilise pas run-8 pour cette relecture. Pour chaque rejet, cherche à le réfuter : garde effective, principal touché, frontière et résultat concret. Déduplique contre F1-F20 et C/D/A/M/B/S/P ; aucune gravité ni confirmed sans preuve autorisée. Une dépendance à la base réelle reste needs_validation avec SELECT de métadonnées pour moi, jamais exécuté par toi.

Retour en français simple : rejet conservé / piste à rouvrir / déjà connu / différé, raison, lot proposé, limites et validations nécessaires. Arrête-toi ensuite : ne commence ni fusion, ni corrections, ni compartiment 8. Le 8 reste APRÈS le code et la validation du Lot 1.
```
