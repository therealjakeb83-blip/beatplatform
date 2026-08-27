'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripeExpressCheckoutElementReadyEvent, StripeExpressCheckoutElementClickEvent, StripeExpressCheckoutElementConfirmEvent, StripeExpressCheckoutElementOptions } from '@stripe/stripe-js'
import { stripePromise, chargerStripePourCompte } from '@/lib/stripe-client'
import { selectExpressPaymentMethods, type ExpressMethod } from '../_lib/express-payments'
import { useCart, type CartItem } from './CartContext'

// Version panier (multi-articles) de LicenceExpressPay.tsx — duplique
// volontairement la même logique de détection/priorité Apple Pay > Google
// Pay + PayPal (voir ce fichier pour le détail des choix), adaptée pour
// payer tout le panier en un seul PaymentIntent au lieu d'un beat unique.

const MONTANT_DETECTION_CENTS = 1000
const DELAI_DETECTION_MS = 8000

export type ExpressStatus = 'loading' | 'visible' | 'hidden'

type Props = {
  slug: string
  items: CartItem[]
  onStatusChange: (status: ExpressStatus) => void
  onSuccess: (info: { paymentIntentId: string }) => void
}

type ContextePaiement = { mode: 'direct' | 'destination'; on_behalf_of: string | null; stripe_account_id: string | null }

export default function CartExpressPay(props: Props) {
  const { slug, items } = props
  const beatIdsKey = [...new Set(items.map(i => i.beatId))].sort().join(',')
  // Voir LicenceExpressPay.tsx : PayPal n'accepte pas `on_behalf_of` côté
  // Stripe — le résoudre après le montage d'Elements (ancien comportement)
  // faisait apparaître puis disparaître silencieusement le bouton PayPal dès
  // que la mise à jour était prise en compte. Résolu ici AVANT le montage.
  const [contexte, setContexte] = useState<ContextePaiement | null | undefined>(undefined)

  useEffect(() => {
    if (!beatIdsKey) return
    let annule = false
    fetch('/api/stripe/on-behalf-of', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, beat_ids: beatIdsKey.split(',') }),
    })
      .then(r => r.json())
      .then((data: ContextePaiement) => { if (!annule) setContexte(data) })
      .catch(() => { if (!annule) setContexte(null) })
    return () => { annule = true }
  }, [slug, beatIdsKey])

  // Panier vide : pas d'article donc pas d'appel API à faire, mais on ne
  // reste jamais bloqué en "détection" indéfiniment pour autant.
  const resolu = beatIdsKey ? contexte : null
  if (resolu === undefined) return null

  // Direct Charge : Stripe.js chargé avec le contexte du compte connecté,
  // jamais de `on_behalf_of` en option Elements (n'a de sens qu'en
  // destination charge). Ancien flux inchangé sinon.
  const stripeClient = resolu?.mode === 'direct' && resolu.stripe_account_id
    ? chargerStripePourCompte(resolu.stripe_account_id)
    : stripePromise

  return (
    <Elements
      key={resolu?.mode === 'direct' ? `direct:${resolu.stripe_account_id}` : (resolu?.on_behalf_of ?? 'aucun')}
      stripe={stripeClient}
      options={{
        mode: 'payment',
        amount: MONTANT_DETECTION_CENTS,
        currency: 'eur',
        ...(resolu?.mode === 'destination' && resolu.on_behalf_of ? { on_behalf_of: resolu.on_behalf_of } : {}),
      }}
    >
      <ExpressButtons {...props} />
    </Elements>
  )
}

function methodesVersOptions(methodes: ExpressMethod[] | null): StripeExpressCheckoutElementOptions['paymentMethods'] {
  if (methodes === null) {
    return { applePay: 'auto', googlePay: 'auto', paypal: 'auto', link: 'never', amazonPay: 'never', klarna: 'never' }
  }
  return {
    applePay: methodes.includes('apple_pay') ? 'always' : 'never',
    googlePay: methodes.includes('google_pay') ? 'always' : 'never',
    paypal: methodes.includes('paypal') ? 'auto' : 'never',
    link: 'never',
    amazonPay: 'never',
    klarna: 'never',
  }
}

function ExpressButtons({ slug, items, onStatusChange, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const { clear } = useCart()
  const [methodes, setMethodes] = useState<ExpressMethod[] | null>(null)
  const [besoinRestriction, setBesoinRestriction] = useState(false)
  const [pret, setPret] = useState(false)
  const [expiree, setExpiree] = useState(false)
  const [confirmErreur, setConfirmErreur] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const enCoursRef = useRef(false)

  // Montant affiché aux wallets = somme brute du panier (avant remise membre/
  // TVA/réduction par lot, recalculées côté serveur au moment du clic) — même
  // approximation que LicenceExpressPay avant sélection du montant final.
  const totalRaw = items.reduce((s, i) => s + i.prix, 0)

  useEffect(() => {
    if (!elements || items.length === 0) return
    elements.update({ amount: Math.round(totalRaw * 100) })
  }, [elements, totalRaw, items.length])

  useEffect(() => {
    if (pret) return
    const t = setTimeout(() => setExpiree(true), DELAI_DETECTION_MS)
    return () => clearTimeout(t)
  }, [pret])

  const decide = pret || expiree || loadError
  const affichable = pret && !expiree && !loadError && (methodes?.length ?? 0) > 0
  const status: ExpressStatus = !decide ? 'loading' : (affichable ? 'visible' : 'hidden')

  useEffect(() => {
    onStatusChange(status)
  }, [status, onStatusChange])

  const handleReady = useCallback((event: StripeExpressCheckoutElementReadyEvent) => {
    const dispo = event.availablePaymentMethods
    if (methodes === null) {
      const calcule = selectExpressPaymentMethods({
        applePayAvailable: !!dispo?.applePay,
        googlePayAvailable: !!dispo?.googlePay,
        paypalAvailable: !!dispo?.paypal,
      })
      setMethodes(calcule)
      const casRareDeuxWallets = !!dispo?.applePay && !!dispo?.googlePay
      if (casRareDeuxWallets) {
        setBesoinRestriction(true)
      } else {
        setPret(true)
      }
    } else {
      setPret(true)
    }
  }, [methodes])

  const rienADetecter = loadError || (expiree && !pret) || (methodes !== null && methodes.length === 0)
  if (rienADetecter) return null

  return (
    <div className="shop-cart-express" style={{ opacity: affichable ? 1 : 0, pointerEvents: affichable ? 'auto' : 'none' }}>
      <ExpressCheckoutElement
        key={besoinRestriction && methodes ? methodes.join(',') : 'detection'}
        options={{
          buttonHeight: 46,
          layout: { maxColumns: 2, maxRows: 1, overflow: 'auto' },
          paymentMethods: methodesVersOptions(besoinRestriction ? methodes : null),
          emailRequired: true,
        }}
        onReady={handleReady}
        onLoadError={(err) => { alert(`[debug] onLoadError: ${JSON.stringify(err)}`); setLoadError(true) }}
        onClick={(event: StripeExpressCheckoutElementClickEvent) => {
          alert(`[debug] onClick — items:${items.length}`)
          if (items.length === 0) { event.reject(); return }
          event.resolve()
        }}
        onConfirm={async (event: StripeExpressCheckoutElementConfirmEvent) => {
          // DEBUG TEMPORAIRE — à retirer une fois la cause identifiée.
          alert(`[debug] onConfirm appelé — stripe:${!!stripe} elements:${!!elements} items:${items.length} enCours:${enCoursRef.current}`)
          if (!stripe || !elements || items.length === 0 || enCoursRef.current) {
            alert('[debug] arrêt sur la garde — rien ne se passera')
            return
          }
          enCoursRef.current = true
          setConfirmErreur(null)
          try {
            const res = await fetch('/api/stripe/express-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })),
                slug,
              }),
            })
            const data = await res.json() as { clientSecret?: string; erreur?: string }
            if (!res.ok || !data.clientSecret) {
              // DEBUG TEMPORAIRE — à retirer une fois la cause identifiée.
              alert(`[debug] serveur: HTTP ${res.status} / ${data.erreur ?? '(sans message)'}`)
              setConfirmErreur(data.erreur ?? 'Erreur serveur, réessaie')
              event.paymentFailed({ reason: 'fail', message: data.erreur })
              return
            }

            const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
              elements,
              clientSecret: data.clientSecret,
              confirmParams: {
                return_url: `${window.location.origin}/${slug}?express_pi={PAYMENT_INTENT_ID}`,
              },
              redirect: 'if_required',
            })

            if (confirmError) {
              // DEBUG TEMPORAIRE — à retirer une fois la cause identifiée.
              alert(`[debug] confirmError: ${confirmError.type ?? '?'} / ${confirmError.code ?? '?'} / ${confirmError.message ?? '(sans message)'}`)
              setConfirmErreur(confirmError.message ?? 'Paiement refusé')
              event.paymentFailed({ reason: 'fail', message: confirmError.message })
              return
            }
            if (paymentIntent) {
              // Vidé seulement une fois le paiement confirmé (Apple/Google Pay,
              // pas de redirection) — le vider avant aurait démonté ce composant
              // (masqué dès que le panier est vide côté CartDrawer) en plein
              // milieu de la confirmation Stripe. Le cas PayPal (redirection
              // externe, ce point n'est jamais atteint dans cet onglet) est géré
              // au retour dans SuccessBanner.tsx.
              clear()
              onSuccess({ paymentIntentId: paymentIntent.id })
            }
          } catch (err) {
            // DEBUG TEMPORAIRE — à retirer une fois la cause identifiée.
            alert(`[debug] catch: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`)
            setConfirmErreur('Erreur réseau, réessaie')
            event.paymentFailed({ reason: 'fail' })
          } finally {
            enCoursRef.current = false
          }
        }}
      />
      {confirmErreur && <div className="shop-cart-express-error">{confirmErreur}</div>}
    </div>
  )
}
