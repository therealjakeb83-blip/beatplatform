-- Ajouter le statut 'refuse' pour les collaborations refusées
ALTER TABLE beat_splits
  DROP CONSTRAINT beat_splits_statut_check,
  ADD CONSTRAINT beat_splits_statut_check CHECK (statut IN ('actif', 'en_attente', 'refuse'));

-- Service role doit pouvoir écrire sur beat_splits (accepter/refuser via API)
GRANT ALL ON public.beat_splits TO service_role;
