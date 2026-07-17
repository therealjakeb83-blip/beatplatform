import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { sauvegarderCouleurMarque, sauvegarderSignatureTransactionnels, sauvegarderFooterReseaux, sauvegarderTemplate, genererApercu } from './_lib/actions'
import TransactionnelsClient from './_components/TransactionnelsClient'
import type { TypeTemplateTransactionnel } from '@/lib/emails'

export default async function TransactionnelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const [{ data: beatmaker }, { data: templatesRaw }] = await Promise.all([
    supabase.from('beatmakers').select('nom_artiste, logo_url, couleur_marque, signature_transactionnels, footer_message_reseaux, titre_footer_reseaux').eq('id', user.id).single(),
    supabase.from('templates_transactionnels').select('type, titre, intro').eq('beatmaker_id', user.id),
  ])

  if (!beatmaker) redirect('/')

  const templatesParType = new Map(
    (templatesRaw ?? []).map(t => [t.type as TypeTemplateTransactionnel, { titre: t.titre as string | null, intro: t.intro as string | null }]),
  )
  const TYPES: TypeTemplateTransactionnel[] = [
    'confirmation_commande',
    'confirmation_abonnement',
    'demande_annulation_abonnement',
    'annulation_abonnement',
    'confirmation_compte_artiste',
    'telechargement_gratuit',
    'beat_cadeau_fidelite',
  ]
  const templates = Object.fromEntries(
    TYPES.map(type => [type, {
      titre: templatesParType.get(type)?.titre ?? '',
      intro: templatesParType.get(type)?.intro ?? '',
    }]),
  ) as Record<TypeTemplateTransactionnel, { titre: string; intro: string }>

  return (
    <TransactionnelsClient
      nomArtiste={beatmaker.nom_artiste}
      logoUrl={beatmaker.logo_url}
      couleurMarque={beatmaker.couleur_marque}
      signatureTransactionnels={beatmaker.signature_transactionnels}
      footerMessageReseaux={beatmaker.footer_message_reseaux}
      titreFooterReseaux={beatmaker.titre_footer_reseaux}
      templates={templates}
      sauvegarderCouleurMarque={sauvegarderCouleurMarque}
      sauvegarderSignatureTransactionnels={sauvegarderSignatureTransactionnels}
      sauvegarderFooterReseaux={sauvegarderFooterReseaux}
      sauvegarderTemplate={sauvegarderTemplate}
      genererApercu={genererApercu}
    />
  )
}
