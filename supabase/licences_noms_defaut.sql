-- ============================================================
-- Licences — noms par défaut simplifiés
-- ============================================================
-- Décision Jake (session 2026-08-05) : les 5 licences par défaut s'appellent
-- désormais MP3 / WAV / STEMS / ILLIMITÉ / EXCLUSIVE (au lieu de "MP3 Basic",
-- "MP3 + WAV", "WAV + Stems", "Illimité", "Exclusive") — le beatmaker garde
-- la main pour renommer ensuite depuis /dashboard/business/licences.
--
-- Backfill non destructif : ne renomme que les licences encore au nom par
-- défaut d'origine (une licence déjà renommée par un beatmaker n'est jamais
-- touchée) — même logique de prudence que reductions_lot_defaut.sql.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ============================================================
-- 1. Backfill des beatmakers existants
-- ============================================================

update licences set nom = 'MP3'      where modele = 'mp3'       and nom = 'MP3 Basic';
update licences set nom = 'WAV'      where modele = 'wav'       and nom = 'MP3 + WAV';
update licences set nom = 'STEMS'    where modele = 'stems'     and nom = 'WAV + Stems';
update licences set nom = 'ILLIMITÉ' where modele = 'illimite'  and nom = 'Illimité';
update licences set nom = 'EXCLUSIVE' where modele = 'exclusive' and nom = 'Exclusive';

-- ============================================================
-- 2. Nouveaux beatmakers — met à jour le trigger existant
--    (déjà étendu par reductions_lot_defaut.sql pour la réduction par lot)
-- ============================================================

create or replace function creer_licences_defaut()
returns trigger as $$
begin
  insert into licences (beatmaker_id, ordre, nom, prix, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive, streams_limite, vues_video_limite, clips_video_limite, radio_tv_limite)
  values
    (new.id, 1, 'MP3',      25,  'mp3',      true,  false, false, false, 50000,  200000, 1, 1),
    (new.id, 2, 'WAV',      45,  'wav',      true,  true,  false, false, 100000, 500000, 2, 2),
    (new.id, 3, 'STEMS',    75,  'stems',    true,  true,  true,  false, null,   null,   null, null),
    (new.id, 4, 'ILLIMITÉ', 150, 'illimite', true,  true,  true,  false, null,   null,   null, null),
    (new.id, 5, 'EXCLUSIVE',500, 'exclusive',true,  true,  true,  true,  null,   null,   null, null);

  insert into reductions_lot (beatmaker_id, licence_id, nom, nb_a_acheter, nb_offerts, actif)
  select new.id, l.id, 'Achète 2, obtiens 1 offert', 2, 1, true
  from licences l
  where l.beatmaker_id = new.id and l.modele <> 'exclusive';

  return new;
end;
$$ language plpgsql security definer SET search_path = public;
