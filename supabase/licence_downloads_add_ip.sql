-- Ajouter la colonne ip_address à licence_downloads
ALTER TABLE licence_downloads ADD COLUMN IF NOT EXISTS ip_address text;
