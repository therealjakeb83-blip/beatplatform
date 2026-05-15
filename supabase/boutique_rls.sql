-- ============================================================
-- RLS PUBLIQUE — Boutique (lecture sans authentification)
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- beatmakers : lecture publique du profil boutique
create policy "beatmakers_select_public" on beatmakers
  for select to anon
  using (true);

grant select on table public.beatmakers to anon;

-- beats : lecture publique uniquement pour les beats avec statut 'public'
create policy "beats_select_public" on beats
  for select to anon
  using (statut = 'public' and supprime_le is null);

grant select on table public.beats to anon;

-- licences : lecture publique (pour afficher les prix sur la boutique)
create policy "licences_select_public" on licences
  for select to anon
  using (true);

grant select on table public.licences to anon;

-- beat_licences : lecture publique (policy déjà créée, on ajoute juste le grant)
grant select on table public.beat_licences to anon;
