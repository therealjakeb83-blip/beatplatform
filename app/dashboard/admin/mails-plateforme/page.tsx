import { createAdminClient } from '@/utils/supabase/admin'
import { sauvegarderTemplatePlateforme, genererApercuPlateforme } from './_lib/actions'
import MailsPlateformeClient from './_components/MailsPlateformeClient'
import type { TypeTemplatePlateforme } from '@/lib/emails'

const TYPES: TypeTemplatePlateforme[] = ['bienvenue', 'confirmation_essai', 'rappel_fin_essai', 'paiement_echoue', 'annulation']

export default async function MailsPlateformePage() {
  const admin = createAdminClient()
  const { data: templatesRaw } = await admin.from('templates_plateforme').select('type, titre, intro')

  const parType = new Map(
    (templatesRaw ?? []).map(t => [t.type as TypeTemplatePlateforme, { titre: t.titre as string | null, intro: t.intro as string | null }]),
  )
  const templates = Object.fromEntries(
    TYPES.map(type => [type, { titre: parType.get(type)?.titre ?? '', intro: parType.get(type)?.intro ?? '' }]),
  ) as Record<TypeTemplatePlateforme, { titre: string; intro: string }>

  return (
    <MailsPlateformeClient
      templates={templates}
      sauvegarderTemplate={sauvegarderTemplatePlateforme}
      genererApercu={genererApercuPlateforme}
    />
  )
}
