-- Rang 9d, lot 1, T7 : fiches reconstruites sur des cas précis (lecture seule).
-- 1. nicojacob83@gmail.com dans chaque boutique
-- 2. acheteur de la commande collab 78c3ebdd (jakeb-test + nic-beat-2809) : fiche chez jakeb-test seulement
-- 3. deux clients créés par un import, deux ajouts manuels
-- 4. fiches créées par la reconstruction (source achat / import)
with cas as (
  select '1 nicojacob83@gmail.com' as cas, l.* from leads l join clients c on c.id = l.client_id
   where c.email = 'nicojacob83@gmail.com'
  union all
  select '2 acheteur collab 78c3ebdd', l.* from leads l
   where l.client_id = (select client_id from commandes where id::text like '78c3ebdd%' limit 1)
  union all
  (select '3 import créateur', l.* from leads l
    where exists (select 1 from imports_externes_contacts ic
                   where ic.client_id = l.client_id and ic.beatmaker_id = l.beatmaker_id and ic.client_cree)
    order by l.created_at desc limit 2)
  union all
  (select '3 ajout manuel', l.* from leads l where l.source = 'manuel' order by l.created_at desc limit 2)
  union all
  (select '4 créée par la reconstruction', l.* from leads l
    where l.reconstruite_le is not null and l.created_at = l.premier_contact_le and l.source in ('achat', 'import')
    order by l.created_at desc limit 3)
)
select cas, b.slug, cas.source, cas.emails, cas.telephones, cas.adresses, cas.prenom, cas.nom, cas.nom_artiste,
       cas.pays, cas.langue, cas.premier_contact_le, cas.notes, cas.tags, cas.surnom,
       concat_ws(' ', cas.instagram, cas.spotify, cas.youtube, cas.tiktok) as reseaux
from cas join beatmakers b on b.id = cas.beatmaker_id
order by cas.cas, b.slug;
