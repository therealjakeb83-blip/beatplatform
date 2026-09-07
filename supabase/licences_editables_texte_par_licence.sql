-- ============================================================
-- Chantier 9 bis, Phase 6 — Licences éditables
-- Étape 6 : le texte devient éditable par licence individuelle, plus par
-- catégorie partagée (MP3/WAV/STEMS utilisaient le même texte jusqu'ici)
-- ============================================================
-- Décision de Jake (2026-09-07) : même si MP3/WAV/STEMS partagent le même
-- modèle par défaut, chaque licence doit pouvoir être éditée
-- individuellement, avec un bouton "réinitialiser au modèle par défaut"
-- propre à chaque licence.
--
-- La table licences_textes (créée à l'étape 3a, clé beatmaker_id+
-- type_licence) est vide — vérifié avant de la restructurer, aucune
-- donnée à migrer. Recréée avec licence_id comme clé.

DROP TABLE IF EXISTS licences_textes;

CREATE TABLE licences_textes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  licence_id    uuid        NOT NULL UNIQUE REFERENCES licences(id) ON DELETE CASCADE,
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  contenu       text        NOT NULL,
  version       integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE licences_textes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licences_textes_beatmaker_own" ON licences_textes
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON licences_textes TO authenticated;
GRANT ALL ON licences_textes TO service_role;

COMMENT ON TABLE licences_textes IS
  'Contenu éditable du texte de licence, par licence individuelle (licences.id) — Phase 6 refonte 9 bis. Sans ligne = modèle My Producer par défaut pour la catégorie (lib/licences-textes.ts, selon licences.modele).';
