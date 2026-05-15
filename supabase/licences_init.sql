-- Trigger : créer les 5 licences par défaut à l'inscription d'un beatmaker
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
  return new;
end;
$$ language plpgsql security definer SET search_path = public;

create trigger trigger_creer_licences_defaut
  after insert on beatmakers
  for each row execute function creer_licences_defaut();

grant select, insert, update, delete on table public.licences to authenticated;
