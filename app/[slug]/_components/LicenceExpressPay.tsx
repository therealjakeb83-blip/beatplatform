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
// vide indéfiniment — le bouton panier repasse en style principal. Généreux
// car le cas rare (Apple ET Google Pay dispo en même temps) demande 2
// allers-retours réseau avec Stripe, pas 1 (voir plus bas).
const DELAI_DETECTION_MS = 8000

export type ExpressStatus = 'loading' | 'visible' | 'hidden'

type Props = {
  slug: string
  beatId: string
  selectedLicence: LicenceMin | undefined
  onStatusChange: (status: ExpressStatus) => void
  onSuccess: (info: { paymentIntentId: string }) => void
}

export default function LicenceExpressPay(props: Props) {
  return (
    <Elements stripe={stripePromise} options={{ mode: 'payment', amount: MONTANT_DETECTION_CENTS, currency: 'eur' }}>
      <ExpressButtons {...props} />
    </Elements>
  )
}

// Link/Amazon Pay/Klarna ne font pas partie de la spec (Apple Pay/Google
// Pay/PayPal uniquement) — désactivés dans TOUS les cas, y compris pendant
// la phase de détection brute (`methodes === null`), sinon un compte Stripe
// où ils sont activés par défaut (cas courant) les laisse s'afficher avant
// même qu'on ait pu les exclure via le remount restreint.
function methodesVersOptions(methodes: ExpressMethod[] | null): StripeExpressCheckoutElementOptions['paymentMethods'] {
  if (methodes === null) {
    return { applePay: 'auto', googlePay: 'auto', paypal: 'auto', link: 'never', amazonPay: 'never', klarna: 'never' }
  }
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

function ExpressButtons({ slug, beatId, selectedLicence, onStatusChange, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  // null = détection brute en cours ; ensuite la liste déjà filtrée par la
  // priorité Apple > Google + PayPal (peut être vide).
  const [methodes, setMethodes] = useState<ExpressMethod[] | null>(null)
  // Vrai uniquement dans le cas rare où Apple ET Google Pay sont dispo en
  // même temps (ex. Chrome desktop avec Apple Pay actif) — le seul cas où un
  // remount avec restriction explicite est nécessaire pour ne jamais les
  // montrer ensemble. Dans les autres cas (quasi tous, en pratique un device
  // n'a jamais les deux), la réalité de l'appareil suffit déjà.
  const [besoinRestriction, setBesoinRestriction] = useState(false)
  const [pret, setPret] = useState(false)
  const [expiree, setExpiree] = useState(false)
  const [confirmErreur, setConfirmErreur] = useState<string | null>(null)
  // Erreur de chargement de l'Element (SDK bloqué, config invalide...) — zone
  // masquée dans ce cas, le bouton panier repasse en style principal.
  const [loadError, setLoadError] = useState(false)
  const enCoursRef = useRef(false)

  // Le montant réel n'est connu qu'une fois une licence choisie ; on met à
  // jour l'instance Elements existante plutôt que de la remonter (pas de
  // flash, pas d'aller-retour serveur).
  useEffect(() => {
    if (!elements || !selectedLicence) return
    elements.update({ amount: Math.round(selectedLicence.prix * 100) })
  }, [elements, selectedLicence])

  // on_behalf_of doit être connu de l'Elements AVANT la confirmation, sinon
  // Stripe rejette le paiement ("on_behalf_of mismatch") au moment de payer,
  // quelle que soit la carte — voir /api/stripe/on-behalf-of.
  useEffect(() => {
    if (!elements) return
    let annule = false
    fetch('/api/stripe/on-behalf-of', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, beat_ids: [beatId] }),
    })
      .then(r => r.json())
      .then((data: { on_behalf_of?: string | null }) => {
        if (!annule) elements.update({ on_behalf_of: data.on_behalf_of ?? undefined })
      })
      .catch(() => {})
    return () => { annule = true }
  }, [elements, slug, beatId])

  // Filet de sécurité : si Stripe.js ne répond jamais (script bloqué,
  // navigateur in-app restrictif, hors ligne), on n'attend pas indéfiniment.
  // Désarmé dès que la détection a réussi (`pret`) — sinon le minuteur
  // masquait les boutons 8s après l'ouverture même en cas de succès.
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
        // Remount nécessaire ci-dessous (changement de `key`) avec la
        // restriction explicite — rien affiché tant que ce 2nd montage n'a
        // pas lui-même signalé qu'il est prêt.
        setBesoinRestriction(true)
      } else {
        // Cas courant : la disponibilité réelle de l'appareil suffit déjà à
        // garantir la priorité (jamais les deux à la fois en pratique) —
        // pas besoin d'un 2e aller-retour réseau avec Stripe.
        setPret(true)
      }
    } else {
      setPret(true)
    }
  }, [methodes])

  const rienADetecter = loadError || (expiree && !pret) || (methodes !== null && methodes.length === 0)
  if (rienADetecter) return null

  return (
    <div className="shop-lc-express" style={{ opacity: affichable ? 1 : 0, pointerEvents: affichable ? 'auto' : 'none' }}>
      <ExpressCheckoutElement
        key={besoinRestriction && methodes ? methodes.join(',') : 'detection'}
        options={{
          buttonHeight: 46,
          // 'overflow: never' n'est valide qu'avec maxRows:0 (erreur Stripe
          // sinon, qui empêchait l'Element de s'initialiser silencieusement --
          // c'était la vraie cause du blocage). On ne dépasse de toute façon
          // jamais 2 méthodes (déjà filtrées par selectExpressPaymentMethods),
          // donc 'auto' ne se déclenche jamais en pratique.
          layout: { maxColumns: 2, maxRows: 1, overflow: 'auto' },
          paymentMethods: methodesVersOptions(besoinRestriction ? methodes : null),
          emailRequired: true,
        }}
        onReady={handleReady}
        onLoadError={() => setLoadError(true)}
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
