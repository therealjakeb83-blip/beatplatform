-- ============================================================
-- Phase 8 (suite) — point de départ (offset) personnalisable par le
-- beatmaker, verrouillé dès la 1ère facture de l'année en cours.
-- Voir memory/project_phase8_numerotation_facture.md pour le raisonnement
-- complet (pourquoi "avant la 1ère facture = libre, après = verrouillé").
-- ============================================================

alter table beatmakers add column if not exists facturation_offset_mode text not null default 'aleatoire'
  check (facturation_offset_mode in ('aleatoire', 'manuel'));
alter table beatmakers add column if not exists facturation_offset_manuel integer;

comment on column beatmakers.facturation_offset_mode is
  'aleatoire = point de départ tiré au hasard chaque nouvelle année (défaut). manuel = le beatmaker choisit son propre point de départ (facturation_offset_manuel). Modifiable uniquement avant la 1ère facture de l''année en cours (facturation_annee_courante ≠ année en cours) — jamais après, pour ne jamais casser la continuité d''une série déjà commencée.';
comment on column beatmakers.facturation_offset_manuel is
  'Point de départ choisi par le beatmaker quand facturation_offset_mode = manuel. 1 = pas de décalage, numérotation naturelle à partir de 1. Ignoré si mode = aleatoire.';

alter table beatmakers add constraint beatmakers_facturation_offset_manuel_valide
  check (facturation_offset_manuel is null or facturation_offset_manuel >= 1);

-- Fonction mise à jour : au démarrage d'une nouvelle série annuelle, lit le
-- mode choisi par le beatmaker au lieu de toujours tirer un offset aléatoire.
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
  v_mode text;
  v_manuel integer;
begin
  select facturation_annee_courante, facturation_offset, facturation_compteur,
         facturation_offset_mode, facturation_offset_manuel
    into v_annee_courante, v_offset, v_compteur, v_mode, v_manuel
    from beatmakers
    where id = p_beatmaker_id
    for update;

  if not found then
    raise exception 'Beatmaker introuvable: %', p_beatmaker_id;
  end if;

  if v_annee_courante is distinct from p_annee then
    if v_mode = 'manuel' and v_manuel is not null then
      v_offset := v_manuel;
    else
      v_offset := 1000 + floor(random() * 8000)::integer; -- 1000-8999
    end if;
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
