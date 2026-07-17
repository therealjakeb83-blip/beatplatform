-- ============================================================
-- PHASE 7 — Catégories & Certification
-- ============================================================
-- Remplace les 4 listes hardcodées de BeatForm.tsx (STYLES_OPTIONS,
-- AMBIANCES_OPTIONS, INSTRUMENTS_OPTIONS, TYPE_BEAT_OPTIONS) par une table.
-- Ambiances/Instruments restent en lecture seule (source=plateforme
-- uniquement). Styles/Type beat en mode hybride : un beatmaker peut ajouter
-- les siennes (source=beatmaker, visibles seulement par lui) et demander
-- leur certification pour les rendre globales et non modifiables.
-- Décisions prises le 2026-07-02, voir ROADMAP.md Phase 7 et
-- memory/project_mailing_categories_planning.md.

CREATE TABLE IF NOT EXISTS categories (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type          text        NOT NULL CHECK (type IN ('styles', 'ambiances', 'instruments', 'type_beat')),
  nom           text        NOT NULL,
  source        text        NOT NULL CHECK (source IN ('plateforme', 'beatmaker')),
  beatmaker_id  uuid        REFERENCES beatmakers(id) ON DELETE CASCADE,
  statut        text        NOT NULL DEFAULT 'active' CHECK (statut IN ('active', 'en_attente_certification', 'certifiee')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'plateforme' AND beatmaker_id IS NULL) OR (source = 'beatmaker' AND beatmaker_id IS NOT NULL))
);

-- Deux index uniques séparés : NULL n'est jamais égal à NULL dans un index
-- unique, donc (type, nom, beatmaker_id) seul laisserait passer des doublons
-- plateforme (beatmaker_id toujours NULL côté plateforme) — d'où l'index
-- partiel dédié. Le second N'EST PAS partiel (pas de clause WHERE) : upsert()
-- côté client (lib/categories.ts) infère sa cible ON CONFLICT sur
-- (type, nom, beatmaker_id) telles quelles, ce qui ne matche qu'un index
-- plein, pas un index partiel — sans incidence sur les lignes plateforme
-- (beatmaker_id NULL n'est jamais bloqué par un index unique classique).
CREATE UNIQUE INDEX IF NOT EXISTS categories_plateforme_unique
  ON categories (type, nom) WHERE beatmaker_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS categories_beatmaker_unique
  ON categories (type, nom, beatmaker_id);

CREATE INDEX IF NOT EXISTS categories_type_idx ON categories (type);
CREATE INDEX IF NOT EXISTS categories_statut_idx ON categories (statut) WHERE statut = 'en_attente_certification';

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Visible : tout le catalogue plateforme + ses propres catégories + tout ce
-- qui est certifié (devenu global, quel que soit le beatmaker d'origine).
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (source = 'plateforme' OR beatmaker_id = auth.uid() OR statut = 'certifiee');

CREATE POLICY "categories_insert" ON categories
  FOR INSERT WITH CHECK (beatmaker_id = auth.uid() AND source = 'beatmaker');

-- WITH CHECK interdit explicitement de passer directement à 'certifiee' —
-- seule la modération (service_role) peut certifier, jamais le beatmaker
-- lui-même via une requête RLS.
CREATE POLICY "categories_update" ON categories
  FOR UPDATE USING (beatmaker_id = auth.uid() AND source = 'beatmaker')
  WITH CHECK (beatmaker_id = auth.uid() AND source = 'beatmaker' AND statut IN ('active', 'en_attente_certification'));

CREATE POLICY "categories_delete" ON categories
  FOR DELETE USING (beatmaker_id = auth.uid() AND source = 'beatmaker' AND statut = 'active');

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT ALL ON categories TO service_role;

-- ============================================================
-- Seed : les 4 listes hardcodées de BeatForm.tsx, en source=plateforme
-- ============================================================

INSERT INTO categories (type, nom, source) VALUES
  ('type_beat', 'SCH', 'plateforme'),
  ('type_beat', 'Werenoi', 'plateforme'),
  ('type_beat', 'Zamdane', 'plateforme'),
  ('type_beat', 'Tiakola', 'plateforme'),
  ('type_beat', 'Gazo', 'plateforme'),
  ('type_beat', 'SDM', 'plateforme'),
  ('type_beat', 'Hamza', 'plateforme'),
  ('type_beat', 'Niaks', 'plateforme'),
  ('type_beat', 'Makar', 'plateforme'),
  ('type_beat', 'Ven1', 'plateforme'),
  ('type_beat', 'Bouss', 'plateforme'),
  ('type_beat', 'Ninho', 'plateforme'),
  ('type_beat', 'Damso', 'plateforme'),
  ('type_beat', 'Saïf', 'plateforme'),
  ('type_beat', 'Timar', 'plateforme'),
  ('type_beat', 'Green Montana', 'plateforme'),
  ('type_beat', 'Lacrim', 'plateforme'),
  ('type_beat', 'Vacra', 'plateforme'),
  ('type_beat', 'US Type Beat', 'plateforme')
ON CONFLICT DO NOTHING;

INSERT INTO categories (type, nom, source) VALUES
  ('styles', 'Trap', 'plateforme'),
  ('styles', 'Drill', 'plateforme'),
  ('styles', 'UK Drill', 'plateforme'),
  ('styles', 'Afro Trap', 'plateforme'),
  ('styles', 'Afrobeat', 'plateforme'),
  ('styles', 'R&B', 'plateforme'),
  ('styles', 'Pop', 'plateforme'),
  ('styles', 'Boom Bap', 'plateforme'),
  ('styles', 'Lo-Fi', 'plateforme'),
  ('styles', 'Dancehall', 'plateforme'),
  ('styles', 'Reggaeton', 'plateforme'),
  ('styles', 'Cloud Rap', 'plateforme'),
  ('styles', 'Pluggnb', 'plateforme'),
  ('styles', 'Jersey Club', 'plateforme')
ON CONFLICT DO NOTHING;

INSERT INTO categories (type, nom, source) VALUES
  ('ambiances', 'Dark', 'plateforme'),
  ('ambiances', 'Chill', 'plateforme'),
  ('ambiances', 'Energetic', 'plateforme'),
  ('ambiances', 'Mélancolique', 'plateforme'),
  ('ambiances', 'Hype', 'plateforme'),
  ('ambiances', 'Romantique', 'plateforme'),
  ('ambiances', 'Mystérieux', 'plateforme'),
  ('ambiances', 'Épique', 'plateforme'),
  ('ambiances', 'Festif', 'plateforme'),
  ('ambiances', 'Introspectif', 'plateforme')
ON CONFLICT DO NOTHING;

INSERT INTO categories (type, nom, source) VALUES
  ('instruments', 'Piano', 'plateforme'),
  ('instruments', 'Guitare', 'plateforme'),
  ('instruments', 'Cordes', 'plateforme'),
  ('instruments', '808', 'plateforme'),
  ('instruments', 'Flûte', 'plateforme'),
  ('instruments', 'Violon', 'plateforme'),
  ('instruments', 'Basse', 'plateforme'),
  ('instruments', 'Synthé', 'plateforme'),
  ('instruments', 'Cuivres', 'plateforme'),
  ('instruments', 'Harpe', 'plateforme'),
  ('instruments', 'Orgue', 'plateforme'),
  ('instruments', 'Marimba', 'plateforme')
ON CONFLICT DO NOTHING;
