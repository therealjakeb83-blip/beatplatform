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
- Code du bleu Tech Blue passé de `#2477F5` à `#2477FB` (p. 23), mais la valeur RGB affichée juste à côté (36, 119, 245) correspond toujours à `#2477F5`.

### Livrables
- **Icônes refaites** : les 10 icônes sont maintenant dessinées sur une vraie grille 24 × 24 (avant : 2000 × 2000 mis à l'échelle). Mêmes dessins.
- 5 nouvelles photos dans `Images/new/` (dont deux photos de « hackers », hors sujet).
- 2 mockups de logo remplacés.
- Logo, favicons, icône d'appli : **inchangés** (fichiers identiques octet pour octet).

### Maquettes du site vitrine (gros changement)
- Les titres sont enfin en **Surgena** (point 2 de la v1 réglé).
- Le vrai logo (onde) remplace le losange provisoire dans la barre de menu.
- Accueil centré, aperçu de boutique en mode clair, lien « Voir une boutique » ajouté au menu.
- 01 Ta marque : le panneau de personnalisation a disparu, il reste les 3 téléphones.
- 02 Croissance : les 4 cartes denses sont remplacées par un parcours en 3 étapes (il décroche → Sonoo le relance → il revient et s'abonne).
- 03 Tableau de bord redessiné (barre latérale bleu nuit, grosse carte revenus bleue).
- 04 : ajout « Suivi des sorties (Spotify) — Bientôt ».
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
8. Photos `hacker-*` à retirer.
