-- ============================================================
-- PHASE 2 (refonte 9 bis) — Identité sur le relevé bancaire
-- ============================================================
-- Statement descriptor du beatmaker — poussé vers le compte Stripe Connect
-- (settings.payments.statement_descriptor) dès qu'il est sauvegardé et que
-- stripe_account_id existe. Voir lib/statement-descriptor.ts pour la
-- validation.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers add column if not exists statement_descriptor text;
