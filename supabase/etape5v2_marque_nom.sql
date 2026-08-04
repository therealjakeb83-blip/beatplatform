-- ============================================================
-- ÉTAPE 5v2 — Marque de boutique : logo OU nom écrit
-- ============================================================
-- Le beatmaker peut afficher son logo (comportement actuel, défaut) ou son
-- pseudonyme écrit en toutes lettres dans le header/footer de la boutique.
-- Le style typographique n'a de sens que si marque_affichage = 'nom' (géré
-- côté UI, pas de contrainte croisée en base).

alter table beatmakers add column if not exists marque_affichage text not null default 'logo'
  check (marque_affichage in ('logo', 'nom'));

alter table beatmakers add column if not exists style_nom_marque text not null default 'hero'
  check (style_nom_marque in ('hero', 'grotesque', 'condense', 'massif', 'moderne', 'espace'));
