-- ============================================================
-- Correctif ponctuel (2026-07-27) — doublons "Jerk" dans les
-- catégories officielles admin
-- ============================================================
-- Cause : script de clonage de catalogue (test1..test10, 2026-07-22)
-- qui a copié la catégorie perso "Jerk" de jakeb-test — déjà certifiée
-- à ce moment-là — vers chaque nouveau compte de test en conservant
-- statut='certifiee'. Résultat : 11 lignes `categories` distinctes
-- toutes marquées "officielle" (estOfficielle() dans lib/categories.ts
-- renvoie vrai dès que statut='certifiee', peu importe le beatmaker_id),
-- affichées en double (x11) dans /dashboard/admin/categories.
-- Le vrai circuit de certification (traiter_groupe_certification,
-- phase7_10_regroupement_certification.sql) ne produit jamais ce cas —
-- il fusionne toujours vers une seule ligne canonique. Sans danger de
-- supprimer les doublons : les beats référencent leurs styles par nom
-- (texte), jamais par categories.id.

-- 1. Supprime les 10 doublons, garde la ligne d'origine (jakeb-test,
--    vraie certification du 2026-07-20).
DELETE FROM categories
WHERE type = 'styles' AND nom = 'Jerk' AND statut = 'certifiee'
  AND id <> 'd873705c-edf2-4779-bba9-95574d52edbf';

-- 2. Empêche structurellement que ça se reproduise, quelle qu'en soit
--    la cause future (script, bug, admin) : une seule ligne certifiée
--    par (type, nom), tous beatmakers confondus.
CREATE UNIQUE INDEX IF NOT EXISTS categories_certifiee_unique
  ON categories (type, nom) WHERE statut = 'certifiee';
