-- ============================================================
-- PHASE 2 (refonte 9 bis) — Moyens de paiement (Niveau A)
-- ============================================================
-- Catégorie à substance commerciale, réglable par le beatmaker (carte
-- toujours active, PayPal/virement optionnels) — voir lib/moyens-paiement.ts
-- pour la couche de mapping vers les paramètres techniques Stripe (Niveau B).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers
  add column if not exists moyens_paiement_acceptes text[] not null default array['carte'];
