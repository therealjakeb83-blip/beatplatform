// Compte client artiste (rang 9c, lot 3) : ce qui est commun aux routes
// d'inscription, de mot de passe oublié et de confirmation.
import { createAdminClient } from '@/utils/supabase/admin'
import { cheminInterne } from '@/lib/redirection'
import { slugBoutiqueDuChemin } from '@/lib/domaine-boutique'
import { siteDeLaRequete, type SiteDemande } from '@/lib/boutique-du-domaine'
import { EVENEMENT_EMAIL_COMPTE_ARTISTE, type EmailCompteArtiste } from '@/lib/emails'

const DELAI_ENTRE_DEUX_EMAILS_MS = 60_000

export type ContexteCompteArtiste = SiteDemande & {
  redirect: string
  // Boutique de départ : celle du domaine, ou celle de l'adresse de retour sur sonoo.app.
  slug: string | null
}

export async function contexteCompteArtiste(request: Request, redirectBrut: unknown): Promise<ContexteCompteArtiste> {
  const site = await siteDeLaRequete(request)
  const redirect = cheminInterne(typeof redirectBrut === 'string' ? redirectBrut : null, '/mon-compte')
  const slug = site.surDomaine ? site.slugDomaine : slugBoutiqueDuChemin(redirect)
  return { ...site, redirect, slug }
}

export async function beatmakerIdDuSlug(slug: string | null): Promise<string | null> {
  if (!slug) return null
  const { data } = await createAdminClient().from('beatmakers').select('id').eq('slug', slug).maybeSingle()
  return (data?.id as string | undefined) ?? null
}

// Garde-fou anti-abus : ces routes envoient un email à l'adresse saisie, sans
// connexion. Au plus un email du même type par minute et par adresse.
export async function emailCompteEnvoyeRecemment(to: string, type: EmailCompteArtiste): Promise<boolean> {
  const depuis = new Date(Date.now() - DELAI_ENTRE_DEUX_EMAILS_MS).toISOString()
  const { data } = await createAdminClient()
    .from('email_logs')
    .select('id')
    .eq('destinataire', to)
    .eq('evenement', EVENEMENT_EMAIL_COMPTE_ARTISTE[type])
    .gte('created_at', depuis)
    .limit(1)
  return Boolean(data?.length)
}
