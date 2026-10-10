import type { SupabaseClient } from '@supabase/supabase-js'
import { lireBeatStars } from './beatstars'
import { preparerImport, type Preparation } from './preparation'
import { decoderTexte, estExcel, lireTableau, signatureEnTetes } from './libre/tableau'
import { verifierAssociation, type Association } from './libre/association'
import { preparerImportLibre } from './libre/preparation-libre'

// Point d'entrée d'un import : 1re étape = DÉTECTION DU FORMAT (règle de Jake,
// 2026-10-10). Export BeatStars reconnu → règles BeatStars ; tout autre
// fichier → format libre, qui demande d'abord les réponses de l'assistant.

export type LicenceBoutique = { id: string; nom: string }

export type BesoinAssistant = {
  formatMemorise: Association | null
  licences: LicenceBoutique[]
}

export type ResultatPreparation =
  | { type: 'preparation'; preparation: Preparation; signature: string | null; enTetes: string[] | null; association: Association | null }
  | { type: 'assistant'; besoin: BesoinAssistant }

export async function licencesBoutique(admin: SupabaseClient, beatmakerId: string): Promise<LicenceBoutique[]> {
  const { data } = await admin.from('licences').select('id, nom, ordre').eq('beatmaker_id', beatmakerId).order('ordre')
  return (data ?? []).map(l => ({ id: l.id, nom: l.nom }))
}

export async function formatMemorise(admin: SupabaseClient, beatmakerId: string, signature: string): Promise<Association | null> {
  const { data } = await admin.from('formats_import_externes').select('association')
    .eq('beatmaker_id', beatmakerId).eq('signature', signature).maybeSingle()
  return (data?.association as Association | undefined) ?? null
}

export async function preparerFichier(
  admin: SupabaseClient,
  beatmakerId: string,
  octets: ArrayBuffer,
  nomFichier: string,
  associationBrute: unknown | null,
): Promise<ResultatPreparation> {
  if (!estExcel(nomFichier)) {
    const texte = decoderTexte(octets)
    if (lireBeatStars(texte)) {
      return { type: 'preparation', preparation: await preparerImport(admin, beatmakerId, texte, nomFichier), signature: null, enTetes: null, association: null }
    }
  }
  const tableau = await lireTableau(nomFichier, octets)
  const signature = signatureEnTetes(tableau.enTetes)
  if (associationBrute === null) {
    const [memorise, licences] = await Promise.all([
      formatMemorise(admin, beatmakerId, signature),
      licencesBoutique(admin, beatmakerId),
    ])
    return { type: 'assistant', besoin: { formatMemorise: memorise, licences } }
  }
  const association = verifierAssociation(associationBrute, tableau.enTetes.length)
  const preparation = await preparerImportLibre(admin, beatmakerId, tableau, association, nomFichier)
  return { type: 'preparation', preparation, signature, enTetes: tableau.enTetes, association }
}
