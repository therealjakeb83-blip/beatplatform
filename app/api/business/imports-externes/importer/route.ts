import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { ErreurImport } from '@/lib/import-externe/preparation'
import { ErreurTauxBce } from '@/lib/import-externe/taux-bce'
import { ErreurTableau } from '@/lib/import-externe/libre/tableau'
import { ErreurAssociation } from '@/lib/import-externe/libre/association'
import { preparerFichier } from '@/lib/import-externe/entree'
import { beatmakerImport, lireFichierRequete } from '@/lib/import-externe/route-commun'
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
    const r = await preparerFichier(admin, acces.beatmakerId, fichier.octets, fichier.nom, fichier.association)
    if (r.type === 'assistant') {
      return NextResponse.json({ error: 'Réponds d’abord aux questions de l’assistant.' }, { status: 422 })
    }
    const prep = r.preparation
    if (prep.commandes.length === 0) {
      return NextResponse.json({ error: 'Aucune nouvelle commande à importer.' }, { status: 422 })
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
      return NextResponse.json({ error: 'L’import a échoué : rien n’a été enregistré. Réessaie, et préviens le support si ça recommence.' }, { status: 500 })
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
    return NextResponse.json({ resultat: { ...data, nb_titres_non_relies: nbTitresNonRelies } })
  } catch (e) {
    if (e instanceof ErreurImport || e instanceof ErreurTauxBce || e instanceof ErreurTableau || e instanceof ErreurAssociation) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    console.error('[imports-externes/importer]', e)
    return NextResponse.json({ error: 'L’import a échoué : rien n’a été enregistré.' }, { status: 500 })
  }
}
