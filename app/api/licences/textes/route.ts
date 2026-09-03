import { createClient } from '@/utils/supabase/server'
import type { TypeLicenceTexte } from '@/lib/licences-textes'

// Types déjà rédigés — 'illimite' et 'exclusive' seront ajoutés dans une
// étape séparée (voir lib/licences-textes.ts). Refuser explicitement
// plutôt que de laisser sauvegarder un texte pour une catégorie qui
// n'existe pas encore côté génération de contrat.
const TYPES_DISPONIBLES: TypeLicenceTexte[] = ['standard']

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Non autorisé' }, { status: 401 })

  const { type_licence, contenu } = await request.json()

  if (!TYPES_DISPONIBLES.includes(type_licence)) {
    return Response.json({ error: 'Type de licence invalide' }, { status: 400 })
  }
  if (typeof contenu !== 'string' || !contenu.trim()) {
    return Response.json({ error: 'Le contenu ne peut pas être vide' }, { status: 400 })
  }

  const { data: existant } = await supabase
    .from('licences_textes')
    .select('version')
    .eq('beatmaker_id', user.id)
    .eq('type_licence', type_licence)
    .maybeSingle()

  const { error } = await supabase
    .from('licences_textes')
    .upsert({
      beatmaker_id: user.id,
      type_licence,
      contenu,
      version: (existant?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'beatmaker_id,type_licence' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
