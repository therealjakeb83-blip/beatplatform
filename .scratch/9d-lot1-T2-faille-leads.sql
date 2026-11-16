-- Rang 9d, lot 1, T2 : essaie d'écrire dans `leads` « comme le beatmaker
-- connecté » (jakeb-test, clé publique). Rien n'est enregistré : le bloc
-- s'annule lui-même à la fin et affiche le compte rendu sous forme de message
-- d'erreur (c'est normal qu'il soit en rouge).
do $$
declare
  v_bm uuid;
  v_lead uuid;
  v_etranger uuid;
  n int;
  rapport text := '';
begin
  select id into v_bm from public.beatmakers where slug = 'jakeb-test';
  select id into v_lead from public.leads where beatmaker_id = v_bm order by created_at limit 1;
  select c.id into v_etranger from public.clients c
   where not exists (select 1 from public.leads l where l.client_id = c.id and l.beatmaker_id = v_bm)
   limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_bm::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_bm::text, true);
  set local role authenticated;

  select count(*) into n from public.leads;
  rapport := rapport || E'\n[témoin] lecture de ses fiches : ' || n || ' visibles (attendu > 0)';
  select count(*) into n from public.leads where beatmaker_id <> v_bm;
  rapport := rapport || E'\nfiches d''autres boutiques visibles : ' || n || ' (attendu 0)';

  begin
    insert into public.leads (client_id, beatmaker_id, source) values (v_etranger, v_bm, 'manuel');
    rapport := rapport || E'\nse rattacher un client étranger : ACCEPTÉ <-- PROBLÈME';
  exception when others then
    rapport := rapport || E'\nse rattacher un client étranger : refusé (' || sqlerrm || ')';
  end;

  begin
    update public.leads set client_id = v_etranger where id = v_lead;
    get diagnostics n = row_count;
    rapport := rapport || E'\nchanger le client d''une de ses fiches : ' ||
               case when n > 0 then 'ACCEPTÉ <-- PROBLÈME' else '0 ligne' end;
  exception when others then
    rapport := rapport || E'\nchanger le client d''une de ses fiches : refusé (' || sqlerrm || ')';
  end;

  begin
    update public.leads set notes = 'essai console' where id = v_lead;
    get diagnostics n = row_count;
    rapport := rapport || E'\nécrire une note depuis la console : ' ||
               case when n > 0 then 'ACCEPTÉ <-- PROBLÈME' else '0 ligne' end;
  exception when others then
    rapport := rapport || E'\nécrire une note depuis la console : refusé (' || sqlerrm || ')';
  end;

  begin
    delete from public.leads where id = v_lead;
    get diagnostics n = row_count;
    rapport := rapport || E'\nsupprimer une de ses fiches : ' ||
               case when n > 0 then 'ACCEPTÉ <-- PROBLÈME' else '0 ligne' end;
  exception when others then
    rapport := rapport || E'\nsupprimer une de ses fiches : refusé (' || sqlerrm || ')';
  end;

  raise exception 'COMPTE RENDU T2 (rien enregistré) :%', rapport;
end $$;
