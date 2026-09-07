-- ============================================================
-- Chantier 9 bis, Phase 6 — Licences éditables
-- Étape 5 : interdire l'ajout en favoris d'un beat vendu en Exclusive
-- ============================================================
-- Le bouton favori (app/[slug]/_components/FavoriButton.tsx) insère
-- directement depuis le client, sans passer par une route serveur — RLS
-- est donc la seule barrière réelle. La page de détail d'un beat 'vendu'
-- renvoie déjà un 404 (app/[slug]/[beatId]/page.tsx filtre sur
-- statut in ('public','prive')), mais ça ne protège pas un appel direct.
--
-- Les favoris déjà existants sur un beat qui devient 'vendu' après coup
-- ne sont volontairement pas supprimés (rien demandé par Jake) — seule la
-- création d'un nouveau favori est bloquée.

DROP POLICY IF EXISTS "favoris_insert_own" ON favoris;

CREATE POLICY "favoris_insert_own" ON favoris
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (SELECT 1 FROM beats WHERE beats.id = beat_id AND beats.statut != 'vendu')
  );
