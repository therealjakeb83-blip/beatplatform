import { createAdminClient } from '@/utils/supabase/admin'
import { ErreurImport } from '@/lib/import-externe/preparation'
import { ErreurTauxBce } from '@/lib/import-externe/taux-bce'
import { ErreurTableau } from '@/lib/import-externe/libre/tableau'
import { ErreurAssociation } from '@/lib/import-externe/libre/association'
import { preparerFichier } from '@/lib/import-externe/entree'
import { beatmakerImport, lireFichierRequete, reponseJson } from '@/lib/import-externe/route-commun'
import { beatsMemorisesParCle, chargerGroupesTitres, normaliserTitre } from '@/lib/import-externe/liens-beats'

export const runtime = 'nodejs'
export const maxDuration = 120

// Import : le serveur relit le fichier et recalcule tout (rien n'est repris du
// navigateur), puis écrit en une seule transaction (tout ou rien). Format
// libre : les réponses de l'assistant sont mémorisées pour ce jeu de colonnes.
export async function POST(req: Request) {
  const acces = await beatmakerImport(true)
  if ('refus' in acces) return acces.refus
  const fichier = await lireFichierRequete(req)
  if ('refus' in fichier) return fichier.refus

  const admin = createAdminClient()
  try {
    const r = await preparerFichier(admin, acces.beatmakerId, fichier.octets, fichier.nom, fichier.association, fichier.nomAffiche)
    if (r.type === 'assistant') {
      return reponseJson({ error: 'Réponds d’abord aux questions de l’assistant.' }, 422)
    }
    const prep = r.preparation
    if (prep.commandes.length === 0) {
      return reponseJson({ error: 'Aucune nouvelle commande à importer.' }, 422)
    }
    // Titres déjà reliés lors d'un import précédent : reliés tout de suite
    const memoire = await beatsMemorisesParCle(admin, acces.beatmakerId)
    for (const c of prep.commandes) {
      for (const l of c.lignes) l.beat_id = l.titre ? memoire.get(normaliserTitre(l.titre)) ?? null : null
    }
    const { data, error } = await admin.rpc('importer_commandes_externes', {
      p_beatmaker_id: acces.beatmakerId,
      p_import: prep.importMeta,
      p_contacts: prep.contacts,
      p_commandes: prep.commandes,
    })
    if (error) {
      console.error('[imports-externes/importer] rpc:', error)
      return reponseJson({ error: 'L’import a échoué : rien n’a été enregistré. Réessaie, et préviens le support si ça recommence.' }, 500)
    }
    if (r.association && r.signature && r.enTetes) {
      const { error: errFormat } = await admin.from('formats_import_externes').upsert({
        beatmaker_id: acces.beatmakerId,
        signature: r.signature,
        en_tetes: r.enTetes,
        association: r.association,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'beatmaker_id,signature' })
      if (errFormat) console.error('[imports-externes/importer] mémoire du format:', errFormat)
    }
    const { groupes } = await chargerGroupesTitres(admin, acces.beatmakerId)
    const nbTitresNonRelies = groupes.filter(g => g.decision === 'a_traiter').length
    return reponseJson({ resultat: { ...data, nb_titres_non_relies: nbTitresNonRelies } })
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof ErreurTauxBce || e instanceof ErreurTableau || e instanceof ErreurAssociation) {
      return reponseJson({ error: e.message }, 422)
    }
    console.error('[imports-externes/importer]', e)
    return reponseJson({ error: 'L’import a échoué : rien n’a été enregistré.' }, 500)
  }
}
