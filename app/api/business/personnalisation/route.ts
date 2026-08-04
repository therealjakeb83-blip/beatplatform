import { createClient } from '@/utils/supabase/server'
import { estAccentValide } from '@/app/[slug]/_lib/theme-accent'
import { estMarqueAffichageValide, estStyleNomMarqueValide } from '@/app/[slug]/_lib/marque'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { hero_titre, hero_sous_titre, theme_couleur, marque_affichage, style_nom_marque } = body

  const updates: Record<string, string | null> = {}
  if (hero_titre !== undefined) updates.hero_titre = hero_titre || null
  if (hero_sous_titre !== undefined) updates.hero_sous_titre = hero_sous_titre || null
  if (theme_couleur !== undefined) {
    if (!estAccentValide(theme_couleur)) {
      return Response.json({ error: 'Couleur invalide' }, { status: 400 })
    }
    updates.theme_couleur = theme_couleur
  }
  if (marque_affichage !== undefined) {
    if (!estMarqueAffichageValide(marque_affichage)) {
      return Response.json({ error: 'Marque invalide' }, { status: 400 })
    }
    updates.marque_affichage = marque_affichage
  }
  if (style_nom_marque !== undefined) {
    if (!estStyleNomMarqueValide(style_nom_marque)) {
      return Response.json({ error: 'Style invalide' }, { status: 400 })
    }
    updates.style_nom_marque = style_nom_marque
  }

  const { error } = await supabase
    .from('beatmakers')
    .update(updates)
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
