import { createAdminClient } from '@/utils/supabase/admin'
import { COLONNES_DOMAINE, verifierDomaine } from '@/lib/domaines-boutique-serveur'
import { ECHECS_AVANT_PROBLEME, type DomaineBoutique } from '@/lib/domaine-regles'
import { beatmakerConnecte } from '../_commun'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const DELAI_MINIMUM_MS = 15_000
const PAUSE_ENTRE_ESSAIS_MS = 3_000

// Un clic doit donner la vraie réponse tout de suite : si un domaine actif
// échoue, on réessaie aussitôt jusqu'au seuil plutôt que d'afficher « Actif ».
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

  let resultat = await verifierDomaine(ligne)
  for (let essai = 1; essai < ECHECS_AVANT_PROBLEME; essai++) {
    const d = resultat.domaine
    if (resultat.verificationImpossible || d.statut !== 'actif' || d.echecs_consecutifs === 0) break
    await new Promise(r => setTimeout(r, PAUSE_ENTRE_ESSAIS_MS))
    resultat = await verifierDomaine(d)
  }
  return Response.json(resultat)
}
