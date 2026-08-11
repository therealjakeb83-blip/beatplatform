import { createClient } from '@/utils/supabase/server'
import { TYPES_PAGES_LEGALES, type TypePageLegale } from '@/lib/pages-legales'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { type_page, contenu } = await request.json()

  const typeValide = TYPES_PAGES_LEGALES.some(t => t.type === type_page)
  if (!typeValide) return Response.json({ error: 'Type de page invalide' }, { status: 400 })
  if (typeof contenu !== 'string' || !contenu.trim()) {
    return Response.json({ error: 'Le contenu ne peut pas être vide' }, { status: 400 })
  }

  const { data: existante } = await supabase
    .from('boutique_pages_legales')
    .select('version')
    .eq('beatmaker_id', user.id)
    .eq('type_page', type_page as TypePageLegale)
    .maybeSingle()

  const { error } = await supabase
    .from('boutique_pages_legales')
    .upsert({
      beatmaker_id: user.id,
      type_page,
      contenu,
      version: (existante?.version ?? 0) + 1,
      adopte_le: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'beatmaker_id,type_page' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
