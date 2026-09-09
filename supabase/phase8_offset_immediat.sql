-- ============================================================
-- Phase 8 (suite) — le point de départ "aléatoire" est désormais tiré au
-- moment où le beatmaker clique sur Enregistrer, pas au moment de la 1ère
-- facture. Techniquement, ça revient à traiter "aléatoire" exactement
-- comme "manuel" du point de vue de la fonction Postgres : dès que
-- facturation_offset_manuel est renseigné (peu importe si c'est un choix
-- du beatmaker ou un tirage fait par l'API au clic), on l'utilise tel
-- quel. facturation_offset_mode reste uniquement informatif (affichage
-- "tiré au hasard" vs "choisi par toi"), plus consulté par la fonction.
-- Repli sur un tirage à la volée uniquement si aucune valeur n'a jamais
-- été enregistrée (beatmaker qui n'a jamais ouvert ce réglage).
--
-- Point important : facturation_offset_manuel doit rester "à usage unique"
-- pour le mode aléatoire (sinon l'année suivante réutiliserait le même
-- nombre au lieu d'en tirer un nouveau, ce qui casse l'objectif même du
-- mode aléatoire — un nouveau tirage à chaque nouvelle série annuelle).
-- Consommé et remis à NULL après usage si le mode était 'aleatoire' ;
-- laissé tel quel si 'manuel' (un choix explicite reste le point de
-- départ par défaut des années suivantes tant que le beatmaker ne le
-- change pas lui-même).
-- ============================================================

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
  v_manuel integer;
  v_mode text;
begin
  select facturation_annee_courante, facturation_offset, facturation_compteur,
         facturation_offset_manuel, facturation_offset_mode
    into v_annee_courante, v_offset, v_compteur, v_manuel, v_mode
    from beatmakers
    where id = p_beatmaker_id
    for update;

  if not found then
    raise exception 'Beatmaker introuvable: %', p_beatmaker_id;
  end if;

  if v_annee_courante is distinct from p_annee then
    if v_manuel is not null then
      v_offset := v_manuel;
    else
      v_offset := 1000 + floor(random() * 8000)::integer; -- 1000-8999, repli si jamais configuré
    end if;
    v_compteur := v_offset;
    v_annee_courante := p_annee;

    update beatmakers
      set facturation_annee_courante = v_annee_courante,
          facturation_offset = v_offset,
          facturation_compteur = v_compteur,
          facturation_offset_manuel = case when v_mode = 'aleatoire' then null else facturation_offset_manuel end
      where id = p_beatmaker_id;
  else
    v_compteur := v_compteur + 1;

    update beatmakers
      set facturation_compteur = v_compteur
      where id = p_beatmaker_id;
  end if;

  return v_compteur;
end;
$$;

grant execute on function facturation_prochain_numero(uuid, integer) to service_role;
