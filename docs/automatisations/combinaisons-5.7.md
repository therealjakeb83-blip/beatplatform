# Phase 5.7 — Combinaisons entre workflows d'Automatisations

> **Statut (2026-07-16) : codé et déployé, tests en cours.** Fichiers modifiés : `lib/automatisations.ts` (réécriture complète autour de la résolution par jour/client), `app/api/cron/automatisations/route.ts` (regroupement), `app/api/cron/scans-automatisations/route.ts` (correctif Relance inactivité), `app/api/stripe/webhook/route.ts` (garde-fou `achete`), `app/dashboard/business/marketing/automatisations/_lib/{recettes,actions}.ts` (recette combo + adaptation file d'attente), migrations `supabase/phase5_combinaisons.sql` et `supabase/signature_emails.sql` (exécutées). La combo D+A a été scindée en 2026-07-15 en **2 variantes** selon le palier d'achat (`combo_1er_achat_bienvenue_abo` / `combo_achat_recurrent_bienvenue_abo`, voir ligne #4). Détail technique complet dans `memory/project_phase5_combinaisons_implementation.md`. **Checklist de tests réels en bas de ce document (section "Tests 5.9") — Tests 1, 2, 3, 4, 5, 6, 7, 8 et 10 validés, reste 9 et 11-17.**

Liste complète et exhaustive : les 7 workflows validés en isolation sont traités comme 7 signaux qui peuvent se déclencher le même jour pour le même client. Tableau principal = **les 21 paires croisées possibles entre 2 signaux différents** (7 choix 2 = 21, toutes couvertes — la 1re passe en avait raté une, D+G, retrouvée en recomptant). Section séparée pour les répétitions d'un même signal le même jour (D+D, G+G).

Signaux : **A** Bienvenue abo · **B** Abonnement en attente · **C** Churn message perso · **D** Achat (1 seul palier retenu, le plus avancé, si plusieurs commandes le même jour) · **E** Bienvenue perso · **F** Relance inactivité · **G** Follow-up free download.

Hors scope de 5.7 (pas de workflow codé pour l'instant) : Tentative d'achat échouée.

**Conclusion de la revue (2026-07-14, confirmée par Jake) : aucun scénario n'atterrit en cas rare.** Les 23 scénarios + les 2 garde-fous d'état se résolvent tous de façon déterministe (impossible / silence / domination / la seule combo D+A). **Phase 5.8 (IA + validation humaine) n'est donc pas construite** — elle n'a rien à traiter avec les 7 workflows actuels, ce serait de l'infrastructure sans cas d'usage réel. Filet de sécurité minimal à la place : si un futur workflow (au-delà des 7 actuels) introduit un signal qui ne rentre dans aucune des 3 familles ci-dessous, ne rien envoyer automatiquement (silence + log), plutôt que deviner. 5.8 sera construite plus tard, le jour où un vrai cas rare se présente en pratique, avec un exemple concret sous les yeux.

Décision passée en revue une par une avec Jake — ce fichier fait foi pour l'implémentation de 5.7.

| # | Scénario | Réaliste ? | Proposition Claude | Décision Jake |
|---|---|---|---|---|
| 1 | A+B — Bienvenue abo + En attente le même jour | Quasi impossible | Aucune règle nécessaire | Impossible — le 1er renouvellement tombe toujours le mois suivant. Aucune règle. |
| 2 | A+C — Bienvenue abo + Churn le même jour | Réaliste (abo puis regret immédiat) | Silence total | ~~Silence total~~ **Révisé le 2026-07-16** : Jake préfère relancer le client plutôt que laisser filer sans comprendre — nouvelle combo `combo_abo_resilie_rapidement` (catégorie Combinaisons), relance perso demandant si problème technique ou incompréhension. Même repli que les combos D+A si non configurée : silence total (comportement d'origine). Si achat le même jour (D+A+C), l'achat domine et la relance reste silencieuse (confirmé par Jake). |
| 3 | B+C — En attente + Churn le même jour | Réaliste (paiement raté puis annulation) | Churn seul (à confirmer) | Churn seul — vécu réel derrière, mérite le message qui demande le ressenti. |
| 4 | D+A — Achat + Bienvenue abo | Réaliste, cas prioritaire cité par Jake | Combo codée en dur | Combo codée en dur — un seul mail qui fusionne remerciement achat + bienvenue abo. **Précision du 2026-07-15** : le ton "1er achat" (nouvel artiste) diffère trop du ton "achat récurrent" (habitué) pour un texte unique — 2 variantes de la combo, sélectionnées automatiquement selon le palier réel de l'achat (`combo_1er_achat_bienvenue_abo` / `combo_achat_recurrent_bienvenue_abo`), le côté abonnement restant toujours "bienvenue" par construction (bienvenue_abonnement ne se déclenche que sur un abonnement neuf). |
| 5 | D+B — Achat + Abonnement en attente | Réaliste | Combo codée en dur | ~~Combo codée en dur~~ **Révisé** : même règle que #6 (D+C) — priorité au remerciement d'achat seul, silence sur l'abonnement en attente. |
| 6 | D+C — Achat + Churn | Rare | Cas rare → 5.8 | Priorité au remerciement d'achat seul, silence sur le churn — apporter du positif au client plutôt que rouvrir le sujet du départ. |
| 8 | E+D — Bienvenue perso + Achat | Très fréquent (1er achat crée souvent le compte) | Silence sur E (ou combo dédiée ?) | Silence sur E, remerciement achat seul — couvert par la règle générale ci-dessous (historique bienvenue perso). |
| 9 | E+A — Bienvenue perso + Bienvenue abo | Réaliste | Silence sur E (ou combo dédiée ?) | Silence sur E, bienvenue abo seul — couvert par la règle générale ci-dessous. |
| 10 | E+B — Bienvenue perso + En attente | Quasi impossible | Aucune règle nécessaire | Impossible, aucune règle. |
| 11 | E+C — Bienvenue perso + Churn | Quasi impossible | Aucune règle nécessaire | Impossible, aucune règle. |
| 12 | E+G — Bienvenue perso + Free download | Réaliste | Silence sur G (ou combo dédiée ?) | Silence sur E, follow-up free download seul — free download est le signal le plus fort ici. |
| 13 | E+F — Bienvenue perso + Relance inactivité | ~~Impossible~~ possible en réalité (achat sans compte via guest checkout, puis inscription plus tard) | Aucune règle nécessaire | Silence sur E, relance inactivité seule — couvert par la règle générale ci-dessous (le client était déjà connu). |
| 14 | F+D — Relance déposée par le scan, achat avant l'envoi | Réaliste | Silence sur F, envoyer le remerciement d'achat | Confirmé — bonus non prévu : évite aussi d'envoyer un code promo a posteriori à quelqu'un qui vient de payer plein tarif. |
| 15 | F+G — Relance + Free download | Réaliste | Silence sur G (ou combo ?) | Silence sur G, relance inactivité seule — le code promo peut justement convertir ce téléchargement gratuit en achat. |
| 16 | F+A — Relance + Bienvenue abo | Rare mais possible (abonné inactif en licences) | Silence sur F | Silence sur F, bienvenue abo seul — l'abonnement est une nouvelle activité, il montre qu'il nous redonne de l'intérêt. |
| 17 | F+B — Relance + Abonnement en attente | ~~Rare mais possible~~ Impossible avec le correctif ci-dessus | Silence sur F | Impossible — un renouvellement en échec aujourd'hui prouve un paiement réussi ~30 jours avant, largement dans la fenêtre d'inactivité par défaut. Aucune règle nécessaire. |
| 18 | F+C — Relance + Churn | ~~Rare mais possible~~ Impossible avec le correctif ci-dessus | Silence sur F | Impossible — même raisonnement : le délai de grâce (1 mois max) ou un paiement à jour avant annulation directe garantit une activité récente. Aucune règle nécessaire. |
| 19 | G+A — Free download + Bienvenue abo | Rare | Silence sur G | Silence sur G, l'abonnement domine. |
| 20 | G+B — Free download + Abonnement en attente | Rare | Silence sur G | Silence sur G, abonnement en attente domine. |
| 21 | G+C — Free download + Churn | Rare | Silence sur G | Silence sur G, churn domine. |
| 22 | D+G — Achat + Follow-up free download (paire manquante du 1er passage, trouvée en recomptant) | Réaliste | Silence sur G, achat domine | Silence sur G, priorité au remerciement d'achat. |

## Signaux répétés le même jour (hors des 21 paires croisées)

| # | Scénario | Réaliste ? | Proposition Claude | Décision Jake |
|---|---|---|---|---|
| 7 | D+D — Plusieurs achats le même jour (paliers différents) | Réaliste, pas rare (client qui parcourt le catalogue) | ~~Garder le palier le plus avancé~~ (incohérent : un nouveau client aurait le texte "habitué") | Règle fixe : garder le palier de la **1re commande du jour** (le plus bas atteint), fusionner les titres de tous les beats achetés ce jour-là dans `{{titre_beats}}`. |
| 23 | G+G — Plusieurs téléchargements gratuits le même jour | Réaliste (trouvé en recomptant, symétrique à D+D) | Un seul mail citant tous les beats, pas N mails | Confirmé — un seul mail regroupant tous les téléchargements du jour, même schéma que D+D (`{{titre_beat}}` devient une liste fusionnée comme `{{titre_beats}}` pour les achats). |

## Garde-fous d'état (vérifiés à l'envoi J+1, pas au dépôt)

Certains événements peuvent devenir obsolètes entre leur dépôt en file et leur envoi le lendemain — indépendamment de toute combinaison avec un autre workflow. Re-vérification systématique juste avant l'envoi :

| Workflow | Vérification à l'envoi | Décision Jake |
|---|---|---|
| B — Abonnement en attente (et sa combo D+B) | L'abonnement doit être **toujours** en statut "en attente" au moment de l'envoi — si Stripe a retenté le paiement entre-temps et que c'est passé, l'abonnement est redevenu actif : ne pas envoyer | Confirmé (2026-07-14, demandé par Jake) |
| F — Relance inactivité (et le scénario #14 D+F) | Déjà couvert : si le client a racheté entre le dépôt et l'envoi, ne pas envoyer | Déjà acté |
| G — Follow-up free download | Déjà couvert (garde-fou `achete`, à réparer — voir plan) : si le client a acheté le beat téléchargé entre-temps, ne pas envoyer | Déjà acté |
| E — Bienvenue perso | **Règle générale (remplace le raisonnement au cas par cas des scénarios #8/#9/#13)** : avant l'envoi, vérifier si ce client a déjà une commande LICENCE, un abonnement, **ou un téléchargement gratuit** chez ce beatmaker, **à n'importe quelle date** (pas seulement le jour même) — si oui, ne jamais envoyer Bienvenue perso, peu importe l'ancienneté. Couvre le guest checkout suivi d'une inscription tardive, et le cas où le free download impose déjà la création de compte (E+G, #12, arrivent au même moment — pas un cas "plus tard" séparé) | Confirmé (Jake, portée étendue aux free downloads) |
| C — Churn message perso | La résiliation doit être **toujours** programmée (`annulation_en_cours`) au moment de l'envoi — si le client a cliqué "Reprendre mon abonnement" entre-temps (nouveau bouton self-service, 2026-07-16), ne pas envoyer | Ajouté 2026-07-16, découvert en testant en conditions réelles (nécessaire dès qu'un bouton "annuler la résiliation" existe côté client) |

## Correctifs à la logique de base (découverts pendant la revue combinaisons)

Pas des combinaisons entre workflows — des trous dans un workflow existant, révélés en discutant des scénarios ci-dessus.

- **Relance inactivité — le calcul de "dernière activité" doit inclure les paiements d'abonnement.** Actuellement le scan ne regarde que la dernière commande LICENCE : un abonné qui paie fidèlement chaque mois sans jamais acheter de licence à l'unité se ferait quand même flaguer "inactif" (absurde, et pire, ça lui enverrait un code promo alors qu'il paie déjà). Correctif : "dernière activité" = le plus récent entre la dernière commande LICENCE et la dernière mensualité d'abonnement payée avec succès (chaque renouvellement réussi compte, pas seulement la souscription initiale). Si l'abonnement est ensuite annulé, le compteur repart naturellement de la date du dernier vrai paiement. Confirmé par Jake (2026-07-14).
- **Idée backlog (pas dans le scope de 5.7) — "Fidélité abonné sans achat licence"** : un abonné actif qui n'a jamais acheté de licence à l'unité pourrait recevoir un mail dédié (ton "merci pour ton soutien", pas "ça fait longtemps") avec un code promo pour l'inciter à essayer un achat malgré les beats gratuits de son abonnement. Déclencheur différent de Relance inactivité (abonné actif depuis X mois + zéro commande LICENCE jamais, pas "dernière commande trop ancienne"). À scoper dans une session dédiée, pas construit dans cette phase pour ne pas perdre le fil de la revue combinaisons.

## Backlog UX — fiche explicative pour les beatmakers

Pas construit maintenant (noté pour plus tard, après le code) : une **fiche ultra pédagogique**, compréhensible par un non-développeur (Jake : "qu'un enfant de 8 ans soit capable de la comprendre"), qui explique la logique de combinaison aux beatmakers utilisateurs de la plateforme — sans le vocabulaire technique de ce document (signaux, passes, familles). Le but : qu'un beatmaker comprenne pourquoi il ne reçoit pas 3 mails automatiques le jour où son client a tout fait d'un coup, et fasse confiance à l'outil plutôt que de croire qu'un envoi a été "oublié".

- Direction de ton validée par Jake (exemple, pas le texte final) : *"Un seul mail par jour et par client, toujours. S'il se passe plusieurs choses le même jour, on choisit le message le plus important à raconter plutôt que de spammer sa boîte de réception. L'argent passe toujours en premier (achat, abonnement) ; les petits signaux (téléchargement gratuit, relance) ne comptent que si rien d'important ne s'est passé ce jour-là."*
- À rédiger **après** le code et les tests (le texte doit coller au comportement réel final, pas de risque de décrire un comportement qu'on change en cours de route).
- Emplacement dans le produit (page d'aide dédiée, tooltip sur la page Automatisations, etc.) pas encore décidé — à trancher au moment de la construire.

## Notes de lecture

- Triple A+B+C : dérivé des lignes 1-3, pas de décision séparée nécessaire (implique A+B, jugé impossible).
- Toute combinaison "Achat + [état net Abonnement résolu via 1-3]" se lit en combinant la ligne 1-3 concernée avec la ligne 4/5/6 correspondante.
- **2 combos codées en dur** : D+A (#4, fusion achat+bienvenue abo) et A+C (#2, relance perso résiliation rapide, ajoutée le 2026-07-16). Tout le reste se résout par domination (un signal gagne, l'autre est silencieux) ou par règle fixe (paliers/téléchargements cumulés).
- **Aucun scénario ne part en 5.8** au final — tout est résolu par des règles déterministes. **Décision (Jake, 2026-07-14) : Phase 5.8 n'est pas construite** — pas de cas d'usage réel à ce jour. Simple filet de sécurité (silence + log) pour un futur signal qui ne rentrerait dans aucune des 3 familles ; 5.8 sera scopée plus tard si un vrai cas rare apparaît en pratique.

## Notes d'implémentation

- **Résolution par familles en 2 passes, jamais paire par paire, jamais plus d'1 mail/jour/client.** Le nombre de signaux présents le même jour ne change rien à la mécanique (testé jusqu'à 5 signaux simultanés) :
  1. **Passe 1 — l'argent d'abord.** Résoudre la famille Abonnement (A/B/C) toute seule d'abord, indépendamment du reste, en un état net unique : silence (A+C s'annulent), churn (B+C → C gagne), ou l'événement seul s'il n'y en a qu'un. Puis combiner ce résultat avec l'achat (D) s'il y en a un : abonnement-net = A → fusion en 1 mail combiné ; abonnement-net = B, C ou silence → l'achat gagne seul s'il existe, sinon l'abonnement-net (s'il n'est pas silence) part seul.
  2. **Si la passe 1 donne un résultat** (achat seul, abo seul, ou combo) → c'est le mail du jour, **tout le reste est silencieux automatiquement** (Relance, Free download, Bienvenue perso), peu importe combien de signaux faibles il y a ce jour-là.
  3. **Si la passe 1 ne donne rien** (aucun achat, abonnement resté silencieux) → passe 2 : parmi Relance / Free download / Bienvenue perso présents ce jour-là, le plus fort gagne dans cet ordre : Relance > Free download > Bienvenue perso. Bienvenue perso reste de toute façon soumis à son garde-fou absolu (jamais envoyé si historique, cf plus haut).
  - **Piège identifié à ne pas reproduire** : ne jamais comparer un signal individuel (ex. Free download) contre un signal de la famille Abonnement pris isolément (ex. Bienvenue abo) sans d'abord avoir figé l'état net de la famille Abonnement — sinon un abonnement qui s'est annulé lui-même (silence) peut à tort faire taire un signal qui aurait dû partir (cas A+C+G identifié avec Jake, 2026-07-14).
- **Combo D+A pas encore configurée par le beatmaker** : l'achat gagne seul, bienvenue abo reste silencieuse — jamais 2 mails le même jour, même dans ce repli. **Révisé le 2026-07-16** : le premier passage envoyait achat + bienvenue abo séparément ("comme avant 5.7") pour ne rien perdre, mais cette note n'avait jamais été explicitement soumise à Jake (contrairement aux 23 scénarios du tableau ci-dessus, tous confirmés un par un) et violait sans discussion la règle "1 mail/jour/client, toujours". Jake tranché : achat seul, même logique de domination que #5/#6 — cohérent avec "l'argent passe toujours en premier".
- **Combo D+A référence 2 événements sources** (une commande_id ET un abonnement_id) — la résolution de tokens (`resoudreTokensSupplementaires`) doit être adaptée pour accepter 2 reference_id au lieu d'un seul, contrairement aux recettes existantes.
- **Combo A+C (`combo_abo_resilie_rapidement`, 2026-07-16)** : plus simple que D+A — bienvenue_abonnement et churn_message_perso référencent tous les deux le même `abonnements_boutique.id`, pas besoin d'adapter `resoudreTokensSupplementaires` (aucun token supplémentaire, juste `{{prénom}}`/`{{signature}}`). Repli identique aux combos achat+abo : silence total si la recette n'est pas configurée (pas de fallback à envoyer, contrairement à D+A qui retombe sur l'achat seul). Migration `supabase/phase5_resiliation_rapide.sql`.
- **Garde-fou `free_downloads.achete`** : à écrire dans le webhook Stripe au moment de l'insert `commande_lignes` (match client_id + beat_id + beatmaker_id) — actuellement rien ne met cette colonne à jour nulle part dans le code.
- **Correctif Relance inactivité** : dans `scans-automatisations/route.ts`, élargir le filtre `.eq('type_commande', 'LICENCE')` pour inclure aussi `CREATION_ABONNEMENT`/`RENOUVELLEMENT` (déjà présents dans `commandes`, pas besoin de nouvelle colonne ni de requête sur `abonnements_boutique`).

## Tests 5.9 — checklist réelle (état au 2026-07-16)

Source de vérité pour la suite des tests — cocher au fur et à mesure. Pour chaque test : provoquer l'action décrite, observer le résultat attendu.

### 1. La combo
- [x] **1. 1er achat + Bienvenue abo** → 1 seul mail, ton "nouvel artiste". **Validé 2026-07-15.**
- [x] **2. Achat récurrent + Bienvenue abo** → 1 seul mail, ton "habitué" (2e variante ajoutée le 2026-07-15). **Validé 2026-07-16.**
- [x] **3. Combo non configurée** (recette combo désactivée) → l'achat gagne seul, bienvenue abo silencieuse (règle révisée le 2026-07-16). **Validé 2026-07-16.**

### 2. Achat — plusieurs commandes le même jour
- [x] **4.** Client sans historique, 2 commandes séparées le même jour → 1 mail, texte "1er achat" (pas "habitué"), 2 titres cités. **Validé 2026-07-16.**

### 3. Abonnement — priorités internes
- [x] **5.** Abo en attente + Churn le même jour → seul le mail Churn part. **Validé 2026-07-16.**
- [x] **6.** Abo en attente redevenu actif avant l'envoi (paiement repassé) → aucun mail "en attente". **Validé 2026-07-16.**
- [x] **7.** Bienvenue abo + Churn le même jour → **règle révisée le 2026-07-16** (voir décision #2) : relance perso "Abo résilié rapidement" au lieu du silence total, si la combo est configurée (sinon silence, comportement d'origine). **Validé 2026-07-16.**

### 4. Achat qui écrase un signal d'abonnement
- [x] **8.** Achat + Abo en attente le même jour → seul le remerciement d'achat part. **Validé 2026-07-16.**
- [ ] **9.** Achat + Churn le même jour → seul le remerciement d'achat part.

### 5. Bienvenue perso
- [x] **10.** Client complètement nouveau crée un compte → bienvenue perso part normalement. **Validé 2026-07-16** (repris après correctif du bug de connexion auto).
- [ ] **11.** Client déjà connu (achat ou téléchargement avant, même ancien) crée un compte → aucun mail bienvenue perso.
- [ ] **12.** Nouveau client achète ET crée un compte le même jour → seul le remerciement d'achat part, pas bienvenue perso.

### 6. Follow-up free download
- [ ] **13.** 2 téléchargements gratuits le même jour → 1 mail, 2 titres cités.
- [ ] **14.** Télécharge un gratuit puis achète ce même beat avant l'envoi → aucun mail (garde-fou `achete`, tout nouveau ce soir-là).
- [ ] **15.** Télécharge un gratuit et achète autre chose le même jour → seul le remerciement d'achat part.

### 7. Relance inactivité
- [ ] **16.** Abonné actif qui paie chaque mois sans jamais acheter de licence → ne reçoit **jamais** de mail de relance/code promo (le correctif du 2026-07-14, le plus important à vérifier).
- [ ] **17.** Client relancé (événement déposé par le scan) rachète avant l'envoi → aucun mail de relance ne part.

**Priorité si le temps manque** : 1 (fait), 3, 14, 16 — ce sont les cas les plus susceptibles de cacher un vrai bug ou une régression.
