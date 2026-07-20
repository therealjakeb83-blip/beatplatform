-- ============================================================
-- ÉTAPE 5v2 — Personnalisation boutique (hero éditable + thème couleur)
-- ============================================================
-- Onglet /dashboard/business/personnalisation : hero_titre/hero_sous_titre
-- éditables avec défaut auto-généré, + choix du thème couleur parmi 4
-- (blue/red/green/purple) appliqué via data-shop-theme sur la boutique
-- publique. Pas de policy RLS supplémentaire : les policies `beatmakers`
-- existantes couvrent déjà select public / update propriétaire.

alter table beatmakers add column if not exists hero_titre text;
alter table beatmakers add column if not exists hero_sous_titre text;

alter table beatmakers add column if not exists theme_couleur text not null default 'blue'
  check (theme_couleur in ('blue', 'red', 'green', 'purple'));
