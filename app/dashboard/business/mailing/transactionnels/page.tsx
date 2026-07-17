import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { sauvegarderCouleurMarque, sauvegarderIntro, genererApercu } from './_lib/actions'
import TransactionnelsClient from './_components/TransactionnelsClient'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

export default async function TransactionnelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: beatmaker }, { data: templatesRaw }] = await Promise.all([
    supabase.from('beatmakers').select('nom_artiste, logo_url, signature_emails, couleur_marque').eq('id', user.id).single(),
    supabase.from('templates_transactionnels').select('type, intro').eq('beatmaker_id', user.id),
  ])

  if (!beatmaker) redirect('/')

  const introParType = new Map(
    (templatesRaw ?? []).map(t => [t.type as TypeTemplateTransactionnel, t.intro as string | null]),
  )

  return (
    <TransactionnelsClient
      nomArtiste={beatmaker.nom_artiste}
      logoUrl={beatmaker.logo_url}
      signatureEmails={beatmaker.signature_emails}
      couleurMarque={beatmaker.couleur_marque}
      introConfirmationCommande={introParType.get('confirmation_commande') ?? null}
      introConfirmationAbonnement={introParType.get('confirmation_abonnement') ?? null}
      introAnnulationAbonnement={introParType.get('annulation_abonnement') ?? null}
      sauvegarderCouleurMarque={sauvegarderCouleurMarque}
      sauvegarderIntro={sauvegarderIntro}
      genererApercu={genererApercu}
    />
  )
}
