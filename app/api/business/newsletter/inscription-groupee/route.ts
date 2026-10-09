import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { aAccesPlanPayant } from '@/lib/acces-plan'
import { TEXTE_CONFIRMATION_INSCRIPTION_GROUPEE } from '@/lib/newsletter-statut'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST { client_ids, simulation: true }  → décompte seul, rien n'est écrit
// POST { client_ids, confirme: true }    → inscription + trace
// Un contact désinscrit de lui-même n'est jamais réinscrit. Aucun email envoyé.
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non connecté' }, { status: 401 })
  if (!(await aAccesPlanPayant(supabase, user.id))) {
    return NextResponse.json({ erreur: 'Réservé au plan payant.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { client_ids?: unknown; simulation?: unknown; confirme?: unknown } | null
  const ids = Array.isArray(body?.client_ids) ? body.client_ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)) : []
  if (ids.length === 0) return NextResponse.json({ erreur: 'Aucun contact sélectionné' }, { status: 400 })
  const simulation = body?.simulation === true
  if (!simulation && body?.confirme !== true) {
    return NextResponse.json({ erreur: 'La case de confirmation doit être cochée.' }, { status: 400 })
  }

  const { data, error } = await createAdminClient().rpc('inscrire_newsletter_groupe', {
    p_beatmaker_id: user.id,
    p_client_ids: [...new Set(ids)],
    p_texte: TEXTE_CONFIRMATION_INSCRIPTION_GROUPEE,
    p_simulation: simulation,
  })
  if (error) {
    console.error('[newsletter/inscription-groupee]', error)
    return NextResponse.json({ erreur: 'L’inscription a échoué : rien n’a été modifié.' }, { status: 500 })
  }
  return NextResponse.json({ resultat: data })
}
