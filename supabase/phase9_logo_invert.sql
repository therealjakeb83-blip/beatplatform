-- ============================================================
-- Logo blanc sur fond clair — réglage pour l'inverser automatiquement là où
-- le fond est toujours blanc (page de paiement, factures PDF), quel que
-- soit le thème choisi par le beatmaker pour sa boutique.
-- ============================================================

alter table beatmakers add column if not exists logo_inverser_fond_clair boolean not null default false;

comment on column beatmakers.logo_inverser_fond_clair is
  'Si true, le logo est affiché inversé (CSS filter:invert côté web, sharp .negate() côté PDF) partout où le fond est toujours blanc — pensé pour un logo conçu blanc sur fond sombre.';
