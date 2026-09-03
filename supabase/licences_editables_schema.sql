-- ============================================================
-- Chantier 9 bis, Phase 6 — Licences éditables
-- Étape 1 : schéma (infos légales beatmaker + limites de licence)
-- ============================================================

-- Forme juridique du beatmaker (ex: micro-entreprise, SASU, EURL...)
-- Facultatif : certains beatmakers n'ont pas encore créé d'entreprise,
-- la licence retombe alors sur nom/prénom/pseudonyme + adresse seuls.
alter table beatmakers add column if not exists forme_juridique text;

-- Siège social de l'entreprise, distinct de l'adresse de facturation
-- personnelle du beatmaker (adresse/ville/code_postal existants) — un
-- beatmaker en société peut avoir un siège social différent de son
-- adresse perso. Facultatif, texte libre (usage : affichage licence uniquement).
alter table beatmakers add column if not exists siege_social_adresse text;

comment on column beatmakers.forme_juridique is
  'Forme juridique affichée sur les licences (ex: micro-entreprise, SASU) — facultatif';
comment on column beatmakers.siege_social_adresse is
  'Siège social de l''entreprise si distinct de l''adresse de facturation personnelle — facultatif, affichage licence uniquement';

-- ventes_physiques passe de booléen à un nombre précis (ex: "jusqu'à 2000
-- ventes physiques"), comme les autres limites de licence (streams_limite,
-- vues_video_limite...). Colonne jamais exposée dans l'éditeur de licences
-- jusqu'ici (vérifié : aucune référence dans le code applicatif), donc pas
-- de donnée réelle à migrer.
alter table licences drop column if exists ventes_physiques;
alter table licences add column if not exists ventes_physiques_limite integer;

-- Live performances : simple autorisé/non autorisé (pas de nombre, pas de
-- conditions en texte libre — invérifiable, écarté du modèle).
alter table licences add column if not exists lives_performances_autorise boolean not null default false;

comment on column licences.ventes_physiques_limite is
  'Nombre max de ventes sur supports physiques autorisées (null = illimité)';
comment on column licences.lives_performances_autorise is
  'Autorise ou non les performances publiques/lives avec la Nouvelle Œuvre';

-- ============================================================
-- Étape 2 : adresse de l'acheteur au moment de l'achat
-- ============================================================

-- Snapshot transactionnel (même principe que tva_taux/cgv_version en
-- Phase 4) : l'adresse au moment précis de l'achat, jamais dépendante
-- d'une adresse client qui pourrait changer après coup.
alter table commandes add column if not exists acheteur_adresse text;

comment on column commandes.acheteur_adresse is
  'Adresse postale de l''acheteur au moment de l''achat (snapshot, formatée en une ligne) — pour les contrats de licence';
