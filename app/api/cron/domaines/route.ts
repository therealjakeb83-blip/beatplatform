import { NextResponse } from 'next/server'
import { domainesAVerifier, libererDomainesOublies, verifierDomaine } from '@/lib/domaines-boutique-serveur'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const TAILLE_FILE = 200
const TAILLE_LOT = 5
const BUDGET_MS = 100_000

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })
  }

  const debut = Date.now()
  const file = await domainesAVerifier(TAILLE_FILE)
  let verifies = 0
  let impossibles = 0

  for (let i = 0; i < file.length && Date.now() - debut < BUDGET_MS; i += TAILLE_LOT) {
    const resultats = await Promise.allSettled(file.slice(i, i + TAILLE_LOT).map(verifierDomaine))
    for (const resultat of resultats) {
      if (resultat.status === 'rejected') {
        console.error('[cron domaines]', resultat.reason)
        continue
      }
      verifies++
      if (resultat.value.verificationImpossible) impossibles++
    }
  }

  const liberes = Date.now() - debut < BUDGET_MS ? await libererDomainesOublies(20) : 0
  return NextResponse.json({ ok: true, enFile: file.length, verifies, impossibles, liberes })
}
