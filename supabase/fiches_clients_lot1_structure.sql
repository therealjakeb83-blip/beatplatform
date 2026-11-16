-- Rang 9d, lot 1 — SQL 1 : la fiche client PAR boutique = table `leads` enrichie
-- + fermeture de la faille « un beatmaker écrit dans leads depuis la console ».
--
-- Règles par champ (décision 6 du calibrage du 2026-11-12) :
--   accumulés        : emails (le 1er = principal), telephones, adresses (liste d'objets)
--   remplis une fois : prenom, nom, nom_artiste
--   dernière valeur  : pays, langue
--   figés            : source (existe déjà), premier_contact_le
--   beatmaker seul   : notes, tags, surnom, instagram, spotify, youtube, tiktok
--   la main du beatmaker gagne : champs_manuels = noms des champs modifiés à la
--                    main, que l'automatique ne touche plus jamais
-- Raison sociale / TVA / type de client restent sur la commande.
--
-- Une adresse = objet {"ligne": "...", "adresse"?, "code_postal"?, "ville"?, "pays"?}
-- (`ligne` = adresse sur une ligne, toujours présente, sert à éviter les doublons).
--
-- Prérequis : déploiement du commit 595eef1 (ajout manuel par la clé de service).

BEGIN;

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS emails             text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS telephones         text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS adresses           jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prenom             text,
  ADD COLUMN IF NOT EXISTS nom                text,
  ADD COLUMN IF NOT EXISTS nom_artiste        text,
  ADD COLUMN IF NOT EXISTS pays               text,
  ADD COLUMN IF NOT EXISTS langue             text,
  ADD COLUMN IF NOT EXISTS premier_contact_le timestamptz,
  ADD COLUMN IF NOT EXISTS notes              text,
  ADD COLUMN IF NOT EXISTS tags               text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS surnom             text,
  ADD COLUMN IF NOT EXISTS instagram          text,
  ADD COLUMN IF NOT EXISTS spotify            text,
  ADD COLUMN IF NOT EXISTS youtube            text,
  ADD COLUMN IF NOT EXISTS tiktok             text,
  ADD COLUMN IF NOT EXISTS champs_manuels     text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reconstruite_le    timestamptz;

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_adresses_liste;
ALTER TABLE leads ADD CONSTRAINT leads_adresses_liste CHECK (jsonb_typeof(adresses) = 'array');

-- Faille : avec les règles *_own et les droits d'écriture, un beatmaker connecté
-- pouvait créer une ligne « ce client est chez moi » pour n'importe quel client
-- (ou changer le client d'une de ses lignes) depuis la console, et la garde
-- d'appartenance du lot 0 lui ouvrait alors la fiche. Toutes les écritures
-- passent par la clé de service ; la lecture de SES lignes reste permise
-- (Contacts, Doublons, Listes, Fusion la font avec la session).
DROP POLICY IF EXISTS leads_insert_own ON leads;
DROP POLICY IF EXISTS leads_update_own ON leads;
DROP POLICY IF EXISTS leads_delete_own ON leads;
REVOKE ALL ON leads FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON leads FROM authenticated;
GRANT SELECT ON leads TO authenticated;
GRANT ALL ON leads TO service_role;

COMMIT;
