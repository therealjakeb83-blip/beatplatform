-- Chantier préremplissage du paiement (2026-11-17)
-- Infos de paiement gardées sur le COMPTE Sonoo, seulement si le client a
-- coché « Se souvenir de mes infos pour mes achats dans les autres boutiques
-- Sonoo ». Sonoo est responsable de ces infos : table à part, jamais dans
-- `clients`, jamais tirée des fiches des boutiques (`leads`). Un seul jeu
-- d'infos par compte (le dernier paiement), effacé dès que la case est
-- décochée ou le compte supprimé. Lecture / écriture : clé de service seule.

BEGIN;

CREATE TABLE IF NOT EXISTS infos_paiement_compte (
  client_id          uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  prenom             text,
  nom                text,
  telephone          text,
  adresse            text,
  code_postal        text,
  ville              text,
  pays               text CHECK (pays IS NULL OR pays ~ '^[A-Z]{2}$'),
  raison_sociale     text,
  numero_tva         text,
  consenti_le        timestamptz NOT NULL DEFAULT now(),
  texte_consentement text        NOT NULL,
  maj_le             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE infos_paiement_compte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON infos_paiement_compte FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON infos_paiement_compte TO service_role;

COMMIT;

-- Vérification (onglet séparé) :
-- SELECT
--   (SELECT count(*) FROM infos_paiement_compte) AS lignes,
--   (SELECT relrowsecurity FROM pg_class WHERE relname = 'infos_paiement_compte') AS rls_active,
--   has_table_privilege('anon', 'infos_paiement_compte', 'SELECT') AS anon_lit,
--   has_table_privilege('authenticated', 'infos_paiement_compte', 'SELECT') AS connecte_lit,
--   has_table_privilege('service_role', 'infos_paiement_compte', 'SELECT') AS service_lit;
-- Attendu : 0 | true | false | false | true
