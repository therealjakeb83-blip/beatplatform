# Passation — page test du site vitrine (2026-11-13)

## Déjà fait
- Charte Sonoo v1 (provisoire) rangée : lire `design/charte-v1/LISEZMOI.md` (couleurs, polices, règles, incohérences). Sources lourdes dans `design/charte-v1/sources/` (local, ignoré par git), maquettes dans `design/charte-v1/sources/Maquettes site/`. Fichiers web dans `public/marque/`.
- Skills installés dans `.claude/skills/` : `impeccable` (SANS ses hooks, ne pas les activer sans accord de Jake) et `web-design-guidelines`. Plugin Figma : à installer par Jake si un lien Figma arrive.

## À faire (validé par Jake : « page temporaire, on ne touche pas à l'accueil actuel »)
1. Page `/apercu-vitrine` reproduisant `Landing Desktop/Tablet/Mobile.jpg` (adaptative 1440 / 768 / 390), menu mobile qui s'ouvre (`Mobile Menu ouvert.jpg`), ancres Fonctionnalités / Tarifs / FAQ, FAQ dépliable.
2. Page `/apercu-vitrine/inscription` factice d'après `Inscription Desktop.jpg` (aucun compte créé).
3. Ajouter `/apercu-vitrine` aux chemins fermés de `lib/maintenance.ts` (préfixe) → visible par Jake seul. Pas d'indexation.
4. Couleurs en variables à UN endroit (bleu à trancher avec le designer). Surgena absente → police gratuite proche en attendant. Captures boutique/tableau de bord = découpes des maquettes en images (réduites, légères).
5. Vérifier : dev-browser aux 3 largeurs contre les maquettes, puis `/impeccable audit` et `web-design-guidelines`.
6. Checklist T1-T4 à présenter AVANT de coder : T1 ordinateur fidèle, T2 iPhone + menu, T3 « Essai gratuit » → inscription factice, T4 fenêtre privée sans mot de passe = page cachée.
