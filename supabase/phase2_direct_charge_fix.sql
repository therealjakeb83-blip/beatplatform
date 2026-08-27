-- ============================================================
-- PHASE 2 (refonte 9 bis) — correction : payment_intent_id redondant
-- ============================================================
-- `commandes.stripe_payment_id` capture déjà le payment_intent (checkout
-- classique ET achat express) depuis bien avant ce chantier — la colonne
-- `payment_intent_id` ajoutée dans phase2_direct_charge.sql dupliquait
-- exactement la même information, jamais écrite nulle part. Retirée avant
-- qu'elle ne devienne une vraie coquille (colonne qui a l'air d'exister
-- mais n'est jamais remplie).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table commandes drop column if exists payment_intent_id;
