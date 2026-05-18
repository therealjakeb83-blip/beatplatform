-- Grants SELECT pour le client admin (service_role) utilisé par le webhook et les pages serveur
-- Nécessaire car service_role bypasse RLS mais a besoin de grants table-level explicites

GRANT SELECT ON public.beats TO service_role;
GRANT SELECT ON public.licences TO service_role;
GRANT SELECT ON public.beatmakers TO service_role;
GRANT SELECT ON public.beat_splits TO service_role;

-- commandes : déjà ajouté lors de l'étape 6
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.commandes TO service_role;
