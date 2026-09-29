import { NextResponse } from 'next/server'
import { abandonnerTentativeMulti } from '@/lib/paiement-multi'

export const runtime = 'nodejs'

// Paiement réparti (Phase 13, lot 2) : le client a fermé ou raté la fenêtre
// de validation de sa banque — tout ce qui était réservé est annulé tout de
// suite. Sans effet sur une tentative déjà en train d'encaisser ou terminée.
export async function POST(request: Request) {
  const { setup_intent_id } = await request.json() as { setup_intent_id?: string }
  if (!setup_intent_id) return NextResponse.json({ erreur: 'Requête invalide' }, { status: 400 })
  const annulee = await abandonnerTentativeMulti(setup_intent_id)
  return NextResponse.json({ annulee })
}
