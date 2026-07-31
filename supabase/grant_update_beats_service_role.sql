-- Suite de grant_insert_beats_service_role.sql : service_role avait SELECT+INSERT
-- mais pas UPDATE sur public.beats. Nécessaire pour les scripts admin ponctuels
-- (ex. mettre à jour mis_en_avant ou soft-delete via supprime_le).

GRANT UPDATE ON public.beats TO service_role;
