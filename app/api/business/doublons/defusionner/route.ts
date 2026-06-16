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
  const { data: existing } = await admin
    .from('fusions_crm')
    .select('id')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .maybeSingle()

  console.log('[defusionner] SELECT existing:', existing, 'user.id:', user.id, 'id:', id)

  if (!existing) return NextResponse.json({ erreur: 'Fusion introuvable' }, { status: 404 })

  // DELETE via le client authentifié (user context) — le client admin bypass RLS mais échoue silencieusement
  // sur le DELETE dans cette config PostgREST. Le client user a auth.uid() = beatmaker_id → RLS OK.
  const { error } = await supabase
    .from('fusions_crm')
    .delete()
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  console.log('[defusionner] DELETE error:', error?.message ?? 'null (OK)')

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  // Vérifier que la suppression a bien eu lieu (SELECT post-delete)
  const { data: stillExists } = await admin
    .from('fusions_crm')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  console.log('[defusionner] stillExists après DELETE:', stillExists)

  if (stillExists) {
    return NextResponse.json(
      { erreur: `Suppression échouée — la ligne existe encore. UUID: ${id}` },
      { status: 500 }
    )
  }

  revalidatePath('/dashboard/business/doublons/historique')
  revalidatePath('/dashboard/business/doublons')
  revalidatePath('/dashboard/business/contacts')

  return NextResponse.json({ ok: true })
}
