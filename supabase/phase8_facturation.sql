-- ============================================================
-- Phase 8 (chantier 9 bis) — Facturation réelle + mandat de facturation
-- Voir memory/project_grillme_9bis_synthese.md (section Facturation) et
-- memory/project_phase8_numerotation_facture.md (raisonnement complet sur
-- le format de numérotation retenu).
-- ============================================================

-- ------------------------------------------------------------
-- Mandat de facturation (My Producer = mandataire technique, le
-- beatmaker reste émetteur légal) — même pattern que le mandat de
-- fulfillment (fulfillment_mandat_version/accepte_at sur beatmakers).
-- Versionné : si le texte du mandat change, les acceptations déjà
-- données gardent leur version d'origine.
-- ------------------------------------------------------------
alter table beatmakers add column if not exists mandat_facturation_version integer;
alter table beatmakers add column if not exists mandat_facturation_accepte_at timestamptz;

comment on column beatmakers.mandat_facturation_version is
  'Version du mandat de facturation acceptée par le beatmaker (My Producer génère la facture pour son compte, en tant que mandataire technique — le beatmaker reste émetteur légal). NULL = jamais accepté, aucune facture ne peut être générée.';

-- ------------------------------------------------------------
-- Numérotation des factures — format par défaut {SLUG}-{NUM}{MM}{AA}
-- (ordre naturel, aligné sur les exemples BOFiP), NUM = compteur
-- strictement continu avec un offset aléatoire fixé une fois par année
-- civile (nouvelle série légitime par exercice). Personnalisable par le
-- beatmaker (format + ordre des variables) — voir lib/facturation.ts.
-- ------------------------------------------------------------
alter table beatmakers add column if not exists facturation_format text;
alter table beatmakers add column if not exists facturation_format_accepte_at timestamptz;
alter table beatmakers add column if not exists facturation_annee_courante integer;
alter table beatmakers add column if not exists facturation_offset integer;
alter table beatmakers add column if not exists facturation_compteur integer not null default 0;

comment on column beatmakers.facturation_format is
  'Format personnalisé du numéro de facture (variables {SLUG}{NUM}{JJ}{MM}{AA} dans l''ordre choisi par le beatmaker). NULL = format par défaut ({SLUG}-{NUM}{MM}{AA}). Si personnalisé, la conformité du format retenu est de la responsabilité du beatmaker, pas de My Producer.';
comment on column beatmakers.facturation_annee_courante is
  'Année civile de la série de numérotation en cours — à la première facture d''une nouvelle année, un nouvel offset est tiré et le compteur reprend à 0 (nouvelle série légitime par exercice, jamais un saut en cours de série).';
comment on column beatmakers.facturation_offset is
  'Point de départ fixé une fois par année civile (aléatoire) — le numéro affiché est offset + position réelle, jamais l''offset seul. Change uniquement au changement d''année, jamais en cours de série.';
comment on column beatmakers.facturation_compteur is
  'Dernier numéro de facture attribué dans la série de l''année en cours (déjà décalé par l''offset). Incrémenté atomiquement via facturation_prochain_numero().';

-- ------------------------------------------------------------
-- Snapshot transactionnel (commandes) — même principe que
-- tva_taux/cgv_version/mandat_fulfillment_version déjà figés en Phase 4.
-- ------------------------------------------------------------
alter table commandes add column if not exists numero_facture text;
alter table commandes add column if not exists mandat_facturation_version integer;

comment on column commandes.numero_facture is
  'Numéro de facture figé au moment de l''émission — jamais recalculé après coup, même si le format change ensuite pour le beatmaker.';
comment on column commandes.mandat_facturation_version is
  'Version du mandat de facturation en vigueur chez le beatmaker au moment de cette vente (snapshot transactionnel, Phase 4).';

create unique index if not exists commandes_numero_facture_beatmaker_uniq
  on commandes (beatmaker_id, numero_facture)
  where numero_facture is not null;

-- ------------------------------------------------------------
-- Fonction atomique d'attribution du prochain numéro — verrouille la
-- ligne beatmaker (FOR UPDATE) pour éviter toute collision sous charge
-- concurrente, jamais de calcul côté application. Gère elle-même le
-- changement d'année (nouvel offset aléatoire, compteur remis à 0).
-- ------------------------------------------------------------
create or replace function facturation_prochain_numero(p_beatmaker_id uuid, p_annee integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_annee_courante integer;
  v_offset integer;
  v_compteur integer;
begin
  select facturation_annee_courante, facturation_offset, facturation_compteur
    into v_annee_courante, v_offset, v_compteur
    from beatmakers
    where id = p_beatmaker_id
    for update;

  if not found then
    raise exception 'Beatmaker introuvable: %', p_beatmaker_id;
  end if;

  -- Nouvelle série légitime à chaque année civile — nouvel offset tiré
  -- une seule fois, jamais recalculé en cours d'année.
  if v_annee_courante is distinct from p_annee then
    v_offset := 1000 + floor(random() * 8000)::integer; -- 1000-8999
    v_compteur := v_offset;
    v_annee_courante := p_annee;
  else
    v_compteur := v_compteur + 1;
  end if;

  update beatmakers
    set facturation_annee_courante = v_annee_courante,
        facturation_offset = v_offset,
        facturation_compteur = v_compteur
    where id = p_beatmaker_id;

  return v_compteur;
end;
$$;

grant execute on function facturation_prochain_numero(uuid, integer) to service_role;
