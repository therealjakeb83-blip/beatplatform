-- ============================================================
-- PHASE 12 — LOT 1 : ménage des données de test de l'ANCIEN système de collab
-- (collaborations créées en « actif d'office », paiements de splits à « fonds
-- en attente », etc. — toutes fictives, décision de Jake)
--
-- ORDRE : partie A (lecture seule) -> tu regardes les chiffres -> partie B
-- (effacement) -> ensuite seulement phase12_lot1_collaborations.sql.
-- ============================================================

-- ------------------------------------------------------------
-- PARTIE A — LECTURE SEULE (ne modifie rien). Lance ces 4 requêtes et regarde.
-- ------------------------------------------------------------

-- A1. Collaborations existantes, par statut
select statut, count(*) as nb, min(created_at) as la_plus_ancienne, max(created_at) as la_plus_recente
from beat_splits group by statut order by statut;

-- A2. Paiements de splits, par statut (montants en centimes)
select statut, count(*) as nb, sum(montant) as total_centimes
from split_payments group by statut order by statut;

-- A3. Commandes marquées « vente collab » (ancien système)
select count(*) as commandes_avec_transfer_group
from commandes where stripe_transfer_group is not null;

-- A4. Beats concernés (titre + propriétaire)
select b.id, b.titre, bm.nom_artiste as proprietaire, count(s.id) as nb_collaborations
from beat_splits s join beats b on b.id = s.beat_id join beatmakers bm on bm.id = b.beatmaker_id
group by b.id, b.titre, bm.nom_artiste order by nb_collaborations desc;

-- ------------------------------------------------------------
-- PARTIE B — EFFACEMENT (à lancer SEULEMENT après avoir vu et validé la partie A)
-- Une transaction : tout ou rien. On efface les paiements de splits d'abord
-- (ils pointent vers les collaborations), puis les collaborations.
-- Les commandes elles-mêmes ne sont PAS touchées (historique de ventes).
-- ------------------------------------------------------------

-- BEGIN;
-- DELETE FROM split_payments;
-- DELETE FROM beat_splits;
-- COMMIT;
--
-- Vérification après : select count(*) from beat_splits;  -- 0
--                       select count(*) from split_payments; -- 0
