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
//   - 'tous'     : le nouveau prix s'applique partout et supprime les prix
//                spécifiques existants pour rattacher tous les beats au prix
//                général.
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
    application, beats_selectionnes, confirmer_exclusions,
  } = await request.json() as {
    nom: string; prix: unknown; actif: boolean
    streams_limite?: unknown; ventes_physiques_limite?: unknown; vues_video_limite?: unknown
    clips_video_limite?: unknown; radio_tv_limite?: unknown; lives_performances_autorise?: unknown
    application?: ApplicationPrix; beats_selectionnes?: string[]; confirmer_exclusions?: boolean
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

  // Beats existants qui utilisent cette licence. Les modes "certains" et
  // "futurs" ne figent que ceux qui suivent encore le prix général ; le mode
  // "tous" inclut aussi ceux qui avaient un prix spécifique.
  let beatIdsTous: string[] = []
  let beatIdsSansOverride: string[] = []
  let liensPrix: { beat_id: string; prix_override: number | null }[] = []
  if (prixChange) {
    const { data: liens } = await admin
      .from('beat_licences')
      .select('beat_id, prix_override, beats!inner(beatmaker_id, supprime_le)')
      .eq('licence_id', id)
      .eq('actif', true)
      .eq('beats.beatmaker_id', user.id)
      .is('beats.supprime_le', null)
    liensPrix = (liens ?? []).map(l => ({
      beat_id: l.beat_id as string,
      prix_override: l.prix_override as number | null,
    }))
    beatIdsTous = liensPrix.map(l => l.beat_id)
    beatIdsSansOverride = liensPrix
      .filter(l => l.prix_override == null)
      .map(l => l.beat_id)
  }

  // Beats qui recevront réellement le nouveau prix, pour le contrôle du
  // plancher (Phase 12) — jamais tous les beats de la licence en mode
  // "certains"/"futurs", seulement ceux qui ne sont pas figés à l'ancien prix.
  let beatIdsAVerifier: string[] | undefined
  if (prixChange) {
    if (mode === 'certains') beatIdsAVerifier = beats_selectionnes ?? []
    else if (mode === 'futurs') beatIdsAVerifier = []
    else beatIdsAVerifier = beatIdsTous
  }

  let bloquants: Awaited<ReturnType<typeof beatsBloquantsBaissePrixLicence>> = []
  if (prixChange) {
    bloquants = await beatsBloquantsBaissePrixLicence(admin, {
      beatmakerId: user.id,
      licenceId: id,
      nouveauPrixEuros: nouveauPrix,
      beatIdsAVerifier,
      inclurePrixSpecifiques: mode !== 'futurs',
    })
    if (bloquants.length > 0 && !confirmer_exclusions) {
      return Response.json({
        error: 'Certains beats en collaboration ne peuvent pas recevoir ce prix.',
        confirmation_requise: true,
        beats_exclus: bloquants.map(b => ({
          id: b.id,
          titre: b.titre,
          plancher: formaterEurosCollab(b.plancherCents),
        })),
      }, { status: 409 })
    }
  }

  const idsBloquants = new Set(bloquants.map(b => b.id))

  // Fige à l'ancien prix les beats qui ne doivent PAS suivre le changement —
  // AVANT de changer le prix général, pour qu'aucun beat n'ait, même
  // brièvement, un prix qu'on ne voulait pas lui donner.
  if (prixChange && mode !== 'tous') {
    const selectionnes = new Set(beats_selectionnes ?? [])
    const aFiger = mode === 'futurs'
      ? beatIdsSansOverride
      : beatIdsSansOverride.filter(bid => !selectionnes.has(bid) || idsBloquants.has(bid))
    if (aFiger.length > 0) {
      const { error: figeError } = await supabase
        .from('beat_licences')
        .update({ prix_override: licenceActuelle.prix })
        .eq('licence_id', id)
        .in('beat_id', aFiger)
        .is('prix_override', null)
      if (figeError) return Response.json({ error: figeError.message }, { status: 500 })
    }

    // Un beat sélectionné et éligible doit suivre le nouveau prix général,
    // même s'il possédait auparavant un prix spécifique.
    if (mode === 'certains') {
      const eligiblesSelectionnes = [...selectionnes].filter(bid => !idsBloquants.has(bid))
      if (eligiblesSelectionnes.length > 0) {
        const { error: resetSelectionError } = await supabase
          .from('beat_licences')
          .update({ prix_override: null })
          .eq('licence_id', id)
          .in('beat_id', eligiblesSelectionnes)
        if (resetSelectionError) return Response.json({ error: resetSelectionError.message }, { status: 500 })
      }
    }
  }

  // "Tous les beats" signifie aussi revenir au prix général pour ceux qui
  // avaient auparavant un prix propre.
  if (prixChange && mode === 'tous' && beatIdsTous.length > 0) {
    const eligibles = beatIdsTous.filter(bid => !idsBloquants.has(bid))
    if (eligibles.length > 0) {
      const { error: resetOverridesError } = await supabase
        .from('beat_licences')
        .update({ prix_override: null })
        .eq('licence_id', id)
        .in('beat_id', eligibles)
      if (resetOverridesError) return Response.json({ error: resetOverridesError.message }, { status: 500 })
    }
  }

  // Les beats refusés par le plancher Stripe gardent exactement leur prix
  // effectif précédent sous forme d'override.
  if (prixChange && confirmer_exclusions && idsBloquants.size > 0) {
    const prixParBeat = new Map(
      liensPrix
        .filter(l => idsBloquants.has(l.beat_id))
        .map(l => [l.beat_id, l.prix_override ?? licenceActuelle.prix]),
    )
    for (const [beatId, ancienPrix] of prixParBeat) {
      const { error: preserveError } = await supabase
        .from('beat_licences')
        .update({ prix_override: ancienPrix })
        .eq('licence_id', id)
        .eq('beat_id', beatId)
      if (preserveError) return Response.json({ error: preserveError.message }, { status: 500 })
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
