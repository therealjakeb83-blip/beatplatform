import { createClient } from '@/utils/supabase/server'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { messageRefusSlug, nettoyerSlug, refusSlug } from '@/lib/slug-regles'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { slug: rawSlug, nom_artiste, tagline, logo_url, logo_inverser_fond_clair, instagram_url, youtube_url, tiktok_url, fuseau_horaire } = body

  const updates: Record<string, string | boolean | null> = {}

  const { data: actuel } = await supabase.from('beatmakers').select('slug').eq('id', user.id).maybeSingle()
  const slugVoulu = rawSlug !== undefined ? nettoyerSlug(String(rawSlug)) : undefined

  // Slug inchangé : jamais refusé, même s'il date d'avant les règles du rang 9c bis.
  if (slugVoulu !== undefined && slugVoulu !== actuel?.slug) {
    const slug = slugVoulu
    const refus = refusSlug(slug)
    if (refus) return Response.json({ error: messageRefusSlug(refus) }, { status: 400 })

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
  if (logo_inverser_fond_clair !== undefined) updates.logo_inverser_fond_clair = !!logo_inverser_fond_clair
  if (instagram_url !== undefined) updates.instagram_url = instagram_url || null
  if (youtube_url !== undefined) updates.youtube_url = youtube_url || null
  if (tiktok_url !== undefined) updates.tiktok_url = tiktok_url || null
  // fuseauSur() valide contre la liste IANA connue et retombe sur Europe/Paris
  // si invalide — jamais d'injection d'une valeur arbitraire en base.
  if (fuseau_horaire !== undefined) updates.fuseau_horaire = fuseauSur(fuseau_horaire)

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
  const slug = nettoyerSlug(raw)

  const refus = refusSlug(slug)
  if (refus) return Response.json({ disponible: false, slug, refus: messageRefusSlug(refus) })

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
