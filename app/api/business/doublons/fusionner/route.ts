import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const admin    = createAdminClient()

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

  // Vérifier que les deux clients appartiennent bien à ce beatmaker
  const [{ count: countConserve }, { count: countArchive }] = await Promise.all([
    supabase.from('commandes').select('*', { count: 'exact', head: true })
      .eq('beatmaker_id', user.id).eq('client_id', client_id_conserve)
      .then(r => r.count !== null && r.count > 0 ? r : supabase.from('abonnements_boutique').select('*', { count: 'exact', head: true })
        .eq('beatmaker_id', user.id).eq('client_id', client_id_conserve)
        .then(r2 => r2.count !== null && r2.count > 0 ? r2 : supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('beatmaker_id', user.id).eq('client_id', client_id_conserve)
        )
      ),
    supabase.from('commandes').select('*', { count: 'exact', head: true })
      .eq('beatmaker_id', user.id).eq('client_id', client_id_archive)
      .then(r => r.count !== null && r.count > 0 ? r : supabase.from('abonnements_boutique').select('*', { count: 'exact', head: true })
        .eq('beatmaker_id', user.id).eq('client_id', client_id_archive)
        .then(r2 => r2.count !== null && r2.count > 0 ? r2 : supabase.from('leads').select('*', { count: 'exact', head: true })
          .eq('beatmaker_id', user.id).eq('client_id', client_id_archive)
        )
      ),
  ])

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
