-- ============================================================
-- ÉTAPE 5v2 — Design system définitif : accent hex libre + radius
-- ============================================================
-- Remplace les 4 thèmes couleur fixes (blue/red/green/purple) par un accent
-- hex libre (7 presets + hex custom, voir tokens/tokens.json du dossier de
-- design) et ajoute le radius de carte configurable (arrondi/doux/carré).
-- Les dérivations (--ac-soft/--ac-deep/--g1/--g2/--glow1/--glow2) sont
-- calculées en CSS (oklch relative color) + côté client pour les cas
-- particuliers de teinte — voir app/[slug]/_lib/theme-accent.ts.

-- La contrainte doit tomber AVANT l'update : elle n'autorise aujourd'hui que
-- 'blue'/'red'/'green'/'purple', donc écrire un hex dedans échouerait sinon
-- (c'est exactement l'erreur obtenue au premier essai de cette migration).
alter table beatmakers drop constraint if exists beatmakers_theme_couleur_check;

update beatmakers set theme_couleur = case theme_couleur
  when 'blue' then '#2E4CF0'
  when 'red' then '#E11D48'
  when 'green' then '#10B981'
  when 'purple' then '#7C3AED'
  else theme_couleur
end
where theme_couleur in ('blue', 'red', 'green', 'purple');

alter table beatmakers alter column theme_couleur set default '#2E4CF0';

alter table beatmakers add constraint beatmakers_theme_couleur_check
  check (theme_couleur ~ '^#[0-9A-Fa-f]{6}$');

alter table beatmakers add column if not exists theme_radius text not null default 'arrondi'
  check (theme_radius in ('arrondi', 'doux', 'carre'));
