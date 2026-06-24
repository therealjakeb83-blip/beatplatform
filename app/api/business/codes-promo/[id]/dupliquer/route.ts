import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: original } = await admin
    .from('codes_promo')
    .select('*')
    .eq('id', id)
    .eq('beatmaker_id', user.id)
    .single()

  if (!original) return NextResponse.json({ erreur: 'Code introuvable' }, { status: 404 })

  let newCode = `${original.code}-COPY`
  const { data: existant } = await admin
    .from('codes_promo')
    .select('code')
    .eq('beatmaker_id', user.id)
    .eq('code', newCode)
    .maybeSingle()

  if (existant) {
    newCode = `${original.code}-COPY-${Date.now().toString(36).toUpperCase()}`
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _c, utilisations: _u, stripe_coupon_id: _sc, stripe_promotion_code_id: _sp, ...rest } = original

  const { data, error } = await admin
    .from('codes_promo')
    .insert({
      ...rest,
      code:                    newCode,
      utilisations:            0,
      statut:                  'inactif',
      stripe_coupon_id:        null,
      stripe_promotion_code_id: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ code: data })
}
