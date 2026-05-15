import { createClient } from '@/utils/supabase/server'

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { slug: rawSlug, nom_artiste, tagline, logo_url, instagram_url, youtube_url, tiktok_url } = body

  const updates: Record<string, string | null> = {}

  if (rawSlug !== undefined) {
    const slug = sanitizeSlug(rawSlug)
    if (slug.length < 3) return Response.json({ error: 'Le slug doit faire au moins 3 caractères.' }, { status: 400 })
    if (slug.length > 50) return Response.json({ error: 'Le slug ne peut pas dépasser 50 caractères.' }, { status: 400 })

    const { data: existing } = await supabase
      .from('beatmakers')
      .select('id')
      .eq('slug', slug)
      .neq('id', user.id)
      .single()

    if (existing) return Response.json({ error: 'Ce slug est déjà pris.' }, { status: 409 })
    updates.slug = slug
  }

  if (nom_artiste !== undefined) updates.nom_artiste = nom_artiste || null
  if (tagline !== undefined) updates.tagline = tagline || null
  if (logo_url !== undefined) updates.logo_url = logo_url || null
  if (instagram_url !== undefined) updates.instagram_url = instagram_url || null
  if (youtube_url !== undefined) updates.youtube_url = youtube_url || null
  if (tiktok_url !== undefined) updates.tiktok_url = tiktok_url || null

  const { error } = await supabase
    .from('beatmakers')
    .update(updates)
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true, slug: updates.slug })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('slug') ?? ''
  const slug = sanitizeSlug(raw)

  if (slug.length < 3) return Response.json({ disponible: false, slug })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { data } = await supabase
    .from('beatmakers')
    .select('id')
    .eq('slug', slug)
    .neq('id', user.id)
    .single()

  return Response.json({ disponible: !data, slug })
}
