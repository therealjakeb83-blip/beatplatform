import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { beatsBloquantsBaissePrixLicence, formaterEurosCollab } from '@/lib/collaboration'

function versEntierOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = parseInt(String(valeur))
  return Number.isFinite(n) ? n : null
}

// Application d'un changement de PRIX GÉNÉRAL (Phase 12) : les prix de
// licence sont globaux au beatmaker, donc un changement ici touche par
// défaut tous les beats qui utilisent cette licence. Trois choix possibles :
//   - 'tous'     (comportement historique) : le nouveau prix s'applique
//                partout, sauf aux beats qui ont déjà un prix spécifique.
//   - 'certains' : seuls les beats de `beats_selectionnes` reçoivent le
//                nouveau prix ; tous les autres beats utilisant la licence
//                sont figés à l'ANCIEN prix (un prix spécifique leur est
//                écrit, pour qu'ils ne bougent plus tant qu'on n'y touche pas).
//   - 'futurs'   : aucun beat existant ne change (tous figés à l'ancien prix) ;
//                seuls les beats créés après ce changement suivront le
//                nouveau prix général.
type ApplicationPrix = 'tous' | 'certains' | 'futurs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const {
    nom, prix, actif, streams_limite,
    ventes_physiques_limite, vues_video_limite, clips_video_limite, radio_tv_limite,
    lives_performances_autorise,
    application, beats_selectionnes,
  } = await request.json() as {
    nom: string; prix: unknown; actif: boolean
    streams_limite?: unknown; ventes_physiques_limite?: unknown; vues_video_limite?: unknown
    clips_video_limite?: unknown; radio_tv_limite?: unknown; lives_performances_autorise?: unknown
    application?: ApplicationPrix; beats_selectionnes?: string[]
  }

  const { data: licenceActuelle } = await supabase
    .from('licences')
    .select('prix')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()
  if (!licenceActuelle) return Response.json({ error: 'Licence introuvable' }, { status: 404 })

  const nouveauPrix = parseInt(String(prix))
  const prixChange = Number.isFinite(nouveauPrix) && nouveauPrix > 0 && nouveauPrix !== licenceActuelle.prix
  const mode: ApplicationPrix = application ?? 'tous'
  const admin = createAdminClient()

  // Beats qui utilisent cette licence et n'ont pas déjà de prix spécifique —
  // seuls ceux-là sont concernés par le choix "tous/certains/futurs".
  let beatIdsSansOverride: string[] = []
  if (prixChange && mode !== 'tous') {
    const { data: liens } = await admin
      .from('beat_licences')
      .select('beat_id, beats!inner(beatmaker_id, supprime_le)')
      .eq('licence_id', id)
      .eq('actif', true)
      .is('prix_override', null)
      .eq('beats.beatmaker_id', user.id)
      .is('beats.supprime_le', null)
    beatIdsSansOverride = (liens ?? []).map(l => l.beat_id as string)
  }

  // Beats qui recevront réellement le nouveau prix, pour le contrôle du
  // plancher (Phase 12) — jamais tous les beats de la licence en mode
  // "certains"/"futurs", seulement ceux qui ne sont pas figés à l'ancien prix.
  let beatIdsAVerifier: string[] | undefined
  if (prixChange) {
    if (mode === 'certains') beatIdsAVerifier = beats_selectionnes ?? []
    else if (mode === 'futurs') beatIdsAVerifier = []
    // mode === 'tous' : undefined -> comportement par défaut (tous les beats
    // de la licence sans prix spécifique déjà existant).
  }

  if (prixChange) {
    const bloquants = await beatsBloquantsBaissePrixLicence(admin, {
      beatmakerId: user.id,
      licenceId: id,
      nouveauPrixEuros: nouveauPrix,
      beatIdsAVerifier,
    })
    if (bloquants.length > 0) {
      const b = bloquants[0]
      const suite = bloquants.length > 1 ? ` (et ${bloquants.length - 1} autre${bloquants.length > 2 ? 's' : ''})` : ''
      return Response.json({
        error: `Prix trop bas : le beat « ${b.titre} »${suite}, en collaboration, ne peut pas être vendu sous ${formaterEurosCollab(b.plancherCents)}.`,
      }, { status: 400 })
    }
  }

  // Fige à l'ancien prix les beats qui ne doivent PAS suivre le changement —
  // AVANT de changer le prix général, pour qu'aucun beat n'ait, même
  // brièvement, un prix qu'on ne voulait pas lui donner.
  if (prixChange && mode !== 'tous') {
    const selectionnes = new Set(beats_selectionnes ?? [])
    const aFiger = mode === 'futurs' ? beatIdsSansOverride : beatIdsSansOverride.filter(bid => !selectionnes.has(bid))
    if (aFiger.length > 0) {
      const { error: figeError } = await admin
        .from('beat_licences')
        .update({ prix_override: licenceActuelle.prix })
        .eq('licence_id', id)
        .in('beat_id', aFiger)
        .is('prix_override', null)
      if (figeError) return Response.json({ error: figeError.message }, { status: 500 })
    }
  }

  const { error } = await supabase.from('licences')
    .update({
      nom,
      prix: parseInt(String(prix)),
      actif,
      streams_limite: versEntierOuNull(streams_limite),
      ventes_physiques_limite: versEntierOuNull(ventes_physiques_limite),
      vues_video_limite: versEntierOuNull(vues_video_limite),
      clips_video_limite: versEntierOuNull(clips_video_limite),
      radio_tv_limite: versEntierOuNull(radio_tv_limite),
      lives_performances_autorise: !!lives_performances_autorise,
    })
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
