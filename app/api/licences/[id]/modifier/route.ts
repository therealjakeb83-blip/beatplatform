import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { beatsBloquantsBaissePrixLicence, formaterEurosCollab } from '@/lib/collaboration'

function versEntierOuNull(valeur: unknown): number | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const n = parseInt(String(valeur))
  return Number.isFinite(n) ? n : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { id } = await params
  const {
    nom, prix, actif, streams_limite,
    ventes_physiques_limite, vues_video_limite, clips_video_limite, radio_tv_limite,
    lives_performances_autorise,
  } = await request.json()

  // Un beat en collaboration ne peut pas être vendu sous son prix plancher
  // (Phase 12) : on refuse une baisse de prix qui ferait passer un de ces beats
  // sous le sien, plutôt que de découvrir le problème au moment de la vente.
  const nouveauPrix = parseInt(prix)
  if (Number.isFinite(nouveauPrix) && nouveauPrix > 0) {
    const bloquants = await beatsBloquantsBaissePrixLicence(createAdminClient(), {
      beatmakerId: user.id,
      licenceId: id,
      nouveauPrixEuros: nouveauPrix,
    })
    if (bloquants.length > 0) {
      const b = bloquants[0]
      const suite = bloquants.length > 1 ? ` (et ${bloquants.length - 1} autre${bloquants.length > 2 ? 's' : ''})` : ''
      return Response.json({
        error: `Prix trop bas : le beat « ${b.titre} »${suite}, en collaboration, ne peut pas être vendu sous ${formaterEurosCollab(b.plancherCents)}.`,
      }, { status: 400 })
    }
  }

  const { error } = await supabase.from('licences')
    .update({
      nom,
      prix: parseInt(prix),
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
