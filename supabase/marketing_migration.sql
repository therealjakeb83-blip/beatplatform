-- ============================================================
-- Étape 11d — Phase 4 : Marketing (Fondations + Campagnes)
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- ============================================================
-- SECTION 1 — Colonnes sur tables existantes
-- ============================================================

-- campagnes : contenu du mail (liste de blocs, format JSON) — manquait depuis la Phase 0
ALTER TABLE campagnes ADD COLUMN IF NOT EXISTS contenu jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS campagnes_statut_idx        ON campagnes (statut);
CREATE INDEX IF NOT EXISTS campagnes_scheduled_at_idx  ON campagnes (scheduled_at) WHERE statut = 'planifiee';

-- beatmakers : domaine d'envoi email personnalisé (option avancée, 4.5)
-- distinct de la colonne `domaine` existante (domaine boutique, non lié à l'email)
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS domaine_envoi_email    text;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS domaine_envoi_verifie  boolean NOT NULL DEFAULT false;


-- ============================================================
-- SECTION 2 — Nouvelle table : templates_email
-- Bibliothèque de mises en page réutilisables (officielles ou perso)
-- ============================================================

CREATE TABLE IF NOT EXISTS templates_email (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        REFERENCES beatmakers(id) ON DELETE CASCADE,
  source        text        NOT NULL CHECK (source IN ('plateforme', 'beatmaker')),
  nom           text        NOT NULL,
  categorie     text        NOT NULL CHECK (categorie IN ('newsletter', 'promotion', 'reactivation', 'annonce', 'abonnement')),
  objet_defaut  text,
  contenu       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (source = 'plateforme' AND beatmaker_id IS NULL) OR
    (source = 'beatmaker'  AND beatmaker_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS templates_email_beatmaker_idx ON templates_email (beatmaker_id);

-- Empêche les doublons si le seed de la SECTION 4 est relancé
CREATE UNIQUE INDEX IF NOT EXISTS templates_email_officiel_nom_idx
  ON templates_email (nom) WHERE source = 'plateforme';

ALTER TABLE templates_email ENABLE ROW LEVEL SECURITY;

-- Lecture : templates officiels visibles par tous, templates perso par leur propriétaire
CREATE POLICY "templates_email_select" ON templates_email
  FOR SELECT USING (source = 'plateforme' OR beatmaker_id = auth.uid());

-- Écriture : uniquement sur ses propres templates perso (jamais sur les officiels)
CREATE POLICY "templates_email_insert" ON templates_email
  FOR INSERT WITH CHECK (source = 'beatmaker' AND beatmaker_id = auth.uid());

CREATE POLICY "templates_email_update" ON templates_email
  FOR UPDATE USING (source = 'beatmaker' AND beatmaker_id = auth.uid());

CREATE POLICY "templates_email_delete" ON templates_email
  FOR DELETE USING (source = 'beatmaker' AND beatmaker_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON templates_email TO authenticated;
GRANT ALL ON templates_email TO service_role;


-- ============================================================
-- SECTION 3 — Nouvelle table : campagne_envois
-- Un email envoyé = une ligne. Sert au calcul des stats agrégées
-- (ouvertures/clics/désinscrits sur `campagnes`) et au suivi individuel.
-- ============================================================

CREATE TABLE IF NOT EXISTS campagne_envois (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id        uuid        NOT NULL REFERENCES campagnes(id) ON DELETE CASCADE,
  client_id          uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  resend_message_id  text,
  envoye_at          timestamptz NOT NULL DEFAULT now(),
  ouvert_at          timestamptz,
  clique_at          timestamptz,
  bounce             boolean     NOT NULL DEFAULT false,
  plainte            boolean     NOT NULL DEFAULT false,
  UNIQUE (campagne_id, client_id)
);

CREATE INDEX IF NOT EXISTS campagne_envois_campagne_idx ON campagne_envois (campagne_id);
CREATE INDEX IF NOT EXISTS campagne_envois_client_idx   ON campagne_envois (client_id);
CREATE INDEX IF NOT EXISTS campagne_envois_message_idx  ON campagne_envois (resend_message_id);

ALTER TABLE campagne_envois ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement par le beatmaker propriétaire de la campagne
-- Écriture : jamais côté client — toujours via l'API (admin client), donc pas de policy INSERT/UPDATE authenticated
CREATE POLICY "campagne_envois_select" ON campagne_envois
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campagnes c
      WHERE c.id = campagne_id AND c.beatmaker_id = auth.uid()
    )
  );

GRANT SELECT ON campagne_envois TO authenticated;
GRANT ALL    ON campagne_envois TO service_role;


-- ============================================================
-- SECTION 4 — Seed : 4 templates officiels
-- Repris de la maquette crm-proto (TEMPLATE_BLOCS)
-- ============================================================

INSERT INTO templates_email (source, nom, categorie, objet_defaut, contenu) VALUES

('plateforme', 'Newsletter beats', 'newsletter', '🎵 Nouveaux sons ce mois-ci', '[
  {"type": "header", "titre": "Nouveautés du mois", "couleur_fond": "#4f46e5"},
  {"type": "texte", "contenu": "Hey {{prénom}} ! Voici mes dernières productions, j''espère qu''elles vont te plaire 🎧"},
  {"type": "section_beats", "titre": "Réservé aux membres", "colonnes": 1, "source": "membres"},
  {"type": "section_beats", "titre": "Nouveautés", "colonnes": 2, "source": "nouveautes"}
]'::jsonb),

('plateforme', 'Promo flash', 'promotion', '⚡ Offre limitée sur mes beats', '[
  {"type": "header", "titre": "Offre flash", "couleur_fond": "#dc2626"},
  {"type": "texte", "contenu": "{{prénom}}, profite de cette offre avant qu''elle n''expire !"},
  {"type": "code_promo", "description": "Utilise ce code à la commande", "code": "{{code_promo}}"},
  {"type": "cta", "texte": "Voir les beats", "couleur": "#dc2626", "lien": "{{url_boutique}}"}
]'::jsonb),

('plateforme', 'Réactivation', 'reactivation', 'On ne t''a pas vu depuis un moment 👋', '[
  {"type": "header", "titre": "Tu nous manques !", "couleur_fond": "#0891b2"},
  {"type": "texte", "contenu": "Salut {{prénom}}, ça fait un moment ! Voici ce que tu as manqué récemment."},
  {"type": "section_beats", "titre": "Ce que tu as manqué", "colonnes": 2, "source": "nouveautes"},
  {"type": "code_promo", "description": "Un petit cadeau pour ton retour", "code": "{{code_promo}}"},
  {"type": "texte", "contenu": "À très vite !"}
]'::jsonb),

('plateforme', 'Annonce de sortie', 'annonce', '🔥 Nouveau son disponible', '[
  {"type": "header", "titre": "Nouvelle sortie", "couleur_fond": "#111827"},
  {"type": "texte", "contenu": "{{prénom}}, je viens de sortir un nouveau son, va checker ça !"},
  {"type": "section_beats", "titre": "Le nouveau son", "colonnes": 1, "source": "manuel"},
  {"type": "cta", "texte": "Écouter maintenant", "couleur": "#111827", "lien": "{{url_boutique}}"}
]'::jsonb)

ON CONFLICT (nom) WHERE source = 'plateforme' DO NOTHING;
