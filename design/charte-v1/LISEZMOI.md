# Charte Sonoo — version 1 (provisoire)

Reçue le 2026-11-13 du designer (Abhi C, Fiverr, phase 2). **Pas la version finale** : des révisions sont prévues. Rien n'est encore intégré au site réel.

## Où sont les fichiers

| Emplacement | Contenu | Sur GitHub ? |
|---|---|---|
| `design/charte-v1/sources/` | Tout le dossier du designer (254 Mo) : PDF de la charte, moodboard, fichiers Illustrator/EPS, photos, maquettes du site | Non (trop lourd, ignoré par git) |
| `design/charte-v1/sources/Maquettes site/` | Maquettes du site vitrine en français : accueil ordinateur (1440), tablette (768), mobile (390), menu mobile ouvert, inscription, présentation | Non |
| `public/marque/` | Fichiers prêts pour le web : logo, icône d'appli, favicons, 10 icônes | Oui |

L'original reste dans `Téléchargements/Files (1)` tant que Jake ne l'a pas supprimé.

## Couleurs

| Nom | Code | Rôle |
|---|---|---|
| Tech Blue | `#2477F5` | Couleur principale, boutons |
| Black Hole | `#050505` | Noir, texte, sections sombres |
| Full White | `#FFFFFF` | Blanc |
| Dark Sapphire | `#17223B` | Secondaire, bleu nuit |
| Seashell Blue | `#DCEAFF` | Secondaire, bleu très clair |
| Blue Whale | `#6E7D94` | Secondaire, gris-bleu |

## Polices

- **Titres** : Surgena Bold (police payante, absente de Google Fonts → fichiers à demander au designer). Taille 32 à 72 px (titre 1), 30 à 50 px (titre 2).
- **Texte** : Geist Regular, sous-titres en Geist Medium (déjà chargée par `app/layout.tsx`). Sous-titres 20 à 32 px, texte 12 à 20 px.

## Logo — règles

- Ne jamais le tourner, déformer, recadrer, flouter, contourner ni changer ses proportions.
- Toujours laisser une marge vide autour (la « zone X » de la charte).
- Variantes : bleu + noir sur blanc, tout blanc sur noir, tout blanc sur bleu ; version verticale (symbole au-dessus du nom).
- Tailles testées : 100, 75, 50 et 25 px de haut.

## Icônes (`public/marque/icones/`)

Grille de 24 × 24 px, traits géométriques : `boutique`, `catalogue-beats`, `licence`, `ventes`, `statistiques`, `membres`, `personnalisation`, `commandes`, `paiement-securise`, `cloud`.

## Incohérences à remonter au designer

1. Le bleu varie : `#2477F5` (PDF), `#2477F2` (fichiers SVG du logo et des icônes), `#2477FB` (nuancier du 10/11).
2. Les maquettes du site ne semblent pas utiliser Surgena pour les titres.
3. Le fond des maquettes est un blanc cassé chaud, absent de la palette.
4. Demander le lien Figma des maquettes (mesures exactes) et les fichiers de Surgena.
5. **Contrastes trop faibles (mesurés le 2026-11-13 sur la page test, norme d'accessibilité WCAG AA)** :
   - Texte blanc sur le bleu Tech Blue `#2477F5` : 4,2 pour 1, il faut 4,5 pour 1 pour un texte normal. Ça touche tous les boutons bleus et la bannière Affiliation. Un bleu un peu plus foncé passerait partout : `#1E66D8` (5,3 sur blanc, 4,7 sur le fond gris des blocs).
   - Gris clair de la 2e ligne du titre d'accueil (`#A6A39E` sur le fond blanc cassé) : 2,3 pour 1, il faut au moins 3 pour 1 même en très gros. `#8C8984` passerait (3,25).
   - Petites étiquettes bleues sur fond gris (« FICHIER CLIENTS », « AUTOMATISATIONS »…) : 3,7 pour 1, il faut 4,5 pour 1. Réglé aussi par `#1E66D8`.

## Page test du site vitrine

`/apercu-vitrine` (et `/apercu-vitrine/inscription`, factice) reproduit les maquettes de cette charte. Elle est cachée par la page de maintenance et n'est pas indexée. Toutes ses couleurs et polices sont regroupées en haut de `app/apercu-vitrine/vitrine.css`. La police DM Sans y remplace Surgena en attendant ses fichiers.

## Ce que montrent les maquettes du site

Barre de menu (Fonctionnalités, Tarifs, Affiliation, FAQ, Connexion, Essai gratuit) → accueil « Tes beats méritent mieux qu'une marketplace » → 01 Ta marque → 02 Croissance (fichier clients, automatisations, campagnes, abonnements, import) → 03 Tout-en-un (aperçu du tableau de bord) → 04 Administratif et paiements (contrats/factures, 0 % de commission, collabs) → 05 L'histoire (Jake B, témoignages à venir) → Affiliation (bientôt) → Tarifs (Gratuit / Pro « [XX] € ») → FAQ → appel final → pied de page. Plus une page d'inscription.
