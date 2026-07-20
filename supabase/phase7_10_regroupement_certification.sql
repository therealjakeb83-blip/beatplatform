-- ============================================================
-- PHASE 7.10 (bonus) — Regroupement des demandes de certification
-- ============================================================
-- Décisions du 2026-07-20 : plusieurs beatmakers peuvent créer, chacun de
-- leur côté, une catégorie perso avec le même nom (à la casse près :
-- "Jerk"/"JERK"/"jerk" sont la même catégorie, "Jerk"/"Jerks" non). Sans
-- regroupement, une même demande "populaire" se retrouverait en N lignes
-- identiques dans la file de modération. Ce script :
-- - dénormalise nom/type sur demandes_certification (l'historique d'une
--   demande ne doit plus dépendre de l'existence de sa catégorie d'origine)
-- - passe categorie_id en ON DELETE SET NULL (au lieu de CASCADE) : fusionner
--   des doublons supprime des lignes `categories`, jamais l'historique
-- - remplace traiter_demande_certification() par traiter_groupe_certification(),
--   qui agit sur un groupe entier (toutes les variantes de casse d'un nom) au
--   lieu d'une seule demande, avec un nom final choisi par l'admin au moment
--   d'approuver (pas de casse imposée automatiquement)

alter table demandes_certification add column if not exists nom text;
alter table demandes_certification add column if not exists type text;

update demandes_certification dc
set nom = c.nom, type = c.type
from categories c
where dc.categorie_id = c.id and dc.nom is null;

alter table demandes_certification alter column nom set not null;
alter table demandes_certification alter column type set not null;

alter table demandes_certification drop constraint if exists demandes_certification_type_check;
alter table demandes_certification add constraint demandes_certification_type_check
  check (type in ('styles', 'ambiances', 'instruments', 'type_beat'));

alter table demandes_certification drop constraint if exists demandes_certification_categorie_id_fkey;
alter table demandes_certification add constraint demandes_certification_categorie_id_fkey
  foreign key (categorie_id) references categories(id) on delete set null;

drop function if exists traiter_demande_certification(uuid, boolean);

-- ============================================================
-- Traitement atomique d'un GROUPE de demandes (nom identique, casse
-- ignorée) — set-based du début à la fin, aucune boucle par ligne : ne
-- boucle que sur le nombre de variantes de casse distinctes (quelques
-- unités en pratique, jamais sur le nombre de catégories/demandes),
-- pour rester rapide même avec des milliers de doublons.
-- ============================================================
create or replace function traiter_groupe_certification(
  p_type text, p_nom_groupe text, p_nom_final text, p_approuver boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nom_norm        text := lower(trim(p_nom_groupe));
  v_nom_final       text := trim(p_nom_final);
  v_categorie_canon uuid;
  v_variante        text;
begin
  if p_approuver then
    if v_nom_final = '' then
      raise exception 'Nom final requis';
    end if;

    -- Catégorie canonique : la plus ancienne du groupe (peu importe
    -- laquelle, sa casse d'origine sera de toute façon écrasée par
    -- v_nom_final juste après) — c'est elle qui survit, les autres lignes
    -- perso du groupe sont supprimées.
    select id into v_categorie_canon
    from categories
    where type = p_type and lower(nom) = v_nom_norm and source = 'beatmaker' and statut = 'active'
    order by created_at asc
    limit 1;

    if v_categorie_canon is null then
      raise exception 'Aucune catégorie perso correspondante trouvée';
    end if;

    -- Renomme dans `beats` chaque variante de casse distincte du groupe
    -- (hors celles déjà exactement au nom final) vers le nom final choisi
    -- par l'admin, tous beatmakers confondus.
    for v_variante in
      select distinct nom from categories
      where type = p_type and lower(nom) = v_nom_norm and source = 'beatmaker' and statut = 'active' and nom <> v_nom_final
    loop
      if p_type = 'styles' then
        update beats set styles = array_replace(styles, v_variante, v_nom_final) where styles @> array[v_variante];
      elsif p_type = 'type_beat' then
        update beats set type_beat = array_replace(type_beat, v_variante, v_nom_final) where type_beat @> array[v_variante];
      end if;
    end loop;

    update categories set nom = v_nom_final, statut = 'certifiee' where id = v_categorie_canon;

    -- Supprime tous les doublons perso restants du groupe — demandeurs et
    -- non-demandeurs confondus (le regroupement se fait par nom, pas par
    -- "a demandé la certification ou non").
    delete from categories
    where type = p_type and lower(nom) = v_nom_norm and source = 'beatmaker' and statut = 'active' and id <> v_categorie_canon;

    update demandes_certification
    set statut = 'approuvee', traite_le = now()
    where type = p_type and lower(nom) = v_nom_norm and statut = 'en_attente';
  else
    update demandes_certification
    set statut = 'rejetee', traite_le = now()
    where type = p_type and lower(nom) = v_nom_norm and statut = 'en_attente';
  end if;
end;
$$;

grant execute on function traiter_groupe_certification(text, text, text, boolean) to service_role;
