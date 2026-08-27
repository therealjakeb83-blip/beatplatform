import { createClient } from '@/utils/supabase/server'
import { normaliserMoyensPaiement } from '@/lib/moyens-paiement'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { moyens_paiement_acceptes } = await request.json()
  const moyens = normaliserMoyensPaiement(moyens_paiement_acceptes)

  const { error } = await supabase
    .from('beatmakers')
    .update({ moyens_paiement_acceptes: moyens })
    .eq('id', user.id)

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, moyens_paiement_acceptes: moyens })
}
