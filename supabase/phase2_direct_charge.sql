-- ============================================================
-- PHASE 2 (refonte 9 bis) — Direct Charge : flag + snapshot minimal
-- ============================================================
-- direct_charge_actif : bascule par boutique, désactivée par défaut partout.
-- Le code du checkout (2.4/2.4b) sait gérer les deux modes ; tant que ce
-- flag reste à false, aucun comportement ne change pour aucune boutique
-- existante. Activation réelle prévue plus tard (tâche 2.10), après que le
-- webhook Connect (2.6/2.7) soit fiable — jamais avant.
--
-- stripe_account_id / payment_intent_id (tâche 2.8) : capture historique
-- minimale nécessaire au remboursement réel (Phase 3), pour ne jamais
-- dépendre du stripe_account_id *actuel* du beatmaker sur une commande
-- passée. Colonnes ajoutées maintenant, écriture réelle câblée avec le
-- webhook (2.7).
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table beatmakers add column if not exists direct_charge_actif boolean not null default false;

alter table commandes add column if not exists stripe_account_id text;
alter table commandes add column if not exists payment_intent_id text;
