import { siteDeLaRequete } from '@/lib/boutique-du-domaine'
import { accueilSonoo, boutiquesSonooReferencables, reponseXml, sommairePlansDeSiteXml } from '@/lib/referencement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sommaire de sonoo.app : un plan de site par boutique sans domaine actif
// (rang 9c, lot 4). Sur le domaine d'une boutique, /sitemap.xml est réécrit par
// proxy.ts vers app/[slug]/sitemap.xml et n'arrive jamais ici.
export async function GET(request: Request) {
  const site = await siteDeLaRequete(request)
  if (site.surDomaine) return new Response('Introuvable', { status: 404 })
  const slugs = await boutiquesSonooReferencables().catch(err => {
    console.error('[sitemap] Lecture des boutiques :', err)
    return [] as string[]
  })
  return reponseXml(sommairePlansDeSiteXml(slugs.map(slug => `${accueilSonoo(slug)}/sitemap.xml`)))
}
