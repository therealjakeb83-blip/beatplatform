-- Fix : service_role a besoin de grants explicites sur licence_downloads
-- (même pattern que service_role_grants.sql pour les autres tables)
GRANT SELECT, INSERT ON licence_downloads TO service_role;
