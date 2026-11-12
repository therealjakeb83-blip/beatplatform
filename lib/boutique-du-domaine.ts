// Domaine personnalisé (rang 9c, lot 3) : quelle boutique se trouve derrière
// l'adresse du site demandée ? Lu sur l'en-tête `host`, que le navigateur ne
// peut pas choisir librement (Vercel n'envoie ici que les domaines branchés).
import { headers } from 'next/headers'
import { createAdminClient } from '@/utils/supabase/admin'
import { estHotePlateforme, etiquetteSousDomaine, hoteSansPort, hoteSousDomaine } from '@/lib/domaine-boutique'
import { estSlugReserve, sousDomainePossible } from '@/lib/slug-regles'
import { SOUS_DOMAINES_OUVERTS } from '@/lib/constantes'

export type SiteDemande = {
  // Adresse du site où se trouve le client, sans « / » final.
  origine: string
  // Boutique du domaine, null sur sonoo.app (ou domaine inconnu / inactif).
  slugDomaine: string | null
  surDomaine: boolean
}

export async function slugDuDomaineActif(hote: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('domaines_boutique')
    .select('beatmakers(slug)')
    .eq('domaine', hote)
    .eq('statut', 'actif')
    .maybeSingle()
  const beatmaker = data?.beatmakers as unknown as { slug: string | null } | null | undefined
  return beatmaker?.slug ?? null
}

// Boutique d'un site de boutique : sous-domaine slug.sonoo.app (rang 9c bis) ou
// domaine perso actif. Null si l'adresse ne mène à aucune boutique.
export async function slugDuSiteBoutique(hoteBrut: string): Promise<string | null> {
  const hote = hoteSansPort(hoteBrut)
  const etiquette = etiquetteSousDomaine(hote)
  if (etiquette === null) return slugDuDomaineActif(hote)
  if (estSlugReserve(etiquette)) return null
  const { data } = await createAdminClient().from('beatmakers').select('slug').eq('slug', etiquette).maybeSingle()
  return (data?.slug as string | undefined) ?? null
}

async function siteDepuisHote(hoteBrut: string | null, origineRequete: string): Promise<SiteDemande> {
  if (estHotePlateforme(hoteBrut)) return { origine: origineRequete, slugDomaine: null, surDomaine: false }
  const hote = hoteSansPort(hoteBrut)
  return { origine: `https://${hote}`, slugDomaine: await slugDuSiteBoutique(hote), surDomaine: true }
}

export async function siteDeLaRequete(request: Request): Promise<SiteDemande> {
  return siteDepuisHote(request.headers.get('host'), new URL(request.url).origin)
}

export async function siteDeLaPage(): Promise<SiteDemande> {
  const entetes = await headers()
  const hote = entetes.get('host')
  const proto = entetes.get('x-forwarded-proto') ?? 'https'
  return siteDepuisHote(hote, `${proto}://${hote ?? 'localhost'}`)
}

// Domaine actif d'une boutique, pour un lien construit hors de toute requête.
export async function domaineActifDeLaBoutique(beatmakerId: string): Promise<string | null> {
  const { data } = await createAdminClient()
    .from('domaines_boutique')
    .select('domaine')
    .eq('beatmaker_id', beatmakerId)
    .eq('statut', 'actif')
    .maybeSingle()
  return (data?.domaine as string | undefined) ?? null
}

// Adresse propre d'une boutique, hors sonoo.app : son domaine actif, sinon son
// sous-domaine une fois les sous-domaines ouverts (rang 9c bis), sinon null.
export async function hotePropreDeLaBoutique(beatmakerId: string): Promise<string | null> {
  const domaine = await domaineActifDeLaBoutique(beatmakerId)
  if (domaine || !SOUS_DOMAINES_OUVERTS) return domaine
  const { data } = await createAdminClient().from('beatmakers').select('slug').eq('id', beatmakerId).maybeSingle()
  const slug = data?.slug as string | undefined
  return slug && sousDomainePossible(slug) ? hoteSousDomaine(slug) : null
}
