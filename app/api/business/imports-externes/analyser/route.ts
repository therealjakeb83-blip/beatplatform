import { createAdminClient } from '@/utils/supabase/admin'
import { ErreurImport } from '@/lib/import-externe/preparation'
import { ErreurTauxBce } from '@/lib/import-externe/taux-bce'
import { ErreurTableau } from '@/lib/import-externe/libre/tableau'
import { ErreurAssociation } from '@/lib/import-externe/libre/association'
import { preparerFichier } from '@/lib/import-externe/entree'
import { beatmakerImport, lireFichierRequete, reponseJson } from '@/lib/import-externe/route-commun'

export const runtime = 'nodejs'
export const maxDuration = 60

// Écran de vérification : lit le fichier et calcule l'aperçu, n'écrit RIEN.
// Format libre sans réponses de l'assistant → renvoie de quoi lancer l'assistant.
export async function POST(req: Request) {
  const acces = await beatmakerImport(true)
  if ('refus' in acces) return acces.refus
  const fichier = await lireFichierRequete(req)
  if ('refus' in fichier) return fichier.refus

  try {
    const r = await preparerFichier(createAdminClient(), acces.beatmakerId, fichier.octets, fichier.nom, fichier.association, fichier.nomAffiche)
    if (r.type === 'assistant') return reponseJson({ assistant: r.besoin })
    return reponseJson({ apercu: r.preparation.apercu })
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof ErreurTauxBce || e instanceof ErreurTableau || e instanceof ErreurAssociation) {
      return reponseJson({ error: e.message }, 422)
    }
    console.error('[imports-externes/analyser]', e)
    return reponseJson({ error: 'Lecture du fichier impossible.' }, 500)
  }
}
