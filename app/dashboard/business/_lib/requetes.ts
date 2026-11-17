// Supabase renvoie au plus 1 000 lignes par requête, et une liste d'ids trop
// longue dans .in() dépasse la taille d'URL acceptée : sans ces deux aides,
// un CRM de plus de 1 000 contacts était tronqué sans aucun message.

type Reponse<T> = PromiseLike<{ data: T[] | null; error: unknown }>

const PAGE = 1000

// Toutes les lignes, page par page — la requête doit avoir un ordre stable (.order('id'))
export async function toutesLesLignes<T>(page: (debut: number, fin: number) => Reponse<T>): Promise<T[]> {
  const res: T[] = []
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await page(debut, debut + PAGE - 1)
    if (error) {
      console.error('[crm] lecture paginée:', error)
      throw new Error('Lecture des données CRM impossible')
    }
    res.push(...(data ?? []))
    if (!data || data.length < PAGE) return res
  }
}

// Paquets envoyés en même temps par appel de parLots (rang 9e) : sans plafond,
// 2 800 contacts = des dizaines de requêtes simultanées vers la base gratuite,
// le genre de rafale qui fait sauter le chrono de 5 s de proxy.ts.
const PAQUETS_SIMULTANES = 6

// Une requête .in() par paquet d'ids, résultats concaténés dans l'ordre des paquets
export async function parLots<T>(ids: string[], requete: (lot: string[]) => Reponse<T>, taille = 150): Promise<T[]> {
  const uniques = [...new Set(ids)]
  const lots: string[][] = []
  for (let i = 0; i < uniques.length; i += taille) lots.push(uniques.slice(i, i + taille))
  const reponses: Awaited<Reponse<T>>[] = new Array(lots.length)
  let suivant = 0
  async function ouvrier() {
    while (suivant < lots.length) {
      const i = suivant++
      reponses[i] = await requete(lots[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(PAQUETS_SIMULTANES, lots.length) }, ouvrier))
  const res: T[] = []
  for (const { data, error } of reponses) {
    if (error) {
      console.error('[crm] lecture par lots:', error)
      throw new Error('Lecture des données CRM impossible')
    }
    res.push(...(data ?? []))
  }
  return res
}
