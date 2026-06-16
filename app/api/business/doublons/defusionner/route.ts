import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ erreur: 'ID manquant' }, { status: 400 })

  // La RLS SELECT policy (beatmaker_id = auth.uid()) joue le rôle de vérification d'ownership
  const { data: existing } = await supabase
    .from('fusions_crm')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ erreur: 'Fusion introuvable' }, { status: 404 })

  // La RLS DELETE policy (beatmaker_id = auth.uid()) garantit qu'on ne supprime que ses propres fusions
  const { error } = await supabase
    .from('fusions_crm')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  revalidatePath('/dashboard/business/doublons/historique')
  revalidatePath('/dashboard/business/doublons')
  revalidatePath('/dashboard/business/contacts')

  return NextResponse.json({ ok: true })
}
