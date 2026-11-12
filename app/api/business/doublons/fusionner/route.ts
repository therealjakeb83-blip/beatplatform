import { createClient } from '@/utils/supabase/server'
import { clientsLiesABoutique } from '@/app/dashboard/business/_lib/appartenance'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const {
    client_id_conserve,
    client_id_archive,
    emails_archives,
    champs_conserves,
    snapshot_archive,
    raisons,
  } = await request.json()

  if (!client_id_conserve || !client_id_archive) {
    return NextResponse.json({ erreur: 'Paramètres manquants' }, { status: 400 })
  }

  if (client_id_conserve === client_id_archive) {
    return NextResponse.json({ erreur: 'Les deux contacts doivent être différents' }, { status: 400 })
  }

  // Vérifier que les deux clients appartiennent bien à ce beatmaker (9d lot 0 :
  // le contrôle était calculé mais jamais appliqué)
  const lies = await clientsLiesABoutique(supabase, user.id, [client_id_conserve, client_id_archive])
  if (!lies.has(client_id_conserve) || !lies.has(client_id_archive)) {
    return NextResponse.json({ erreur: 'Contact introuvable' }, { status: 404 })
  }

  // Insérer la fusion via le client authentifié (RLS WITH CHECK beatmaker_id = auth.uid())
  const { error } = await supabase.from('fusions_crm').insert({
    beatmaker_id:       user.id,
    client_id_conserve,
    client_id_archive,
    emails_archives:    emails_archives   ?? [],
    champs_conserves:   champs_conserves  ?? {},
    snapshot_archive:   snapshot_archive  ?? {},
    raisons:            raisons           ?? [],
  })

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  // Nettoyer doublons_ignores si cette paire y était
  await supabase.from('doublons_ignores').delete()
    .eq('beatmaker_id', user.id)
    .or(`and(client_id_1.eq.${client_id_conserve},client_id_2.eq.${client_id_archive}),and(client_id_1.eq.${client_id_archive},client_id_2.eq.${client_id_conserve})`)

  return NextResponse.json({ ok: true })
}
