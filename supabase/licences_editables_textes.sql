-- ============================================================
-- Chantier 9 bis, Phase 6 — Licences éditables
-- Étape 3a : stockage du texte éditable des licences
-- ============================================================
-- Un texte par catégorie de licence (pas par licence individuelle) :
-- 'standard' couvre MP3/WAV/STEMS (même modèle contractuel, seules les
-- variables de limites/fichiers changent), 'illimite' et 'exclusive'
-- auront leur propre texte, travaillés dans une étape séparée.
--
-- Même principe que boutique_pages_legales (Phase 1) : le beatmaker peut
-- adopter le modèle par défaut de My Producer tel quel, le modifier
-- librement, ou repartir de zéro. Sans ligne = modèle par défaut utilisé
-- silencieusement (contrairement aux pages légales publiques, un contrat
-- de licence doit toujours exister au moment d'une vente — pas de gate
-- "Contenu à compléter.").
--
-- Contrairement aux pages légales (variables résolues et figées au moment
-- de l'enregistrement dans le dashboard), le contenu ici reste au format
-- brut avec ses {{variables}} non résolues : une bonne partie d'entre
-- elles (prix payé, acheteur, titre du beat...) ne sont connues qu'au
-- moment de la vente, pas au moment où le beatmaker édite son texte. La
-- résolution complète n'a lieu qu'une seule fois, à la génération du PDF
-- de contrat — qui est ensuite stocké définitivement (contrat_pdf_url),
-- donc aucun besoin de snapshoter une version ici comme pour les CGV.

CREATE TABLE IF NOT EXISTS licences_textes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  type_licence  text        NOT NULL CHECK (type_licence IN ('standard', 'illimite', 'exclusive')),
  contenu       text        NOT NULL,
  version       integer     NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS licences_textes_beatmaker_type_unique
  ON licences_textes (beatmaker_id, type_licence);

ALTER TABLE licences_textes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licences_textes_beatmaker_own" ON licences_textes
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON licences_textes TO authenticated;
GRANT ALL ON licences_textes TO service_role;

COMMENT ON TABLE licences_textes IS
  'Contenu éditable du texte de licence par catégorie (standard/illimite/exclusive) et par beatmaker — Phase 6 refonte 9 bis. Sans ligne = modèle My Producer par défaut (lib/licences-textes.ts).';
