'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripeExpressCheckoutElementReadyEvent, StripeExpressCheckoutElementClickEvent, StripeExpressCheckoutElementConfirmEvent, StripeExpressCheckoutElementOptions } from '@stripe/stripe-js'
import { stripePromise } from '@/lib/stripe-client'
import { selectExpressPaymentMethods, type ExpressMethod } from '../_lib/express-payments'
import type { LicenceMin } from './PlayerContext'

// Montant neutre utilisé le temps de détecter les moyens de paiement
// disponibles, avant même qu'une licence soit sélectionnée — la
// disponibilité d'Apple Pay/Google Pay/PayPal ne dépend pas du montant.
const MONTANT_DETECTION_CENTS = 1000

// Si Stripe.js ne répond pas dans ce délai (script bloqué, réseau capricieux,
// navigateur in-app restrictif), on abandonne plutôt que de garder un espace
// vide indéfiniment — le bouton panier repasse en style principal.
const DELAI_DETECTION_MS = 4000

type Props = {
  slug: string
  beatId: string
  selectedLicence: LicenceMin | undefined
  onAvailabilityChange: (visible: boolean) => void
  onSuccess: (info: { paymentIntentId: string }) => void
}

export default function LicenceExpressPay(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ mode: 'payment', amount: MONTANT_DETECTION_CENTS, currency: 'eur' }}>
      <ExpressButtons {...props} />
    </Elements>
  )
}

function methodesVersOptions(methodes: ExpressMethod[]): StripeExpressCheckoutElementOptions['paymentMethods'] {
  return {
    applePay: methodes.includes('apple_pay') ? 'always' : 'never',
    googlePay: methodes.includes('google_pay') ? 'always' : 'never',
    // 'paypal' n'accepte pas 'always' côté Stripe — 'auto' suffit puisqu'on a
    // déjà vérifié sa disponibilité réelle avant de l'inclure dans la liste.
    paypal: methodes.includes('paypal') ? 'auto' : 'never',
    link: 'never',
    amazonPay: 'never',
    klarna: 'never',
  }
}

function ExpressButtons({ slug, beatId, selectedLicence, onAvailabilityChange, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  // null = détection brute en cours ; ensuite la liste déjà filtrée par la
  // priorité Apple > Google + PayPal (peut être vide).
  const [methodes, setMethodes] = useState<ExpressMethod[] | null>(null)
  // Le 2e montage (restreint via `paymentMethods`) est-il prêt à s'afficher ?
  const [pret, setPret] = useState(false)
  const [expiree, setExpiree] = useState(false)
  const [confirmErreur, setConfirmErreur] = useState<string | null>(null)
  const enCoursRef = useRef(false)

  // Le montant réel n'est connu qu'une fois une licence choisie ; on met à
  // jour l'instance Elements existante plutôt que de la remonter (pas de
  // flash, pas d'aller-retour serveur).
  useEffect(() => {
    if (!elements || !selectedLicence) return
    elements.update({ amount: Math.round(selectedLicence.prix * 100) })
  }, [elements, selectedLicence])

  // Filet de sécurité : si Stripe.js ne répond jamais (script bloqué,
  // navigateur in-app restrictif, hors ligne), on n'attend pas indéfiniment.
  useEffect(() => {
    const t = setTimeout(() => setExpiree(true), DELAI_DETECTION_MS)
    return () => clearTimeout(t)
  }, [])

  const affichable = pret && !expiree && (methodes?.length ?? 0) > 0

  useEffect(() => {
    onAvailabilityChange(affichable)
  }, [affichable, onAvailabilityChange])

  const handleReady = useCallback((event: StripeExpressCheckoutElementReadyEvent) => {
    const dispo = event.availablePaymentMethods
    const calcule = selectExpressPaymentMethods({
      applePayAvailable: !!dispo?.applePay,
      googlePayAvailable: !!dispo?.googlePay,
      paypalAvailable: !!dispo?.paypal,
    })
    if (methodes === null) {
      // 1er passage (détection brute, sans restriction) : on connaît
      // maintenant la priorité réelle -> remount ci-dessous (changement de
      // `key`) avec la restriction appliquée. Rien n'est affiché tant que ce
      // 2nd montage n'a pas lui-même signalé qu'il est prêt.
      setMethodes(calcule)
    } else {
      setPret(true)
    }
  }, [methodes])

  if (expiree && !pret) return null
  if (methodes !== null && methodes.length === 0) return null

  const restreint = methodes !== null

  return (
    <div className="shop-lc-express" style={{ visibility: affichable ? 'visible' : 'hidden' }}>
      <ExpressCheckoutElement
        key={restreint ? methodes!.join(',') : 'detection'}
        options={{
          buttonHeight: 46,
          layout: { maxColumns: 2, maxRows: 1, overflow: 'never' },
          paymentMethods: restreint ? methodesVersOptions(methodes!) : undefined,
          emailRequired: true,
        }}
        onReady={handleReady}
        onClick={(event: StripeExpressCheckoutElementClickEvent) => {
          if (!selectedLicence) { event.reject(); return }
          event.resolve()
        }}
        onConfirm={async (event: StripeExpressCheckoutElementConfirmEvent) => {
          if (!stripe || !elements || !selectedLicence || enCoursRef.current) return
          enCoursRef.current = true
          setConfirmErreur(null)
          try {
            const res = await fetch('/api/stripe/express-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ beat_id: beatId, licence_id: selectedLicence.id, slug }),
            })
            const data = await res.json() as { clientSecret?: string; erreur?: string }
            if (!res.ok || !data.clientSecret) {
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
              setConfirmErreur(confirmError.message ?? 'Paiement refusé')
              event.paymentFailed({ reason: 'fail', message: confirmError.message })
              return
            }
            if (paymentIntent) onSuccess({ paymentIntentId: paymentIntent.id })
          } catch {
            setConfirmErreur('Erreur réseau, réessaie')
            event.paymentFailed({ reason: 'fail' })
          } finally {
            enCoursRef.current = false
          }
        }}
      />
      {confirmErreur && <div className="shop-lc-express-error">{confirmErreur}</div>}
    </div>
  )
}
