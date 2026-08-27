import { createClient } from '@/utils/supabase/server'
import { MANDAT_FULFILLMENT_VERSION_ACTUELLE } from '@/lib/fulfillment'
import { NextResponse } from 'next/server'

// Une seule route POST (pas de DELETE pour la révocation — cf. règle Vercel
// DELETE body) avec une action explicite dans le corps.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { action } = await request.json() as { action?: 'accepter' | 'revoquer' }

  if (action === 'accepter') {
    const { error } = await supabase
      .from('beatmakers')
      .update({
        fulfillment_mandat_version: MANDAT_FULFILLMENT_VERSION_ACTUELLE,
        fulfillment_mandat_accepte_at: new Date().toISOString(),
        fulfillment_mandat_revoque_at: null,
      })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'revoquer') {
    const { error } = await supabase
      .from('beatmakers')
      .update({ fulfillment_mandat_revoque_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ erreur: 'Action invalide' }, { status: 400 })
}
