// Adresse officielle d'une boutique dans un lien envoyé hors de toute page
// (emails, campagnes, automatisations) — rang 9c, lot 4 : son domaine s'il
// est Actif, sinon sonoo.app/slug. Les emails aux beatmakers restent sur sonoo.app.
import { URL_APP } from '@/lib/constantes'
import { domaineActifDeLaBoutique } from '@/lib/boutique-du-domaine'

export type AdresseBoutique = {
  // Site où vivent les pages hors boutique (/telechargement, /api…), sans « / » final.
  site: string
  // Accueil de la boutique, sans « / » final : on y colle '/beats', '/mon-compte'…
  accueil: string
}

export function adresseBoutique(slug: string, domaine: string | null): AdresseBoutique {
  if (domaine) return { site: `https://${domaine}`, accueil: `https://${domaine}` }
  return { site: URL_APP, accueil: `${URL_APP}/${slug}` }
}

// En cas d'erreur de lecture, sonoo.app : il redirige de lui-même vers le domaine.
export async function adresseDeLaBoutique(beatmakerId: string, slug: string): Promise<AdresseBoutique> {
  const domaine = await domaineActifDeLaBoutique(beatmakerId).catch(() => null)
  return adresseBoutique(slug, domaine)
}
