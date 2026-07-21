-- ============================================================
-- ÉTAPE 5v2 — Radius de carte figé sur "doux", plus personnalisable
-- ============================================================
-- Jake a demandé de retirer la personnalisation du radius de carte : toutes
-- les boutiques utilisent désormais "doux" (10px), codé en dur côté app
-- (app/[slug]/_components/BoutiqueThemeRoot.tsx). La colonne devient inutile.

alter table beatmakers drop column if exists theme_radius;
