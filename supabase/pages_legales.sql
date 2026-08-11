-- ============================================================
-- Étape 1 (refonte article 9 bis) — Pages légales boutique réelles
-- ============================================================
-- Les pages CGV / mentions légales / confidentialité / contact / plan de
-- site de app/[slug]/** sont aujourd'hui des coquilles vides ("Contenu à
-- compléter."), sur toutes les boutiques. Ce trou est antérieur et
-- indépendant du sujet 9 bis (voir audit du 2026-08-08) mais reste la
-- priorité la plus urgente du plan de refonte.
--
-- Un beatmaker peut adopter le contenu par défaut proposé par My Producer
-- (lib/pages-legales.ts) tel quel, le modifier, ou repartir de zéro. Une
-- seule ligne par (beatmaker_id, type_page) — version incrémentée et
-- adopte_le réhorodaté à chaque enregistrement.
--
-- Distinct de beatmakers.cgv_acceptees_at, qui concerne l'acceptation des
-- CGV DE MY PRODUCER par le beatmaker (relation SaaS), pas les CGV que le
-- beatmaker publie vers ses propres clients.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

CREATE TABLE IF NOT EXISTS boutique_pages_legales (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  type_page     text        NOT NULL CHECK (type_page IN ('cgv', 'mentions_legales', 'confidentialite', 'contact', 'plan_de_site')),
  contenu       text        NOT NULL,
  version       integer     NOT NULL DEFAULT 1,
  adopte_le     timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS boutique_pages_legales_beatmaker_type_unique
  ON boutique_pages_legales (beatmaker_id, type_page);

ALTER TABLE boutique_pages_legales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boutique_pages_legales_beatmaker_own" ON boutique_pages_legales
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON boutique_pages_legales TO authenticated;
GRANT ALL ON boutique_pages_legales TO service_role;

COMMENT ON TABLE boutique_pages_legales IS
  'Contenu réel des pages CGV/mentions légales/confidentialité/contact/plan de site par boutique — adopté explicitement par le beatmaker (Phase 1 refonte 9 bis, 2026-08-08). Sans ligne = template My Producer affiché par défaut (lib/pages-legales.ts).';
