-- ============================================================
-- Paiement express (Apple Pay / Google Pay / PayPal) — popup licence
-- ============================================================
-- Achat unitaire (1 beat + 1 licence), indépendant du panier, payé via un
-- PaymentIntent Stripe créé au clic sur le bouton express (voir
-- app/api/stripe/express-checkout/route.ts) plutôt qu'une Checkout Session
-- (le montant d'une Session n'est pas modifiable après création, alors que
-- la popup doit détecter la disponibilité des wallets avant même que la
-- licence soit choisie — voir ROADMAP.md pour le détail de la décision).
--
-- tentatives_paiement suit donc un PaymentIntent plutôt qu'une Session pour
-- ce type de tentative, en ajoutant une 3ᵉ branche à la contrainte de forme
-- déjà en place pour achat_beat / renouvellement_abonnement (même pattern
-- que tentatives_paiement_abonnement.sql et phase2c_panier.sql).

alter table tentatives_paiement add column stripe_payment_intent_id text unique;

create index on tentatives_paiement (stripe_payment_intent_id);

alter table tentatives_paiement drop constraint tentatives_paiement_type_check;
alter table tentatives_paiement add constraint tentatives_paiement_type_check
  check (type in ('achat_beat', 'achat_express', 'renouvellement_abonnement'));

alter table tentatives_paiement drop constraint tentatives_paiement_forme_coherente;
alter table tentatives_paiement add constraint tentatives_paiement_forme_coherente check (
  (type = 'achat_beat' and stripe_session_id is not null and stripe_payment_intent_id is null
    and abonnement_id is null and stripe_invoice_id is null)
  or
  (type = 'achat_express' and stripe_payment_intent_id is not null and stripe_session_id is null
    and abonnement_id is null and stripe_invoice_id is null)
  or
  (type = 'renouvellement_abonnement' and abonnement_id is not null and stripe_invoice_id is not null
    and stripe_session_id is null and stripe_payment_intent_id is null)
);
