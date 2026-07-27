-- ============================================================
-- "Mails My Producer" (2026-07-27) — emails transactionnels
-- plateforme → beatmaker (bienvenue, confirmation essai, rappel fin
-- d'essai, paiement échoué, annulation). Inexistants jusqu'ici malgré
-- la table abonnements_plateforme présente depuis le schéma d'origine.
-- ============================================================
-- Suivi du rappel de fin d'essai (J-3) pour que le cron quotidien
-- (/api/cron/plateforme-rappels) ne renvoie jamais deux fois le même
-- rappel — une seule colonne suffit, pas besoin d'une table à part.

alter table abonnements_plateforme add column if not exists rappel_essai_envoye_le timestamptz;
