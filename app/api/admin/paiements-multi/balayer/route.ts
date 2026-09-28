import { NextResponse } from 'next/server'
import { estAdmin } from '@/lib/admin'
import { balayerPaiementsMulti } from '@/lib/paiement-multi'

export const runtime = 'nodejs'
export const maxDuration = 60

// Déclenchement manuel du balayage des paiements répartis (admin), sans
// attendre le passage automatique — `?age=0` traite aussi les tentatives
// toutes récentes (test T11 du lot 1).
export async function GET(request: Request) {
  if (!(await estAdmin())) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 403 })
  const age = Number(new URL(request.url).searchParams.get('age') ?? '30')
  const resultat = await balayerPaiementsMulti(Number.isFinite(age) && age >= 0 ? age : 30)
  return NextResponse.json(resultat)
}
