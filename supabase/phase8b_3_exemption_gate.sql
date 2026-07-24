-- ============================================================
-- ÉTAPE 8b (suite) — Laisser-passer pour boutiques de test
-- ============================================================
-- Le gate d'accès dashboard (proxy.ts) bloque désormais tout beatmaker sans
-- abonnement plateforme actif/en essai. Plutôt que de créer un faux
-- abonnement à froid dans abonnements_plateforme (qui servira de source de
-- revenu réel pour l'Étape 15d MRR/ARR), ce booléen sert de laisser-passer
-- admin indépendant, réservé aux boutiques de test.

alter table beatmakers add column if not exists abonnement_exempte boolean not null default false;

comment on column beatmakers.abonnement_exempte is
  'Laisser-passer admin (Étape 8b) — bypass du gate abonnement plateforme dans proxy.ts, pour boutiques de test uniquement. Jamais activé par défaut.';
