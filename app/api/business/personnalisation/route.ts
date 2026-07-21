import { createClient } from '@/utils/supabase/server'
import { estAccentValide } from '@/app/[slug]/_lib/theme-accent'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { hero_titre, hero_sous_titre, theme_couleur } = body

  const updates: Record<string, string | null> = {}
  if (hero_titre !== undefined) updates.hero_titre = hero_titre || null
  if (hero_sous_titre !== undefined) updates.hero_sous_titre = hero_sous_titre || null
  if (theme_couleur !== undefined) {
    if (!estAccentValide(theme_couleur)) {
      return Response.json({ error: 'Couleur invalide' }, { status: 400 })
    }
    updates.theme_couleur = theme_couleur
  }

  const { error } = await supabase
    .from('beatmakers')
    .update(updates)
    .eq('id', user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
