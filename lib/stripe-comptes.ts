import Stripe from 'stripe'

// Création des comptes Stripe des vendeurs (Phase 13, Q1 du grill-me) :
// Stripe responsable des soldes négatifs (`losses.payments: 'stripe'`), frais
// Stripe payés directement par le vendeur (`fees.payer: 'account'`, donc plus
// de frais Connect pour la plateforme), exigences collectées par Stripe.
// Dashboard Express + Stripe responsable = bêta publique : elle exige une
// version d'API « preview », utilisée UNIQUEMENT pour cette création (le reste
// du code reste sur la version stable de lib/stripe.ts). Si Stripe refuse la
// bêta, repli décidé avec Jake : Dashboard Stripe complet (`full`).
type VersionApi = NonNullable<ConstructorParameters<typeof Stripe>[1]>['apiVersion']
const VERSION_API_BETA_EXPRESS = '2026-08-26.preview' as VersionApi

let _stripeBeta: Stripe | null = null
function stripeBeta(): Stripe {
  if (!_stripeBeta) {
    _stripeBeta = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: VERSION_API_BETA_EXPRESS,
    })
  }
  return _stripeBeta
}

type ParamsCompte = Omit<Stripe.AccountCreateParams, 'type' | 'controller'>

function controller(dashboard: 'express' | 'full'): Stripe.AccountCreateParams.Controller {
  return {
    losses: { payments: 'stripe' },
    fees: { payer: 'account' },
    requirement_collection: 'stripe',
    stripe_dashboard: { type: dashboard },
  }
}

export async function creerCompteVendeur(params: ParamsCompte): Promise<{ compte: Stripe.Account; dashboard: 'express' | 'full' }> {
  try {
    const compte = await stripeBeta().accounts.create({ ...params, controller: controller('express') })
    return { compte, dashboard: 'express' }
  } catch (err) {
    console.error('[stripe-comptes] Bêta Express + Stripe responsable refusée, repli sur le Dashboard complet :', err instanceof Error ? err.message : err)
    const compte = await stripeBeta().accounts.create({ ...params, controller: controller('full') })
    return { compte, dashboard: 'full' }
  }
}
