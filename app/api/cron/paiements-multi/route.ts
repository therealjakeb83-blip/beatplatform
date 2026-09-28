import { NextResponse } from 'next/server'
import { balayerPaiementsMulti } from '@/lib/paiement-multi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Balayage des paiements répartis restés en plan (Phase 13, lot 1).
function estAutorise(request: Request): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

export async function GET(request: Request) {
  if (!estAutorise(request)) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  const resultat = await balayerPaiementsMulti()
  return NextResponse.json(resultat)
}
