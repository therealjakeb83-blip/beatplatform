-- ============================================================
-- PHASE 6 — Nouveau type transactionnel : demande_annulation_abonnement
-- ============================================================
-- Migration additive sur le CHECK existant (même pattern que Phase 5).
-- Découvert en testant : le client n'était notifié qu'à la fin RÉELLE de la
-- période (customer.subscription.deleted, parfois des semaines plus tard),
-- jamais au moment où il annule — aucune confirmation immédiate, aucune date
-- de fin d'accès. Ce nouveau type comble ce trou (voir lib/emails.ts,
-- confirmationDemandeAnnulation). annulation_abonnement reste, mais restreint
-- au cas où aucune demande n'a précédé la suppression (ex. abo impayé
-- résilié directement, sans jamais passer par cancel_at_period_end).

ALTER TABLE templates_transactionnels DROP CONSTRAINT templates_transactionnels_type_check;
ALTER TABLE templates_transactionnels ADD CONSTRAINT templates_transactionnels_type_check
  CHECK (type IN (
    'confirmation_commande',
    'confirmation_abonnement',
    'demande_annulation_abonnement',
    'annulation_abonnement',
    'beat_cadeau_fidelite'
  ));

-- Dédoublonnage de l'email "demande d'annulation" (voir lib/emails.ts,
-- confirmationDemandeAnnulation, et le webhook traiterMajAbonnement) — écrit
-- uniquement par ce webhook, jamais par une route synchrone, donc sans la
-- race qui empêche une détection de transition sur annulation_en_cours.
ALTER TABLE abonnements_boutique ADD COLUMN IF NOT EXISTS demande_annulation_notifiee boolean NOT NULL DEFAULT false;
