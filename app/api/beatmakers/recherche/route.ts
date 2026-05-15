import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) return Response.json([])

  const { data } = await supabase
    .from('beatmakers')
    .select('id, nom_artiste, slug, logo_url')
    .neq('id', user.id)
    .or(`nom_artiste.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(5)

  return Response.json(data ?? [])
}
