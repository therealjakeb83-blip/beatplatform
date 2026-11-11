import { createAdminClient } from '@/utils/supabase/admin'
import { COLONNES_DOMAINE, verifierDomaine } from '@/lib/domaines-boutique-serveur'
import type { DomaineBoutique } from '@/lib/domaine-regles'
import { beatmakerConnecte } from '../_commun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DELAI_MINIMUM_MS = 15_000

// Une seule vérification par clic : elle s'ajoute à l'historique mais ne peut
// pas confirmer une panne plus tôt, seule la durée sans réponse compte.
export async function POST() {
  const acces = await beatmakerConnecte()
  if (acces.refus) return acces.refus

  const { data } = await createAdminClient()
    .from('domaines_boutique')
    .select(COLONNES_DOMAINE)
    .eq('beatmaker_id', acces.beatmakerId)
    .maybeSingle()
  const ligne = data as unknown as DomaineBoutique | null
  if (!ligne) return Response.json({ domaine: null, verificationImpossible: false })

  const derniere = ligne.derniere_verification_le ? new Date(ligne.derniere_verification_le).getTime() : 0
  if (Date.now() - derniere < DELAI_MINIMUM_MS) {
    return Response.json({ domaine: ligne, verificationImpossible: false })
  }
  return Response.json(await verifierDomaine(ligne))
}
