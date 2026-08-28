-- ============================================================
-- PHASE 5 (refonte 9 bis) — Statut de livraison fiable
-- ============================================================
-- Remplace le booléen commandes.fichiers_livres (tout ou rien, jamais mis
-- à jour après coup si un contrat PDF ou un transfert Stripe échoue) par un
-- statut à 3 états, recalculé à chaque tentative (création ET reprise
-- admin), jamais saisi à la main.
--
-- Distinct de commandes.statut (paiement : en_attente/payee/remboursee/
-- litige) — ne jamais fusionner les deux. Le détail de CE QUI a échoué
-- reste dans les tables déjà existantes (commande_lignes.contrat_pdf_url,
-- split_payments.statut), pas dupliqué ici.
--
-- fichiers_livres N'EST PAS supprimée dans cette migration — le code
-- actuellement en production l'écrit encore. Elle sera supprimée dans une
-- migration de nettoyage séparée, après que le nouveau code (qui utilise
-- statut_livraison) soit déployé et validé.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table commandes add column if not exists statut_livraison text
  not null default 'en_cours'
  check (statut_livraison in ('en_cours', 'livree', 'probleme'));

comment on column commandes.statut_livraison is
  'Statut réel de livraison (contrat PDF + transferts collab), recalculé à chaque tentative — jamais saisi à la main. en_cours = valeur transitoire avant le premier calcul ; livree = tout a réussi ; probleme = au moins une opération a échoué (voir commande_lignes.contrat_pdf_url et split_payments.statut pour le détail). Distinct de commandes.statut qui concerne uniquement le paiement.';

create index if not exists commandes_statut_livraison_idx on commandes (statut_livraison);
