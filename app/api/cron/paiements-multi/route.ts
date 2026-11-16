import { NextResponse } from 'next/server'
import { balayerPaiementsMulti } from '@/lib/paiement-multi'
import { completerCommandesEnAttente } from '@/lib/completion-commande'
import { effacerIpEchues } from '@/lib/ip-echues'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Tâche de nuit : balayage des paiements répartis restés en plan (Phase 13,
// lot 1) puis réparation des commandes incomplètes (lot 5).
function estAutorise(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!estAutorise(request)) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  const resultat = await balayerPaiementsMulti()
  const completion = await completerCommandesEnAttente()
  // 9d lot 4 : IP des contacts effacés, 120 jours après l'achat
  const ip = await effacerIpEchues()
  return NextResponse.json({ ...resultat, completion, ip })
}
