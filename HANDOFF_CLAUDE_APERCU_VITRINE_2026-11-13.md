# Passation — page test du site vitrine (2026-11-13)

## État : codée, mesurée, envoyée (commit 4d853d0) — reste les tests de Jake (T1-T4)

- `/apercu-vitrine` reproduit `design/charte-v1/sources/Maquettes site/Landing Desktop/Tablet/Mobile.jpg`. Écart de hauteur totale mesuré : ordinateur 11 621 px pour 11 611, tablette 14 986 pour 14 959, mobile 16 422 pour 16 320. Aucun débordement sur le côté.
- Menu mobile conforme à `Mobile Menu ouvert.jpg` : Tab reste dans le menu, Échap ferme, un lien ferme puis descend à la section.
- `/apercu-vitrine/inscription` (factice) conforme à `Inscription Desktop.jpg` (champs à 0-2 px) : aucune requête envoyée, message « Page de démonstration ».
- Page cachée : préfixe `/apercu-vitrine` dans `lib/maintenance.ts`, `noindex`, `robots.txt`, nom réservé (`lib/slug-regles.ts`, `lib/domaine-boutique.ts`).
- Couleurs et polices : TOUTES en haut de `app/apercu-vitrine/vitrine.css` (`--v-bleu` = `#2477F5`). DM Sans remplace Surgena, DM Mono pour les étiquettes.
- Images : découpes WebP des maquettes dans `public/apercu-vitrine/` (292 Ko au total).
- Seuils : mobile < 768, tablette 768-1199, ordinateur ≥ 1200. Les retouches propres au mobile sont dans le bloc « Mobile seulement » ; ce qui est posé en tablette vaut aussi pour l'ordinateur, sauf rétablissement dans le bloc ordinateur.

## Checklist de test (Jake)
- T1 ordinateur fidèle — T2 iPhone + menu — T3 « Essai gratuit » → inscription factice — T4 fenêtre privée sans mot de passe = page de maintenance.

## Limites connues
- Contrastes de la charte sous la norme WCAG AA (bleu des boutons, gris du titre, petites étiquettes bleues) : détail et propositions dans `design/charte-v1/LISEZMOI.md`, point 5. Non corrigé, c'est au designer de trancher.
- Liens sans destination réelle affichés en texte simple : Chaîne YouTube, réseaux sociaux, Mentions légales, CGU/CGV, Confidentialité, Cookies. « Comparer les offres en détail » renvoie aux Tarifs. « Être prévenu du lancement » et « Contacter l'équipe » ouvrent un e-mail vers `EMAIL_CONTACT`.
- Réponses de la FAQ (sauf la 1re) écrites par Claude d'après le fonctionnement réel de Sonoo : à relire.
- Case « J'accepte les conditions » cochée d'avance comme sur la maquette : à décocher pour une vraie inscription.
- Le nom « Sonoo » est écrit en dur dans les textes de la page (copie de maquette), contrairement à la règle `NOM_PLATEFORME` : à reprendre si la page devient le vrai accueil.
- Le programme d'Impeccable (`scripts/impeccable`) n'a pas été lancé : au premier usage, il télécharge un exécutable. Audit fait à la main d'après `reference/audit.md`.

## Tests en local
Serveur réparé (commit 0a1ba9f). Toujours avec le garde-fou (mémoire `feedback_pc_jake_surcharge_navigateur_test.md`) et `dev-browser stop` avant usage si une session précédente a planté (sinon `getPage` bloque).
