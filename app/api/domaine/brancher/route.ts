import { aAccesPlanPayant } from '@/lib/acces-plan'
import { brancherDomaine } from '@/lib/domaines-boutique-serveur'
import { normaliserDomaine } from '@/lib/domaine-regles'
import { beatmakerConnecte, reponseDomaine } from '../_commun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const acces = await beatmakerConnecte()
  if (acces.refus) return acces.refus

  if (!(await aAccesPlanPayant(acces.supabase, acces.beatmakerId))) {
    return Response.json({ erreur: 'Le domaine personnalisé est réservé au plan payant.' }, { status: 403 })
  }

  const corps = (await request.json().catch(() => null)) as { domaine?: unknown } | null
  const saisie = normaliserDomaine(typeof corps?.domaine === 'string' ? corps.domaine : '')
  if (!saisie.ok) return Response.json({ erreur: saisie.erreur }, { status: 400 })

  return reponseDomaine(await brancherDomaine(acces.beatmakerId, saisie.domaine))
}
