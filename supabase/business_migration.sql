-- ============================================================
-- Étape 11d — Outil Business : migration Foundation
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- ============================================================
-- SECTION 1 — Colonnes sur tables existantes
-- ============================================================

-- clients : réseaux sociaux additionnels + notes + tags
ALTER TABLE clients ADD COLUMN IF NOT EXISTS spotify text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS youtube text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tiktok  text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes   text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tags    text[] NOT NULL DEFAULT '{}';

-- beats : couleur pour affichage UI
ALTER TABLE beats ADD COLUMN IF NOT EXISTS couleur text;

-- commandes : notes internes du beatmaker
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS notes jsonb;

-- abonnements_boutique : suivi essai et annulation
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS fin_essai           timestamptz;
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS annulation_en_cours boolean NOT NULL DEFAULT false;


-- ============================================================
-- SECTION 2 — Nouvelle table : codes_promo
-- ============================================================

CREATE TABLE IF NOT EXISTS codes_promo (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id             uuid        NOT NULL REFERENCES beatmakers(id),
  code                     text        NOT NULL,
  description              text,
  type_remise              text        NOT NULL CHECK (type_remise IN ('panier', 'produit', 'abonnement')),
  type_valeur              text        NOT NULL CHECK (type_valeur IN ('pourcentage', 'montant')),
  valeur                   numeric     NOT NULL,
  mensualites              integer,
  date_debut               timestamptz,
  date_expiration          timestamptz,
  depense_min              numeric,
  depense_max              numeric,
  premiere_commande        boolean     NOT NULL DEFAULT false,
  utilisation_individuelle boolean     NOT NULL DEFAULT false,
  exclure_promotions       boolean     NOT NULL DEFAULT false,
  beats_inclus             uuid[],
  beats_exclus             uuid[]      NOT NULL DEFAULT '{}',
  licences_eligibles       text[],
  emails_autorises         text[]      NOT NULL DEFAULT '{}',
  emails_exclus            text[]      NOT NULL DEFAULT '{}',
  limite_par_code          integer,
  limite_par_article       integer,
  limite_par_utilisateur   integer,
  utilisations             integer     NOT NULL DEFAULT 0,
  statut                   text        NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'expire')),
  stripe_coupon_id         text,
  stripe_promotion_code_id text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (beatmaker_id, code)
);

CREATE INDEX IF NOT EXISTS codes_promo_beatmaker_idx ON codes_promo (beatmaker_id);

ALTER TABLE codes_promo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "codes_promo_beatmaker_own" ON codes_promo
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON codes_promo TO authenticated;


-- ============================================================
-- SECTION 3 — Nouvelle table : listes_contacts
-- ============================================================

CREATE TABLE IF NOT EXISTS listes_contacts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id uuid        NOT NULL REFERENCES beatmakers(id),
  nom          text        NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS listes_contacts_beatmaker_idx ON listes_contacts (beatmaker_id);

ALTER TABLE listes_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listes_contacts_beatmaker_own" ON listes_contacts
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON listes_contacts TO authenticated;


-- ============================================================
-- SECTION 4 — Nouvelle table : liste_membres
-- ============================================================

CREATE TABLE IF NOT EXISTS liste_membres (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  liste_id  uuid        NOT NULL REFERENCES listes_contacts(id) ON DELETE CASCADE,
  client_id uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  added_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (liste_id, client_id)
);

CREATE INDEX IF NOT EXISTS liste_membres_liste_idx   ON liste_membres (liste_id);
CREATE INDEX IF NOT EXISTS liste_membres_client_idx  ON liste_membres (client_id);

ALTER TABLE liste_membres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liste_membres_beatmaker_own" ON liste_membres
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM listes_contacts l
      WHERE l.id = liste_id AND l.beatmaker_id = auth.uid()
    )
  );

GRANT ALL ON liste_membres TO authenticated;


-- ============================================================
-- SECTION 5 — Nouvelle table : campagnes
-- ============================================================

CREATE TABLE IF NOT EXISTS campagnes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id),
  nom           text        NOT NULL,
  objet         text,
  segment_slug  text,
  statut        text        NOT NULL DEFAULT 'brouillon'
                            CHECK (statut IN ('brouillon', 'planifiee', 'envoyee')),
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  destinataires integer     NOT NULL DEFAULT 0,
  ouvertures    integer     NOT NULL DEFAULT 0,
  clics         integer     NOT NULL DEFAULT 0,
  conversions   integer     NOT NULL DEFAULT 0,
  desinscrits   integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campagnes_beatmaker_idx ON campagnes (beatmaker_id);

ALTER TABLE campagnes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campagnes_beatmaker_own" ON campagnes
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON campagnes TO authenticated;


-- ============================================================
-- SECTION 6 — Nouvelle table : free_downloads
-- ============================================================

CREATE TABLE IF NOT EXISTS free_downloads (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id  uuid        NOT NULL REFERENCES beatmakers(id),
  client_id     uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  beat_id       uuid        NOT NULL REFERENCES beats(id) ON DELETE CASCADE,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  achete        boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS free_downloads_beatmaker_idx ON free_downloads (beatmaker_id);
CREATE INDEX IF NOT EXISTS free_downloads_client_idx    ON free_downloads (client_id);

ALTER TABLE free_downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "free_downloads_beatmaker_own" ON free_downloads
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON free_downloads TO authenticated;


-- ============================================================
-- SECTION 7 — Nouvelle table : morceaux_clients
-- ============================================================

CREATE TABLE IF NOT EXISTS morceaux_clients (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  beatmaker_id uuid        NOT NULL REFERENCES beatmakers(id),
  client_id    uuid        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  titre        text        NOT NULL,
  lien_spotify text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS morceaux_clients_beatmaker_idx ON morceaux_clients (beatmaker_id);
CREATE INDEX IF NOT EXISTS morceaux_clients_client_idx    ON morceaux_clients (client_id);

ALTER TABLE morceaux_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "morceaux_clients_beatmaker_own" ON morceaux_clients
  FOR ALL USING (beatmaker_id = auth.uid());

GRANT ALL ON morceaux_clients TO authenticated;
