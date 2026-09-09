-- ============================================================
-- Phase 8 (suite) — numéro de TVA du vendeur sur la facture, snapshoté
-- au moment de la vente (même principe que commandes.tva_taux, Phase 4).
-- ============================================================

alter table commandes add column if not exists tva_numero text;

comment on column commandes.tva_numero is
  'Numéro de TVA intracommunautaire du beatmaker au moment de cette vente (snapshot transactionnel, même principe que tva_taux) — NULL si TVA non applicable à cette vente. Affiché sur la facture PDF.';
