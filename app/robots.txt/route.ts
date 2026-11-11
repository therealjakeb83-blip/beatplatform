import { siteDeLaRequete } from '@/lib/boutique-du-domaine'
import { URL_APP } from '@/lib/constantes'
import { CHEMINS_PRIVES_BOUTIQUE, indexationOuverte } from '@/lib/referencement'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TOUT_FERME = 'User-agent: *\nDisallow: /\n'

// Un fichier par site : sonoo.app ou le domaine d'une boutique (rang 9c, lot 4).
export async function GET(request: Request) {
  const site = await siteDeLaRequete(request)
  if (!indexationOuverte() || (site.surDomaine && !site.slugDomaine)) return texte(TOUT_FERME)

  if (site.surDomaine) {
    const fermes = ['/api/', '/artiste/', '/auth/', '/paiement', '/telechargement/', ...CHEMINS_PRIVES_BOUTIQUE]
    return texte(regles(fermes, `${site.origine}/sitemap.xml`))
  }

  const fermes = [
    '/api/', '/artiste/', '/auth/', '/dashboard', '/paiement/', '/telechargement/', '/mon-compte',
    '/connexion', '/inscription', '/mot-de-passe-oublie', '/nouveau-mot-de-passe', '/confirmation-compte',
    '/maintenance', '/verification-en-cours',
    ...CHEMINS_PRIVES_BOUTIQUE.map(c => `/*${c}`),
  ]
  return texte(regles(fermes, `${URL_APP}/sitemap.xml`))
}

function regles(fermes: string[], planDeSite: string): string {
  return ['User-agent: *', 'Allow: /', ...fermes.map(c => `Disallow: ${c}`), '', `Sitemap: ${planDeSite}`, ''].join('\n')
}

function texte(contenu: string): Response {
  return new Response(contenu, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
