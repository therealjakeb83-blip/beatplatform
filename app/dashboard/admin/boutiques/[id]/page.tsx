import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import BoutiqueDetailClient from './_components/BoutiqueDetailClient'
import { suspendreAction, reactiverAction, corrigerBeatmakerAction } from './_lib/actions'

export default async function BoutiqueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, email, nom_artiste, slug, tagline, bio, telephone, adresse, ville, code_postal, pays, numero_entreprise, notes_admin, statut, suspendu_le, suspendu_raison, created_at, stripe_account_id, devise')
    .eq('id', id)
    .maybeSingle()

  if (!beatmaker) notFound()

  const [{ count: nbClients }, { count: nbCommandes }, { data: aboPlateforme }, { count: nbAbosArtistesActifs }] = await Promise.all([
    admin.from('leads').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id),
    admin.from('commandes').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id),
    admin.from('abonnements_plateforme').select('statut').eq('beatmaker_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('abonnements_boutique').select('id', { count: 'exact', head: true }).eq('beatmaker_id', id).eq('statut', 'actif'),
  ])

  return (
    <BoutiqueDetailClient
      beatmaker={beatmaker}
      nbClients={nbClients ?? 0}
      nbCommandes={nbCommandes ?? 0}
      statutAbonnementPlateforme={aboPlateforme?.statut ?? null}
      nbAbosArtistesActifs={nbAbosArtistesActifs ?? 0}
      suspendreAction={suspendreAction}
      reactiverAction={reactiverAction}
      corrigerBeatmakerAction={corrigerBeatmakerAction}
    />
  )
}
