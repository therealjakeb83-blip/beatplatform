import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { stripe } from '@/lib/stripe'
import CodesPromoClient from './CodesPromoClient'

export default async function CodesPromoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  let coupons: Awaited<ReturnType<typeof stripe.coupons.list>>['data'] = []
  let promoCodes: Awaited<ReturnType<typeof stripe.promotionCodes.list>>['data'] = []

  try {
    const [c, p] = await Promise.all([
      stripe.coupons.list({ limit: 50 }),
      stripe.promotionCodes.list({ limit: 50, active: true }),
    ])
    coupons = c.data
    promoCodes = p.data
  } catch {
    // Stripe non configuré ou clé invalide — on affiche la page vide
  }

  return <CodesPromoClient coupons={coupons} promoCodes={promoCodes} />
}
