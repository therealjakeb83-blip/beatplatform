import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { paysValide } from '@/lib/pays'

// Pays du beatmaker (Phase 12 lot 4, Q6b) — modifiable tant qu'aucun compte
// Stripe n'existe : Stripe interdit de changer le pays d'un compte créé.
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ erreur: 'Non authentifié' }, { status: 401 })

  const { pays } = await request.json().catch(() => ({}))
  if (!paysValide(pays)) return NextResponse.json({ erreur: 'Pays invalide.' }, { status: 400 })

  const { data: beatmaker } = await supabase.from('beatmakers').select('stripe_account_id').eq('id', user.id).single()
  if (!beatmaker) return NextResponse.json({ erreur: 'Beatmaker introuvable' }, { status: 404 })
  if (beatmaker.stripe_account_id) {
    return NextResponse.json({ erreur: 'Ton compte Stripe est déjà créé : son pays ne peut plus être modifié.' }, { status: 400 })
  }

  const { error } = await supabase.from('beatmakers').update({ pays }).eq('id', user.id)
  if (error) return NextResponse.json({ erreur: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
