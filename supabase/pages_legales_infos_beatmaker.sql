-- ============================================================
-- Étape 1 (suite) — Infos légales du beatmaker pour les pages légales
-- ============================================================
-- Retour de test de Jake sur la Phase 1 (2026-08-11) : le modèle de CGV
-- contenait des placeholders texte "[À compléter : SIRET, adresse...]" —
-- remplacés par des variables ({{raison_sociale}}, etc., voir
-- lib/pages-legales.ts) résolues à partir des infos du beatmaker.
--
-- numero_entreprise/adresse/ville/code_postal existent déjà sur
-- beatmakers (schema.sql) mais n'étaient éditables que par l'admin —
-- reste vrai ici, seuls les 2 nouveaux champs ci-dessous sont ajoutés.
-- Rendre le formulaire self-service pour TOUS les champs fiscaux reste
-- prévu à la Phase 8 (facturation réelle) du plan de refonte 9 bis —
-- ce correctif-ci ne couvre que le strict nécessaire aux pages légales.
--
-- raison_sociale : nom légal/commercial distinct du nom d'artiste public
-- (nom_artiste) — peut être identique au nom propre pour un
-- micro-entrepreneur sans raison sociale distincte.
-- email_contact_public : adresse affichée sur la page Contact — distincte
-- de l'email de connexion du compte, que le beatmaker peut ne pas
-- vouloir publier.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS raison_sociale text;
ALTER TABLE beatmakers ADD COLUMN IF NOT EXISTS email_contact_public text;

COMMENT ON COLUMN beatmakers.raison_sociale IS
  'Nom légal/commercial du beatmaker (peut différer de nom_artiste) — utilisé dans les pages légales boutique (Phase 1 refonte 9 bis). Self-service depuis /dashboard/legal.';
COMMENT ON COLUMN beatmakers.email_contact_public IS
  'Email de contact affiché publiquement sur la page Contact de la boutique — distinct de l''email de connexion du compte.';
