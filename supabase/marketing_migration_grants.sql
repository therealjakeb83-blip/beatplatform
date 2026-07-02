-- ============================================================
-- Étape 11d — Phase 4 : Marketing — complément GRANT service_role
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- ============================================================

-- `campagnes` n'avait jamais eu de GRANT service_role (seulement authenticated,
-- accordé dès la Phase 0) — lib/mailing.ts utilise le client admin (service_role)
-- pour lire/mettre à jour les campagnes lors de l'envoi. Sans ce GRANT, Postgres
-- refuse l'accès avec "permission denied for table campagnes" (code 42501).
GRANT SELECT, UPDATE ON public.campagnes TO service_role;

-- Même trou pour les Listes CRM : lib/mailing.ts lit listes_crm_contacts
-- via le client admin pour résoudre les destinataires en mode "liste".
GRANT SELECT ON public.listes_crm TO service_role;
GRANT SELECT ON public.listes_crm_contacts TO service_role;
