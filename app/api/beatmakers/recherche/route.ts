import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

// Recherche d'un beatmaker à inviter en collaboration — par nom d'artiste ou
// @slug UNIQUEMENT (Phase 12, Q2 du grill-me : la recherche par email a été
// retirée, elle permettait de deviner qui a un compte sur la plateforme).
//
// Client admin nécessaire ici : RLS (beatmakers_select_own, auth.uid() = id)
// empêche un beatmaker connecté de lire le profil d'un AUTRE beatmaker via le
// client authentifié — la requête renvoyait toujours un tableau vide,
// silencieusement (même piège déjà rencontré et documenté sur
// app/dashboard/business/beats/[id]/modifier/page.tsx). Sûr : seuls les
// champs déjà publics (boutique_rls.sql, policy beatmakers_select_public,
// lecture anonyme) sont sélectionnés, rien de sensible.
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().replace(/^@/, '')

  if (!q || q.length < 3) return Response.json([])

  const admin = createAdminClient()
  const { data } = await admin
    .from('beatmakers')
    .select('id, nom_artiste, slug, logo_url')
    .neq('id', user.id)
    .or(`nom_artiste.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(5)

  return Response.json(data ?? [])
}
