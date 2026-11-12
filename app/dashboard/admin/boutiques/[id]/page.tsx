import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import BoutiqueDetailClient from './_components/BoutiqueDetailClient'
import AdresseBoutiqueAdmin, { type AncienNom } from './_components/AdresseBoutiqueAdmin'
import { suspendreAction, reactiverAction, corrigerBeatmakerAction, exempterGateAction } from './_lib/actions'

export default async function BoutiqueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, email, nom_artiste, slug, tagline, bio, telephone, adresse, ville, code_postal, pays, numero_entreprise, notes_admin, statut, suspendu_le, suspendu_motif, suspendu_raison, created_at, stripe_account_id, devise, abonnement_exempte, slug_choisi_le')
    .eq('id', id)
    .maybeSingle()

  if (!beatmaker) notFound()

  const [{ count: nbClients }, { count: nbCommandes }, { data: aboPlateforme }, { count: nbAbosArtistesActifs }, { data: anciensNoms }] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id),
    admin.from('commandes').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id),
    admin.from('abonnements_plateforme').select('statut, annulation_prevue_le').eq('beatmaker_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('abonnements_boutique').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id).eq('statut', 'actif'),
    admin.from('anciens_slugs').select('id, slug, automatique, cree_le, libere_le').eq('beatmaker_id', id).order('cree_le', { ascending: false }),
  ])

  return (
    <BoutiqueDetailClient
      beatmaker={beatmaker}
      sectionAdresse={
        <AdresseBoutiqueAdmin
          beatmakerId={beatmaker.id}
          slug={beatmaker.slug}
          slugChoisiLe={beatmaker.slug_choisi_le}
          anciensNoms={(anciensNoms ?? []) as AncienNom[]}
        />
      }
      nbClients={nbClients ?? 0}
      nbCommandes={nbCommandes ?? 0}
      statutAbonnementPlateforme={aboPlateforme?.statut ?? null}
      annulationPrevueAbonnementPlateforme={aboPlateforme?.annulation_prevue_le ?? null}
      nbAbosArtistesActifs={nbAbosArtistesActifs ?? 0}
      suspendreAction={suspendreAction}
      reactiverAction={reactiverAction}
      corrigerBeatmakerAction={corrigerBeatmakerAction}
      exempterGateAction={exempterGateAction}
    />
  )
}
