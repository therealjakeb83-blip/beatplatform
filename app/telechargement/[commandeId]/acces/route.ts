import { NextResponse } from 'next/server'
import { jetonLienEmailValide, poserCookieAcces, UUID } from '@/lib/telechargement-acces'

export const runtime = 'nodejs'

// Rang 9f, Lot 1 (décision 4 bis) : lien signé de l'email de confirmation de
// l'acheteur. Ouvre la page de téléchargement sans rien taper, sur n'importe
// quel appareil, et note « lien de l'email » comme origine (preuve).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ commandeId: string }> }
) {
  const { commandeId } = await params
  const adresse = new URL(request.url)
  const jeton = adresse.searchParams.get('t')
  const suite = adresse.searchParams.get('suite')
  const page = new URL(`/telechargement/${commandeId}`, request.url)
  if (!UUID.test(commandeId) || !jetonLienEmailValide(commandeId, jeton)) {
    return NextResponse.redirect(page, 303)
  }
  // Lien direct vers une facture de l'email : on l'ouvre après avoir posé l'accès.
  const destination = suite && /^facture(-[0-9a-f-]{36})?$/i.test(suite)
    ? new URL(`/telechargement/${commandeId}/fichier/${suite}`, request.url)
    : page
  const reponse = NextResponse.redirect(destination, 303)
  poserCookieAcces(reponse.cookies, commandeId, 'acheteur', 'lien_email')
  return reponse
}
