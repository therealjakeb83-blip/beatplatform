import { retirerDomaine } from '@/lib/domaines-boutique-serveur'
import { beatmakerConnecte, reponseDomaine } from '../_commun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const acces = await beatmakerConnecte()
  if (acces.refus) return acces.refus
  return reponseDomaine(await retirerDomaine(acces.beatmakerId))
}
