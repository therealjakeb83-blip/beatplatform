-- ============================================================
-- Réductions par lot — activées par défaut sur toutes les boutiques
-- ============================================================
-- Décision Jake (session 2026-08-05) : chaque boutique a par défaut une
-- règle "achète 2, obtiens 1 offert" active sur toutes ses licences SAUF
-- exclusive (modele = 'exclusive') — le beatmaker peut ensuite la modifier,
-- la désactiver ou en créer d'autres depuis /dashboard/business/reductions-lot.
--
-- À exécuter en une fois dans l'éditeur SQL de Supabase.

-- ============================================================
-- 1. Backfill des beatmakers existants — ignore toute licence qui a déjà
--    une règle active (préserve les règles déjà configurées manuellement).
-- ============================================================

insert into reductions_lot (beatmaker_id, licence_id, nom, nb_a_acheter, nb_offerts, actif)
select l.beatmaker_id, l.id, 'Achète 2, obtiens 1 offert', 2, 1, true
from licences l
where l.modele <> 'exclusive'
  and l.actif = true
  and not exists (
    select 1 from reductions_lot r
    where r.licence_id = l.id and r.actif = true
  );

-- ============================================================
-- 2. Nouveaux beatmakers — étend le trigger existant (licences_init.sql)
--    pour créer la règle par défaut en même temps que les 5 licences.
-- ============================================================

create or replace function creer_licences_defaut()
returns trigger as $$
begin
  insert into licences (beatmaker_id, ordre, nom, prix, modele, inclut_mp3, inclut_wav, inclut_stems, est_exclusive, streams_limite, vues_video_limite, clips_video_limite, radio_tv_limite)
  values
    (new.id, 1, 'MP3 Basic',   25,  'mp3',      true,  false, false, false, 50000,  200000, 1, 1),
    (new.id, 2, 'MP3 + WAV',   45,  'wav',      true,  true,  false, false, 100000, 500000, 2, 2),
    (new.id, 3, 'WAV + Stems', 75,  'stems',    true,  true,  true,  false, null,   null,   null, null),
    (new.id, 4, 'Illimité',    150, 'illimite', true,  true,  true,  false, null,   null,   null, null),
    (new.id, 5, 'Exclusive',   500, 'exclusive',true,  true,  true,  true,  null,   null,   null, null);

  insert into reductions_lot (beatmaker_id, licence_id, nom, nb_a_acheter, nb_offerts, actif)
  select new.id, l.id, 'Achète 2, obtiens 1 offert', 2, 1, true
  from licences l
  where l.beatmaker_id = new.id and l.modele <> 'exclusive';

  return new;
end;
$$ language plpgsql security definer SET search_path = public;
