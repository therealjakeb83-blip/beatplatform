import { gunzipSync } from 'node:zlib'
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { aAccesPlanPayant } from '@/lib/acces-plan'

export const TAILLE_MAX_FICHIER = 4 * 1024 * 1024

// Beatmaker connecté (+ plan payant si demandé) ; sinon la réponse d'erreur à renvoyer
export async function beatmakerImport(exigerPlanPayant: boolean): Promise<{ beatmakerId: string } | { refus: NextResponse }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { refus: NextResponse.json({ error: 'Non connecté' }, { status: 401 }) }
  const { data: bm } = await supabase.from('beatmakers').select('id').eq('id', user.id).maybeSingle()
  if (!bm) return { refus: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) }
  if (exigerPlanPayant && !(await aAccesPlanPayant(supabase, user.id))) {
    return { refus: NextResponse.json({ error: 'L’import de commandes externes est réservé au plan payant (essai compris).' }, { status: 403 }) }
  }
  return { beatmakerId: user.id }
}

// Fichier + réponses de l'assistant (format libre, absentes au 1er envoi)
export async function lireFichierRequete(req: Request): Promise<{ octets: ArrayBuffer; nom: string; nomAffiche: string; association: unknown | null } | { refus: NextResponse }> {
  const form = await req.formData().catch(() => null)
  const fichier = form?.get('fichier')
  if (!(fichier instanceof File)) return { refus: NextResponse.json({ error: 'Aucun fichier reçu.' }, { status: 400 }) }
  if (fichier.size > TAILLE_MAX_FICHIER) return { refus: NextResponse.json({ error: 'Fichier trop lourd (4 Mo maximum).' }, { status: 400 }) }
  // Fichier compressé par le navigateur (gzip) : un gros envoi faisait arriver
  // la réponse illisible chez Vercel (vu en testant le lot 4, export de 863 Ko)
  let octets: ArrayBuffer = await fichier.arrayBuffer()
  if (form?.get('compression') === 'gzip') {
    try {
      const brutDecompresse = gunzipSync(Buffer.from(octets), { maxOutputLength: TAILLE_MAX_FICHIER + 1 })
      if (brutDecompresse.byteLength > TAILLE_MAX_FICHIER) return { refus: NextResponse.json({ error: 'Fichier trop lourd (4 Mo maximum).' }, { status: 400 }) }
      octets = brutDecompresse.buffer.slice(brutDecompresse.byteOffset, brutDecompresse.byteOffset + brutDecompresse.byteLength) as ArrayBuffer
    } catch {
      return { refus: NextResponse.json({ error: 'Fichier trop lourd (4 Mo maximum) ou illisible.' }, { status: 400 }) }
    }
  }
  const brut = form?.get('association')
  let association: unknown | null = null
  if (typeof brut === 'string' && brut) {
    try { association = JSON.parse(brut) } catch { return { refus: NextResponse.json({ error: 'Réponses de l’assistant illisibles.' }, { status: 400 }) } }
  }
  // Excel converti en CSV par le navigateur : lu comme un CSV, affiché sous son vrai nom
  const original = form?.get('nom_original')
  return { octets, nom: fichier.name, nomAffiche: typeof original === 'string' && original ? original : fichier.name, association }
}

// Réponses de l'import jamais retouchées en route : une petite réponse
// (assistant du format libre) arrivait compressée par Vercel SANS l'en-tête
// Content-Encoding, donc illisible pour le navigateur (vu en testant le lot 4)
export function reponseJson(corps: unknown, status = 200): NextResponse {
  return NextResponse.json(corps, { status, headers: { 'Cache-Control': 'no-store, no-transform' } })
}
