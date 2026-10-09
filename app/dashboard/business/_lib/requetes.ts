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

// Une requête .in() par paquet d'ids, résultats concaténés
export async function parLots<T>(ids: string[], requete: (lot: string[]) => Reponse<T>, taille = 150): Promise<T[]> {
  const uniques = [...new Set(ids)]
  const lots: string[][] = []
  for (let i = 0; i < uniques.length; i += taille) lots.push(uniques.slice(i, i + taille))
  const reponses = await Promise.all(lots.map(lot => requete(lot)))
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
