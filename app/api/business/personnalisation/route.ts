import { createClient } from '@/utils/supabase/server'

const HEX_RE = /^#[0-9A-Fa-f]{6}$/
const RADIUS_VALIDES = ['arrondi', 'doux', 'carre']

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { hero_titre, hero_sous_titre, theme_couleur, theme_radius } = body

  const updates: Record<string, string | null> = {}
  if (hero_titre !== undefined) updates.hero_titre = hero_titre || null
  if (hero_sous_titre !== undefined) updates.hero_sous_titre = hero_sous_titre || null
  if (theme_couleur !== undefined) {
    if (!HEX_RE.test(theme_couleur)) {
      return Response.json({ error: 'Couleur invalide' }, { status: 400 })
    }
    updates.theme_couleur = theme_couleur
  }
  if (theme_radius !== undefined) {
    if (!RADIUS_VALIDES.includes(theme_radius)) {
      return Response.json({ error: 'Radius invalide' }, { status: 400 })
    }
    updates.theme_radius = theme_radius
  }

  const { error } = await supabase
    .from('beatmakers')
    .update(updates)
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
