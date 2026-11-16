-- Rang 9d, lot 1, T9 : la reconstruction est relançable et respecte la main du
-- beatmaker. Rien n'est enregistré : le bloc s'annule lui-même et affiche le
-- compte rendu sous forme de message d'erreur (normal qu'il soit en rouge).
do $$
declare
  r jsonb;
  v_lead uuid;
  v_prenom text;
  v_emails text[];
  rapport text := '';
begin
  -- 1. Deuxième passage : plus rien à faire
  r := reconstruire_fiches_boutique(false);
  rapport := rapport || E'\n2e passage : fiches à créer = ' || (r ->> 'fiches_a_creer')
          || ', fiches qui changent = ' || (r ->> 'fiches_qui_changent') || ' (attendu 0 et 0)';

  -- 2. Le beatmaker a vidé à la main le prénom et les emails d'une fiche
  select id into v_lead from leads where prenom is not null and cardinality(emails) > 0 order by created_at limit 1;
  update leads set prenom = null, emails = '{}', champs_manuels = array['prenom', 'emails'] where id = v_lead;
  r := reconstruire_fiches_boutique(true);
  select prenom, emails into v_prenom, v_emails from leads where id = v_lead;
  rapport := rapport || E'\nchamps vidés à la main puis reconstruction : prénom = '
          || coalesce(v_prenom, '(vide)') || ', emails = ' || coalesce(nullif(array_to_string(v_emails, ', '), ''), '(vide)')
          || ' (attendu : tous deux restés vides)'
          || E'\nfiches modifiées par ce passage : ' || (r ->> 'fiches_modifiees') || ' (attendu 0)';

  raise exception 'COMPTE RENDU T9 (rien enregistré) :%', rapport;
end $$;
