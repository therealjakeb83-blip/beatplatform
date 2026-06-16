import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const admin    = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ erreur: 'ID manquant' }, { status: 400 })

  // Vérifier que la fusion appartient bien à ce beatmaker
  const { data: existing, error: selectError } = await admin
    .from('fusions_crm')
    .select('id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  console.log('[defusionner] SELECT existing:', existing, 'error:', selectError?.message, 'user.id:', user.id, 'id:', id)

  if (!existing) return NextResponse.json({ erreur: 'Fusion introuvable', debug: { selectError: selectError?.message } }, { status: 404 })

  // Supprimer via admin (service_role bypass RLS). .select() est requis pour détecter les 0-row silences.
  const { data: deleted, error } = await admin
    .from('fusions_crm')
    .delete()
    .eq('id', id)
    .select('id')

  console.log('[defusionner] DELETE result:', deleted, 'error:', error?.message)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { erreur: `Suppression échouée (0 lignes supprimées). UUID: ${id}` },
      { status: 500 }
    )
  }

  revalidatePath('/dashboard/business/doublons/historique')
  revalidatePath('/dashboard/business/doublons')
  revalidatePath('/dashboard/business/contacts')

  return NextResponse.json({ ok: true })
}
