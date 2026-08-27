-- ============================================================
-- PHASE 2 (refonte 9 bis) — Retrait du flag direct_charge_actif (tâche 2.5)
-- ============================================================
-- Direct Charge est maintenant le seul flux réel (2.10, toutes les
-- boutiques basculées) — le flag ne gate plus rien dans le code (checkout,
-- express-checkout, contexte-paiement ne le lisent plus), il devenait une
-- coquille. Décision explicite de Jake : pas de filet de secours à
-- maintenir, un bug futur se corrige directement comme n'importe quel bug,
-- pas en retombant sur un flux différent.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers drop column if exists direct_charge_actif;
