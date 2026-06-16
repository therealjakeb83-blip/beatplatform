import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non autorisé' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ erreur: 'ID manquant' }, { status: 400 })

  // Vérification ownership : RLS SELECT garantit que seul le bon beatmaker voit sa fusion
  const { data: existing } = await supabase
    .from('fusions_crm')
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ erreur: 'Fusion introuvable' }, { status: 404 })

  // Admin client pour le DELETE : contourne la RLS qui bloque silencieusement.
  // Ownership déjà vérifié ci-dessus ; beatmaker_id filtré explicitement en double sécurité.
  const admin = createAdminClient()
  const { data: deleted, error } = await admin
    .from('fusions_crm')
    .delete()
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .select('id')

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  if (!deleted || deleted.length === 0) return NextResponse.json({ erreur: 'Suppression échouée — fusion introuvable ou déjà supprimée' }, { status: 500 })

  revalidatePath('/dashboard/business/doublons/historique')
  revalidatePath('/dashboard/business/doublons')
  revalidatePath('/dashboard/business/contacts')

  return NextResponse.json({ ok: true })
}
