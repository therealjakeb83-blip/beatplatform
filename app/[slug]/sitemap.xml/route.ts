import { siteDeLaRequete } from '@/lib/boutique-du-domaine'
import { accueilSonoo, cheminsReferencables, planDeSiteXml, reponseXml } from '@/lib/referencement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Plan de site d'une boutique (rang 9c, lot 4) : domaine/sitemap.xml (réécrit ici
// par proxy.ts) ou sonoo.app/slug/sitemap.xml sans domaine. Sur sonoo.app, une
// boutique à domaine actif est déjà renvoyée vers son domaine par proxy.ts.
// Boutique non référençable (invisible ou sans beat en vente) = plan vide.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const site = await siteDeLaRequete(request)
  if (site.surDomaine && site.slugDomaine !== slug) return new Response('Introuvable', { status: 404 })

  const accueil = site.surDomaine ? site.origine : accueilSonoo(slug)
  const chemins = await cheminsReferencables(slug).catch(err => {
    console.error('[sitemap] Boutique', slug, ':', err)
    return null
  })
  return reponseXml(planDeSiteXml((chemins ?? []).map(c => `${accueil}${c}`)))
}
