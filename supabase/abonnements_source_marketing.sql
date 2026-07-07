-- Source marketing des abonnements (jamais trackée jusqu'ici, contrairement
-- aux achats de beat) — stockée sur l'abonnement à sa création, réutilisée
-- pour chaque commande (création + renouvellements).
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS source_marketing text;
