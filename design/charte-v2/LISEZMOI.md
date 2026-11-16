# Charte Sonoo — version 2

Reçue le 2026-11-16 du designer (Abhi C, Fiverr, phase 2). Remplace la [v1](../charte-v1/LISEZMOI.md) du 2026-11-13. Rien n'est encore intégré au site réel.

## Où sont les fichiers

| Emplacement | Contenu | Sur GitHub ? |
|---|---|---|
| `design/charte-v2/sources/` | Tout le dossier du designer (240 Mo) : PDF `Sonoo_Brand Style Guide_TH.pdf` (36 pages), `Deliverables/` | Non (ignoré par git) |
| `design/charte-v2/sources/Maquettes site/` | Accueil ordinateur 1440, tablette 768, mobile 390, menu mobile ouvert | Non |

L'original reste dans `Téléchargements/Sonoo brand v2` tant que Jake ne l'a pas supprimé.

## Ce qui change par rapport à la v1

### Le PDF de la charte (36 pages)
Quasi identique. Seuls changements :
- Photos de couverture (p. 1, 2, 4) et deux maquettes (p. 33 affiche, p. 35 ordinateur portable) remplacées.
- Brand Voice (p. 7) : le dernier curseur est déplacé vers « High Energy ».
- Code du bleu Tech Blue passé de `#2477F5` à `#2477FB` (p. 23), mais la valeur RGB affichée juste à côté (36, 119, 245) correspond toujours à `#2477F5`.

### Livrables
- **Icônes refaites** : les 10 icônes sont maintenant dessinées sur une vraie grille 24 × 24 (avant : 2000 × 2000 mis à l'échelle). Mêmes dessins.
- 5 nouvelles photos dans `Images/new/`. Les deux photos nommées « hacker » sont celles de la couverture du guide (p. 1 et 2) : elles passent pour un studio, mais ce sont des photos de banque d'images prévues pour illustrer le piratage.
- 2 mockups de logo remplacés.
- Logo, favicons, icône d'appli : **inchangés** (fichiers identiques octet pour octet).

### Maquettes du site vitrine (gros changement)
- Les titres sont enfin en **Surgena** (point 2 de la v1 réglé).
- Le vrai logo (onde) remplace le losange provisoire dans la barre de menu.
- Accueil centré, aperçu de boutique en mode clair, lien « Voir une boutique » ajouté au menu.
- 01 Ta marque : le panneau de personnalisation a disparu, il reste les 3 téléphones.
- 02 Croissance : les 4 cartes denses sont remplacées par un parcours en 3 étapes (il décroche → Sonoo le relance → il revient et s'abonne).
- 03 Tableau de bord redessiné (barre latérale bleu nuit, grosse carte revenus bleue).
- 05 L'histoire : bloc témoignages supprimé ; mention « parcours de Jake B, fondateur — pas des résultats clients Sonoo » ajoutée ; photo de Jake à fournir.
- Menu mobile repensé (titres numérotés 01 à 05).
- Les maquettes **Inscription** et **Présentation** de la v1 ne sont pas dans la v2.

## Points encore ouverts (à remonter au designer)

1. **Bleu** : trois valeurs coexistent toujours : `#2477FB` (code du PDF), `#2477F5` (RGB du PDF), `#2477F2` (tous les SVG).
2. **Contraste** : blanc sur le bleu reste sous la norme (environ 4,1 pour 1, il faut 4,5). Proposition inchangée : `#1E66D8` pour les boutons et petits textes bleus.
3. **Fond blanc cassé chaud** toujours utilisé, toujours absent de la palette.
4. **Surgena** : la police utilise des formes de lettres très typées (« s », « a », « e »), lisibles en grand, à vérifier sur les titres de 2 lignes en mobile. Fichiers de la police (et licence web) toujours à obtenir.
5. **Tablette** : le tableau de bord de la section 03 est coupé sur la droite (texte coupé en plein mot).
6. Logo du tableau de bord : losange en tablette, onde en ordinateur.
7. Lien Figma toujours à demander.

## Retours de Jake (PDF du 2026-11-13) : ce que la v2 a fait

Source : `Téléchargements/Sonoo_Feedback_Abhi_EN_Final.pdf` (9 pages).

| Demande de Jake | État en v2 |
|---|---|
| Accueil : retirer le gros bloc bleu, boutique sur fond blanc | Fait |
| Ta marque : retirer le panneau de réglages, garder les 3 téléphones | Fait |
| Vends plus : section à refaire, plus simple | Fait (parcours en 3 étapes) |
| 4 visuels « trop back-office » (fichier client, automatisations, cartes, apparence) | Retirés |
| Tableau de bord trop proche de BeatStars | Redessiné (barre bleu nuit, carte revenus bleue), à juger par Jake |
| L'histoire : moins d'infos | Fait (témoignages retirés, 3 chiffres) |
| Compositions plus audacieuses (références BeatStars, Airbit, Vvault) | Peu fait : mise en page toujours centrée et classique, pas de téléphones inclinés ni de grille de pochettes |
| Photos plus rap / trap / urbain | En partie : couverture plus urbaine, mais DJ en soirée chic (p. 4) et homme au piano en pull jaune sur l'affiche (p. 33) |
| Affiche : retirer le guitariste, recomposer | Fait, mais la nouvelle photo n'est toujours pas rap |
| Moodboard | Pas renvoyé en v2 |
| Brand Voice plus « High Energy » | Fait |
| Menu mobile plus de personnalité | Fait (numéros, gros titres, motif d'onde) |
| Un seul bleu dans tous les fichiers | Pas fait |
| Surgena dans les maquettes | Fait |
| Fichiers de la police Surgena ou licence | Pas fournis |
| Lien Figma | Pas fourni |
| Inscription en tablette et mobile | Pas fournies |
| « Voir une boutique » dans les deux menus | Fait (ajouté sur ordinateur) |
| Source des icônes en plus des 10 | Pas de réponse, toujours 10 SVG |

## Page test du site vitrine v2

`/apercu-vitrine/v2` reproduit les maquettes v2 (ordinateur, tablette, mobile, menu mobile). La v1 reste intacte sur `/apercu-vitrine` pour comparer. Même protection : cachée par la page de maintenance, non indexée.

- Code : `app/apercu-vitrine/v2/` (copie de la v1 avec des noms de classes `w-` au lieu de `v-`, pour que les deux pages ne se mélangent pas). Toutes les retouches v2 sont en fin de `vitrine2.css`, bloc « Charte v2 ».
- Visuels (boutique, 3 téléphones, parcours de relance, tableau de bord, photo studio) : découpes WebP des maquettes dans `public/apercu-vitrine/v2/` (764 Ko). En tablette, on reprend les découpes ordinateur.
- Polices : titres en **Surgena version d'essai** (`app/apercu-vitrine/v2/polices/surgena-essai.ttf`, téléchargée par Jake sur fontspace le 2026-11-16 : licence usage personnel non commercial, demi-gras, **sans accents** : é, è, ê, à, ç… s'affichent en Jost). Aperçu seulement : Jake achètera la licence web s'il garde la police, il faudra alors remplacer ce fichier par la version achetée. Texte en Geist (charte). Bleu : `#2477FB` (code du PDF v2).
- « Essai gratuit » mène à l'inscription factice de la v1 (validée, pas refaite en v2).
- Hauteurs mesurées le 2026-11-16 : ordinateur 11 035 px (maquette 11 213), tablette 12 079 (12 398), mobile 13 744 (13 666). Aucun débordement sur le côté.
- Icônes : les 10 icônes de marque (`Deliverables/Iconography`) sont dans `app/apercu-vitrine/v2/_composants/IconesMarque.tsx` (générées depuis les SVG, en bleu `currentColor` + détails blancs) et placées comme sur la maquette. Correspondance : domaine = fenêtre-statistiques (Icon-05), identité = curseurs (07), mobile = boutique (01), membres = calques (02), clients = personne-couronne (06), relances = nuage (10), revenus = barres (04), licences = document (03), paiements = carte-bouclier (09). Icon-08 (sac) n'est pas utilisée sur la maquette. Les petites icônes d'interface (menu, flèches, coches) restent celles de la v1 : la charte ne les fournit pas.
