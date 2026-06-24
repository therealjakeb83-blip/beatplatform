import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { statut } = await req.json() as { statut: 'actif' | 'inactif' }
  if (!['actif', 'inactif'].includes(statut)) {
    return NextResponse.json({ erreur: 'Statut invalide' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('codes_promo')
    .update({ statut })
    .eq('id', id)
    .eq('beatmaker_id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
