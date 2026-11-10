import { createClient } from '@/utils/supabase/server'
import type { ResultatDomaine } from '@/lib/domaines-boutique-serveur'

// Chaque action porte sur le domaine du compte connecté : aucune route ne reçoit
// d'identifiant, un beatmaker ne peut donc jamais agir sur la boutique d'un autre.
export async function beatmakerConnecte() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { refus: Response.json({ erreur: 'Non autorisé' }, { status: 401 }) } as const

  const { data: beatmaker } = await supabase.from('beatmakers').select('id, statut').eq('id', user.id).maybeSingle()
  if (!beatmaker || beatmaker.statut === 'suspendu') {
    return { refus: Response.json({ erreur: 'Non autorisé' }, { status: 403 }) } as const
  }
  return { supabase, beatmakerId: beatmaker.id as string } as const
}

export function reponseDomaine(resultat: ResultatDomaine): Response {
  if (!resultat.ok) return Response.json({ erreur: resultat.erreur }, { status: resultat.status })
  return Response.json({ domaine: resultat.domaine, verificationImpossible: resultat.verificationImpossible ?? false })
}
