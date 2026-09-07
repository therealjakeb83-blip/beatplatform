import { createClient } from '@/utils/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { licence_id, contenu } = await request.json()

  if (typeof licence_id !== 'string') {
    return Response.json({ error: 'Licence invalide' }, { status: 400 })
  }
  if (typeof contenu !== 'string' || !contenu.trim()) {
    return Response.json({ error: 'Le contenu ne peut pas être vide' }, { status: 400 })
  }

  // Vérifie que la licence appartient bien au beatmaker connecté avant
  // d'écrire quoi que ce soit.
  const { data: licence } = await supabase
    .from('licences')
    .select('id')
    .eq('id', licence_id)
    .eq('beatmaker_id', user.id)
    .maybeSingle()
  if (!licence) return Response.json({ error: 'Licence introuvable' }, { status: 404 })

  const { data: existant } = await supabase
    .from('licences_textes')
    .select('version')
    .eq('licence_id', licence_id)
    .maybeSingle()

  const { error } = await supabase
    .from('licences_textes')
    .upsert({
      licence_id,
      beatmaker_id: user.id,
      contenu,
      version: (existant?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'licence_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
