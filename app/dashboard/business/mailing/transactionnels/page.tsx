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
  const intros: Record<TypeTemplateTransactionnel, string> = {
    confirmation_commande: introParType.get('confirmation_commande') ?? '',
    confirmation_abonnement: introParType.get('confirmation_abonnement') ?? '',
    demande_annulation_abonnement: introParType.get('demande_annulation_abonnement') ?? '',
    annulation_abonnement: introParType.get('annulation_abonnement') ?? '',
    beat_cadeau_fidelite: introParType.get('beat_cadeau_fidelite') ?? '',
  }

  return (
    <TransactionnelsClient
      nomArtiste={beatmaker.nom_artiste}
      logoUrl={beatmaker.logo_url}
      signatureEmails={beatmaker.signature_emails}
      couleurMarque={beatmaker.couleur_marque}
      intros={intros}
      sauvegarderCouleurMarque={sauvegarderCouleurMarque}
      sauvegarderIntro={sauvegarderIntro}
      genererApercu={genererApercu}
    />
  )
}
