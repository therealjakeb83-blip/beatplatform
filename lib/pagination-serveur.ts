import { cookies } from 'next/headers'
import { COOKIE_TAILLE_PAGE, lireTaillePage, type TaillePage } from './pagination'

export async function tailleTableaux(): Promise<TaillePage> {
  const jar = await cookies()
  return lireTaillePage(jar.get(COOKIE_TAILLE_PAGE)?.value)
}
