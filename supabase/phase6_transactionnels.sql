-- ============================================================
-- PHASE 6 — Mailing : Transactionnels
-- ============================================================
-- Comble un vrai trou produit : aucun email de confirmation n'est
-- envoyé après un achat ou un abonnement (seuls les emails de
-- splits/collab existent dans lib/emails.ts). Voir ROADMAP.md,
-- 11d Phase 6, et memory/... pour le détail des décisions.

-- ============================================================
-- 1. Couleur de marque — branding global de la boutique, partagé
--    par les 3 (bientôt 4) emails transactionnels. Réutilise
--    logo_url et signature_emails déjà existants sur beatmakers
--    pour rester cohérent avec le reste de la plateforme (Campagnes,
--    Automatisations) plutôt que de dupliquer le branding par type.
-- ============================================================

ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS couleur_marque text;

-- ============================================================
-- 2. TABLE : templates_transactionnels
--    Une ligne par (beatmaker, type) si le beatmaker personnalise
--    l'intro de cet email — absence de ligne = fallback par défaut.
--    Sur le modèle de la table `automatisations` (Phase 5).
-- ============================================================

CREATE TABLE IF NOT EXISTS templates_transactionnels (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id) ON DELETE CASCADE,
  type          text        NOT NULL CHECK (type IN (
                  'confirmation_commande',
                  'confirmation_abonnement',
                  'annulation_abonnement',
                  'beat_cadeau_fidelite'
                )),
  intro         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (beatmaker_id, type)
);

ALTER TABLE templates_transactionnels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_transactionnels_select" ON templates_transactionnels
  FOR SELECT USING (beatmaker_id = auth.uid());
CREATE POLICY "templates_transactionnels_insert" ON templates_transactionnels
  FOR INSERT WITH CHECK (beatmaker_id = auth.uid());
CREATE POLICY "templates_transactionnels_update" ON templates_transactionnels
  FOR UPDATE USING (beatmaker_id = auth.uid());
CREATE POLICY "templates_transactionnels_delete" ON templates_transactionnels
  FOR DELETE USING (beatmaker_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON templates_transactionnels TO authenticated;
GRANT ALL ON templates_transactionnels TO service_role;
