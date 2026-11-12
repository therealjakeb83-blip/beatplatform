import { createClient } from '@/utils/supabase/server'
import { fuseauSur } from '@/lib/fuseau-horaire'
import { nettoyerSlug } from '@/lib/slug-regles'
import { changerSlugBoutique, disponibiliteSlug } from '@/lib/slug-boutique'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { slug: rawSlug, confirmation_slug, nom_artiste, tagline, logo_url, logo_inverser_fond_clair, instagram_url, youtube_url, tiktok_url, fuseau_horaire } = body

  const updates: Record<string, string | boolean | null> = {}

  const { data: actuel } = await supabase.from('beatmakers').select('slug').eq('id', user.id).maybeSingle()
  const slugVoulu = rawSlug !== undefined ? nettoyerSlug(String(rawSlug)) : undefined

  // Choix unique du slug (rang 9c bis lot 3) : adresse retapée à l'identique,
  // puis figée (refus géré par changer_slug_boutique). Slug inchangé = jamais refusé.
  let slugChoisi: string | undefined
  if (slugVoulu !== undefined && slugVoulu !== actuel?.slug) {
    if (nettoyerSlug(String(confirmation_slug ?? '')) !== slugVoulu) {
      return Response.json({ error: "Retape l'adresse exactement pour confirmer ton choix." }, { status: 400 })
    }
    const resultat = await changerSlugBoutique(user.id, slugVoulu, null)
    if (!resultat.ok) return Response.json({ error: resultat.erreur }, { status: 400 })
    slugChoisi = resultat.slug
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

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('beatmakers')
      .update(updates)
      .eq('id', user.id)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, slug: slugChoisi })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('slug') ?? ''

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  return Response.json(await disponibiliteSlug(raw, user.id))
}
