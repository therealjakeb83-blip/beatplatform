-- ============================================================
-- My Producer — Schéma de base de données
-- À exécuter dans l'éditeur SQL de Supabase (une seule fois)
-- ============================================================

-- ============================================================
-- TABLE : beatmakers
-- Profil de chaque beatmaker inscrit sur la plateforme
-- ============================================================
create table beatmakers (
  -- Identité
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null unique,
  nom_artiste       text not null,
  slug              text not null unique,
  created_at        timestamptz not null default now(),

  -- Boutique publique
  tagline           text,
  bio               text,
  logo_url          text,
  template          text,
  devise            text not null check (devise in ('EUR', 'USD')),
  domaine           text unique,
  instagram_url     text,
  youtube_url       text,
  tiktok_url        text,

  -- Facturation
  pays              text not null,
  adresse           text,
  ville             text,
  code_postal       text,
  telephone         text,
  numero_entreprise text,
  tva_active        boolean default false,
  tva_numero        text,
  tva_taux          numeric,

  -- Paiements
  stripe_account_id text,
  paypal_account_id text,

  -- Légal
  cgv_acceptees_at  timestamptz not null,

  -- Admin & CRM
  statut              text not null default 'actif' check (statut in ('actif', 'inactif', 'suspendu')),
  source_acquisition  text,
  date_dernier_login  timestamptz,
  notes_admin         text
);

-- ============================================================
-- TABLE : clients
-- Comptes globaux des artistes acheteurs (partagés entre boutiques)
-- ============================================================
create table clients (
  -- Identité
  id                  uuid primary key references auth.users(id) on delete cascade,
  email               text not null unique,
  nom                 text not null,
  prenom              text not null,
  nom_artiste         text,
  avatar_url          text,
  telephone           text,
  langue              text,
  created_at          timestamptz not null default now(),
  date_dernier_login  timestamptz,
  fusionne_dans       uuid references clients(id),
  fusionne_le         timestamptz,

  -- Adresse (pour les contrats de licence — demandée au premier achat)
  adresse             text,
  ville               text,
  code_postal         text,
  pays                text
);

-- ============================================================
-- TABLE : beats
-- Catalogue de beats de chaque beatmaker
-- ============================================================
create table beats (
  -- Identité
  id              uuid primary key default gen_random_uuid(),
  beatmaker_id    uuid not null references beatmakers(id) on delete cascade,
  created_at      timestamptz not null default now(),
  date_sortie     timestamptz,

  -- Infos musicales
  titre           text not null,
  titre_beatstars text,
  bpm             integer,
  cle             text,
  styles          text[],
  ambiances       text[],
  instruments     text[],
  type_beat       text[],

  -- Fichiers (liens Cloudflare R2)
  image_url       text,
  mp3_tague_url   text,
  mp3_propre_url  text,
  wav_url         text,
  stems_url       text,

  -- Disponibilité
  statut          text not null default 'prive' check (statut in ('programme', 'public', 'prive', 'masque', 'vendu')),
  supprime_le     timestamptz,

  -- Marketing
  free_download_actif boolean not null default false
);

-- ============================================================
-- TABLE : licences
-- 5 modèles fixes par beatmaker (MP3, WAV, STEMS, ILLIMITÉ, EXCLUSIVE)
-- ============================================================
create table licences (
  -- Identité
  id              uuid primary key default gen_random_uuid(),
  beatmaker_id    uuid not null references beatmakers(id) on delete cascade,
  created_at      timestamptz not null default now(),
  actif           boolean not null default true,
  ordre           integer not null,

  -- Champs modulables par le beatmaker
  nom             text not null,
  prix            integer not null,
  streams_limite  integer,

  -- Droits fixes (définis par le modèle, non modifiables par le beatmaker)
  modele              text not null check (modele in ('mp3', 'wav', 'stems', 'illimite', 'exclusive')),
  inclut_mp3          boolean not null default false,
  inclut_wav          boolean not null default false,
  inclut_stems        boolean not null default false,
  vues_video_limite   integer,
  clips_video_limite  integer,
  radio_tv_limite     integer,
  illustration_sonore boolean not null default false,
  ventes_physiques    boolean not null default false,
  est_exclusive       boolean not null default false
);

-- ============================================================
-- TABLE : leads
-- Premier contact d'un artiste avec la boutique d'un beatmaker
-- ============================================================
create table leads (
  -- Identité
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  beatmaker_id    uuid not null references beatmakers(id) on delete cascade,
  created_at      timestamptz not null default now(),

  -- Source du premier contact
  source          text not null check (source in ('visite', 'newsletter', 'free_download', 'achat')),

  -- Statut
  newsletter_inscrit  boolean not null default false,
  converti            boolean not null default false,
  date_conversion     timestamptz,

  -- Un seul lead par paire artiste/beatmaker
  unique (client_id, beatmaker_id)
);

-- ============================================================
-- TABLE : commandes
-- Historique de tous les achats de licences
-- ============================================================
create table commandes (
  -- Identité
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  client_id       uuid not null references clients(id),
  beatmaker_id    uuid not null references beatmakers(id),
  beat_id         uuid not null references beats(id),
  licence_id      uuid not null references licences(id),

  -- Paiement
  prix_paye               integer not null,
  devise                  text not null check (devise in ('EUR', 'USD')),
  methode_paiement        text not null check (methode_paiement in ('stripe', 'paypal', 'apple_pay', 'google_pay')),
  stripe_payment_id       text,
  statut                  text not null default 'en_attente' check (statut in ('en_attente', 'payee', 'remboursee', 'litige')),
  montant_rembourse       integer not null default 0,

  -- Codes promo
  code_promo              text,
  reduction_montant       integer not null default 0,

  -- Livraison
  fichiers_livres         boolean not null default false,
  contrat_pdf_url         text,
  facture_pdf_url         text,

  -- Import externe (BeatStars CSV)
  source_marketing        text check (source_marketing in ('youtube', 'instagram', 'tiktok', 'google', 'newsletter', 'direct', 'autre')),
  plateforme_source       text not null default 'my_producer' check (plateforme_source in ('my_producer', 'beatstars')),
  external_order_id       text,

  -- Upgrade de licence
  type_transaction        text not null default 'achat' check (type_transaction in ('achat', 'upgrade')),
  commande_originale_id   uuid references commandes(id),

  -- Évite les doublons lors des imports BeatStars (NULL autorisé en double)
  unique (plateforme_source, external_order_id)
);

-- ============================================================
-- TABLE : doublons_ignores
-- Paires de clients ignorées lors de la détection de doublons
-- ============================================================
create table doublons_ignores (
  id              uuid primary key default gen_random_uuid(),
  client_id_1     uuid not null references clients(id) on delete cascade,
  client_id_2     uuid not null references clients(id) on delete cascade,
  beatmaker_id    uuid not null references beatmakers(id) on delete cascade,
  created_at      timestamptz not null default now(),

  unique (client_id_1, client_id_2, beatmaker_id)
);

-- ============================================================
-- TABLE : abonnements_plateforme
-- Ce que les beatmakers paient à My Producer
-- ============================================================
create table abonnements_plateforme (
  -- Identité
  id                  uuid primary key default gen_random_uuid(),
  beatmaker_id        uuid not null references beatmakers(id) on delete cascade,
  created_at          timestamptz not null default now(),
  source_conversion   text check (source_conversion in ('youtube', 'instagram', 'referral', 'organic', 'autre')),

  -- Plan
  plan                text not null default 'standard',
  periode             text not null check (periode in ('mensuel', 'annuel')),
  prix                integer not null,
  devise              text not null check (devise in ('EUR', 'USD')),

  -- Essai gratuit 14 jours (CB obligatoire)
  en_essai            boolean not null default true,
  essai_fin_le        timestamptz not null,

  -- Statut
  statut              text not null default 'en_essai' check (statut in ('en_essai', 'actif', 'annule', 'impaye')),
  date_debut          timestamptz,
  date_fin            timestamptz,
  date_annulation     timestamptz,

  -- Stripe
  stripe_subscription_id  text,
  stripe_customer_id      text
);

-- ============================================================
-- TABLE : abonnements_boutique
-- Ce que les artistes paient aux beatmakers
-- ============================================================
create table abonnements_boutique (
  -- Identité
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  beatmaker_id    uuid not null references beatmakers(id) on delete cascade,
  created_at      timestamptz not null default now(),

  -- Plan (1 seul en V1)
  plan            text not null default 'standard' check (plan = 'standard'),
  periode         text not null check (periode in ('mensuel', 'annuel')),
  prix            integer not null,
  devise          text not null check (devise in ('EUR', 'USD')),

  -- Fidélité
  mois_consecutifs    integer not null default 0,
  credit_licences     integer not null default 0,

  -- Statut
  statut              text not null default 'actif' check (statut in ('actif', 'annule', 'impaye')),
  date_debut          timestamptz not null,
  date_fin            timestamptz not null,
  date_annulation     timestamptz,
  motif_annulation    text check (motif_annulation in ('user_cancel', 'payment_failed', 'admin_cancel')),

  -- Paiement
  methode_paiement        text not null check (methode_paiement in ('stripe', 'paypal')),
  stripe_subscription_id  text,
  stripe_customer_id      text,
  paypal_subscription_id  text,
  paypal_payer_id         text,

  -- Import (migration depuis WooCommerce)
  external_subscription_id text
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Active la protection par défaut sur toutes les tables
-- Les politiques d'accès seront définies à l'étape suivante
-- ============================================================
alter table beatmakers enable row level security;
alter table clients enable row level security;
alter table beats enable row level security;
alter table licences enable row level security;
alter table leads enable row level security;
alter table commandes enable row level security;
alter table doublons_ignores enable row level security;
alter table abonnements_plateforme enable row level security;
alter table abonnements_boutique enable row level security;

-- ============================================================
-- INDEX (performance)
-- ============================================================
create index on beats (beatmaker_id);
create index on licences (beatmaker_id);
create index on leads (client_id);
create index on leads (beatmaker_id);
create index on commandes (client_id);
create index on commandes (beatmaker_id);
create index on commandes (beat_id);
create index on abonnements_plateforme (beatmaker_id);
create index on abonnements_boutique (client_id);
create index on abonnements_boutique (beatmaker_id);
