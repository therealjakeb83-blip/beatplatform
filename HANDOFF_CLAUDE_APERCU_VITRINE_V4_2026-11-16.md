# Passation — aperçu v4 du site vitrine Sonoo (2026-11-16)

Remplace `HANDOFF_CLAUDE_APERCU_VITRINE_2026-11-13.md` (aperçu v1, clos).

## Intention de Jake (à ne pas rouvrir)

- Faire une **v4 = une AUTRE proposition** de landing page, construite sur **le même retour envoyé au designer Abhi** (pas de nouveau retour de Jake sur la v3 : il ne commente pas la v3, il veut voir une autre interprétation).
- Garder v1, v2 et v3 intactes pour comparer côte à côte (Jake veut chaque version visible).
- Ce sont des **projections**, pas des maquettes du designer, et rien n'est intégré au vrai site (`app/page.tsx`).

## État en arrivant

| Page | Contenu | Code |
|---|---|---|
| `/apercu-vitrine` | maquettes charte v1 | `app/apercu-vitrine/` (classes `v-`) |
| `/apercu-vitrine/v2` | maquettes charte v2 d'Abhi | `app/apercu-vitrine/v2/` (classes `w-`) |
| `/apercu-vitrine/v3` | notre 1re projection du retour (ordinateur + mobile) | `app/apercu-vitrine/v3/` (classes `x-`, ajouts v3 en fin de `vitrine3.css`) |

- **`/apercu-vitrine` n'est plus derrière la maintenance** (commit 17f21d8, demande de Jake) : pages publiques, `noindex`. Claude peut donc les vérifier EN LIGNE sur sonoo.app.
- v3 = bandes crème / noir / bleu à bords arrondis, haut de page à cartes Sonoo inclinées (sans boutique), sections texte + image qui changent de côté, annotations « à la main » (Caveat), section bleue « 0 % », section 04 supprimée, logo Jake B (`public/apercu-vitrine/v3/logo-jake-b-blanc.png`), tarifs sur noir, aucune photo, Surgena seulement sur le titre du haut.

## Le retour envoyé à Abhi (la base de la v4)

Lire **`design/charte-v2/retour-jake/NOTES.md`** en entier (notes brutes + tri des points) et, si besoin, `retour-v2-FR.html` (le PDF en français). Les captures et les 16 photos de référence sont dans `design/charte-v2/retour-jake/captures/` (en local seulement, gitignoré). Résumé :
1. **Landing ordinateur d'abord** (le mobile vient après, mais Jake a vu la v3 mobile : prévoir aussi un mobile correct).
2. Alterner **fonds noirs et blancs**, + **une section bleue pleine largeur** (emplacement libre).
3. **Beaucoup moins de texte** : une idée forte par section, des visuels qui parlent d'eux-mêmes ; plus de rangées « icône + titre + paragraphe ».
4. **Mises en page plus audacieuses** : éléments inclinés, qui se chevauchent, qui débordent du cadre, texte/image qui alternent, annotations.
5. Inspirations : Deezer (épuré, contraste noir/blanc, transitions arrondies — structure seulement, jamais le look : Jake avait demandé d'éviter toute ressemblance avec Deezer pour le logo), Dribbble Pro Finance, HackerRank (couleurs, annotations), Stable (contraste, texte minimal), ChronoTask (disposition, mais manque de contraste). Liens dans `NOTES.md`.
6. Haut de page : mieux que la v1 mais **pas une boutique** comme image principale (doublon avec la section 01) ; image plus distinctive.
7. Section 04 « Administratif & paiements » supprimée (contrats/factures cités dans « Tout-en-un », 0 % citable ailleurs).
8. « L'histoire » : **logo Jake B** au lieu de la photo (fichiers : `C:\Users\nicoj\Desktop\LOGO\LOGO COMPLET`).
9. Police : Surgena gênante dans les titres de section (les « s » coupés) ; OK dans le grand titre du haut.
10. Image de marque : **pro tout en représentant le rap** (studio, nuit, noir et blanc contrasté ou ambiance bleue/violette, moments sur le vif). Les photos Pinterest = **moodboard seulement, JAMAIS sur le site** (droits).
11. Blanc crème des maquettes : Jake l'aime.

## Pour être une « autre proposition » que la v3

À présenter à Jake avant de coder (plan en étapes + ce qui diffère de la v3). Pistes possibles, à choisir avec lui, sans l'influencer outre mesure :
- autre ordre et autre rythme des bandes (ex. haut de page sombre), autre emplacement de la section bleue ;
- autre idée de haut de page (ex. couches empilées façon Stable, ou grande composition d'interface Sonoo inclinée) ;
- autre traitement de l'ambiance rap SANS photo (formes d'onde, grain, typographie, interface sombre) ;
- autre compromis typographique (option 2 du retour : une autre police proche et lisible pour les titres de section, ex. une police Google libre).

## Méthode

1. Lire : `CLAUDE.md`, cette passation, `design/charte-v2/retour-jake/NOTES.md`, `design/charte-v2/LISEZMOI.md`, `app/apercu-vitrine/v3/page.tsx` et la fin de `vitrine3.css` (bloc « v3 »), mémoire `project_identite_visuelle_sonoo.md`.
2. Présenter le plan v4 (sous-étapes + différences avec la v3). **Ne rien coder avant le feu vert.**
3. Construire `app/apercu-vitrine/v4/` en copiant la v3 avec un **nouveau préfixe de classes** (`y-`, remplacement `\bx-` → `y-`, `vitrine3` → `vitrine4`, `CHEMIN_VITRINE` → `/apercu-vitrine/v4`) : les CSS des aperçus sont globaux, deux préfixes identiques se mélangeraient. Réutiliser les découpes WebP de `public/apercu-vitrine/v2/` si utile.
4. Commit + push après chaque changement, puis **vérifier soi-même en ligne** :
   - ordinateur : Chrome headless `--window-size=1440,9000 --screenshot`, puis découper l'image (PyMuPDF installé dans le scratchpad : `pip install --target pylibs pymupdf`) ;
   - **mobile : Chrome refuse une fenêtre de 390 px** (la mise en page reste à ~500 px). Astuce qui marche : une page locale avec `<iframe src="https://sonoo.app/apercu-vitrine/v4" style="width:390px;height:13000px">`, capture à `--window-size=600,…`, URL `file:///C:/…` (chemin Windows absolu, PAS `/c/…`), profil Chrome neuf à chaque fois (sinon cache) ;
   - attendre le déploiement en vérifiant qu'une règle CSS nouvelle est présente dans les fichiers `/_next/static/…css` de la page.
   - `dev-browser` n'a pas pu lancer son navigateur (bac à sable) ; ne pas lancer `next dev` sans accord de Jake (mémoire `feedback_pc_jake_surcharge_navigateur_test.md`).
5. Annonce à Jake : lien, liste courte de ce qu'il va voir et en quoi c'est différent de la v3.

## Règles

- Code sur `main`, Jake regarde sur sonoo.app. Ne pas toucher v1/v2/v3.
- Aucune photo tierce dans `public/` ; pas d'animation non demandée.
- Bleu `#2477FB` (Brand Style Guide) ; Surgena = version d'essai sans accents (`sansAccents`), aperçu seulement.
- Si une nouvelle page plateforme hors `/apercu-vitrine` est créée, l'ajouter à la maintenance (`lib/maintenance.ts`).
