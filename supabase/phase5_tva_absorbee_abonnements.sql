-- ============================================================
-- PHASE 5 (refonte 9 bis) — TVA toujours absorbée, abonnements
-- ============================================================
-- Décision produit (2026-08-28) : la TVA n'est jamais ajoutée par-dessus le
-- prix affiché, ni pour les licences (voir lib/pricing.ts) ni pour les
-- abonnements boutique — le prix que le beatmaker configure reste le prix
-- payé par le client, à vie pour cet abonné, même si le beatmaker
-- active/modifie la TVA ensuite (même principe que le snapshot CGV/TVA de
-- la Phase 4, appliqué ici aux abonnements).
--
-- tva_taux est figé UNE FOIS à la souscription (checkout.session.completed,
-- voir app/api/stripe/webhook/route.ts::traiterAbonnementCree), jamais
-- recalculé ensuite — sert uniquement à extraire HT/TVA du montant déjà
-- payé pour les déclarations, jamais à modifier ce montant.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

alter table abonnements_boutique add column if not exists tva_taux numeric;

comment on column abonnements_boutique.tva_taux is
  'Taux de TVA (%) figé au moment de la souscription — sert uniquement à extraire HT/TVA du prix déjà payé (TVA toujours absorbée, jamais ajoutée). NULL = TVA non active à la souscription, ou abonnement antérieur à cette colonne.';
