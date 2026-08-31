-- ============================================================
-- Chantier fuseau horaire par beatmaker (cadré le 2026-08-28)
-- ============================================================
-- Réglage par compte, défaut Europe/Paris (ne casse rien pour les comptes
-- existants). Utilisé pour l'affichage des dates dans le dashboard et pour
-- le découpage des périodes dans les Analytics (voir lib/fuseau-horaire.ts).
-- Valeur = identifiant IANA (ex. 'Europe/Paris', 'America/New_York').

alter table beatmakers add column if not exists fuseau_horaire text not null default 'Europe/Paris';

comment on column beatmakers.fuseau_horaire is
  'Fuseau horaire IANA du beatmaker (ex. Europe/Paris) — affichage des dates dashboard + découpage des périodes Analytics. lib/fuseau-horaire.ts.';
