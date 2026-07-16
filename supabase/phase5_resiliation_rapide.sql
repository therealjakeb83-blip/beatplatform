-- ============================================================
-- PHASE 5.9 — Combo "Abo résilié rapidement" (révision de la décision #2)
-- ============================================================
-- Le scénario A+C (bienvenue abo + churn le même jour) partait en silence
-- total (docs/automatisations/combinaisons-5.7.md, décision initiale du
-- 2026-07-14). Révisé le 2026-07-16 : Jake préfère relancer le client pour
-- comprendre pourquoi il a résilié aussi vite. Nouveau type de combo, même
-- principe que les combos achat+abo : jamais déposé comme événement brut
-- dans `automatisation_evenements` (dérivé à la résolution depuis
-- bienvenue_abonnement + churn_message_perso), donc migration additive sur
-- le CHECK de `automatisations` uniquement.

ALTER TABLE automatisations DROP CONSTRAINT automatisations_type_check;
ALTER TABLE automatisations ADD CONSTRAINT automatisations_type_check
  CHECK (type IN (
    'bienvenue_abonnement', 'abonnement_en_attente', 'churn_message_perso',
    'remerciement_1er_achat', 'remerciement_2e_achat', 'remerciement_3e_achat', 'remerciement_4e_achat_plus',
    'bienvenue_perso', 'relance_inactivite', 'follow_up_free_download', 'follow_up_favori',
    'combo_1er_achat_bienvenue_abo', 'combo_achat_recurrent_bienvenue_abo',
    'combo_abo_resilie_rapidement'
  ));
