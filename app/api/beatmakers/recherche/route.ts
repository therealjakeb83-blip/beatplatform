import { createClient } from '@/utils/supabase/server'

// Recherche d'un beatmaker à inviter en collaboration — par nom d'artiste ou
// @slug UNIQUEMENT (Phase 12, Q2 du grill-me : la recherche par email a été
// retirée, elle permettait de deviner qui a un compte sur la plateforme).
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().replace(/^@/, '')

  if (!q || q.length < 3) return Response.json([])

  const { data } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, slug, logo_url')
    .neq('id', user.id)
    .or(`nom_artiste.ilike.%${q}%,slug.ilike.%${q}%`)
    .limit(5)

  return Response.json(data ?? [])
}
