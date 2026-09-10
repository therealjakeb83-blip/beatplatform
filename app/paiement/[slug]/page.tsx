import { notFound } from 'next/navigation'
import { Poppins } from 'next/font/google'
import { createAdminClient } from '@/utils/supabase/admin'
import { estRoleAdmin } from '@/lib/admin'
import PaiementClient from './_components/PaiementClient'
import './paiement.css'

// Page hors de l'arborescence app/[slug]/** volontairement (voir
// app/telechargement/[commandeId] pour le même principe) : elle ne doit
// hériter d'aucun chrome de boutique (header/footer/player/tabbar/thème) —
// spec design "hors-thème", toujours le même rendu noir/blanc quel que soit
// le beatmaker.
const poppins = Poppins({
  variable: '--pmt-font',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

export default async function PaiementPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: beatmaker } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, logo_url, logo_inverser_fond_clair, tva_active, tva_taux, statut, role, abonnement_exempte')
    .eq('slug', slug)
    .maybeSingle()

  if (!beatmaker) notFound()
  if (beatmaker.statut === 'suspendu') notFound()

  // Même gate que app/[slug]/layout.tsx (Étape 8b) — la boutique ne doit pas
  // exister publiquement, page de paiement comprise, tant que le beatmaker
  // n'a pas d'abonnement plateforme actif.
  if (!estRoleAdmin(beatmaker.role) && !beatmaker.abonnement_exempte) {
    const { data: abonnementActif } = await admin
      .from('abonnements_plateforme')
      .select('id')
      .eq('beatmaker_id', beatmaker.id)
      .in('statut', ['actif', 'en_essai'])
      .limit(1)
      .maybeSingle()
    if (!abonnementActif) notFound()
  }

  const { data: reglesLotData } = await admin
    .from('reductions_lot')
    .select('id, licence_id, nb_a_acheter, nb_offerts')
    .eq('beatmaker_id', beatmaker.id)
    .eq('actif', true)

  const reglesLot = (reglesLotData ?? []).map(r => ({
    id: r.id, licenceId: r.licence_id, nbAAcheter: r.nb_a_acheter, nbOfferts: r.nb_offerts,
  }))

  return (
    <div className={poppins.variable}>
      <PaiementClient
        slug={slug}
        logoUrl={beatmaker.logo_url}
        logoInverser={beatmaker.logo_inverser_fond_clair}
        nomArtiste={beatmaker.nom_artiste}
        reglesLot={reglesLot}
        tvaActive={beatmaker.tva_active}
        tvaTaux={beatmaker.tva_taux}
      />
    </div>
  )
}
