import { estAdmin } from '@/lib/admin'
import { retirerDomaine } from '@/lib/domaines-boutique-serveur'
import { beatmakerConnecte, reponseDomaine } from '../_commun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const acces = await beatmakerConnecte()
  if (acces.refus) return acces.refus
  const resultat = await retirerDomaine(acces.beatmakerId)
  if (!resultat.ok && resultat.detail && (await estAdmin())) {
    return Response.json({ erreur: resultat.erreur, detail: resultat.detail }, { status: resultat.status })
  }
  return reponseDomaine(resultat)
}
