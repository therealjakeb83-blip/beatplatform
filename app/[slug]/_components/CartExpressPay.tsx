'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Elements, ExpressCheckoutElement, useElements, useStripe } from '@stripe/react-stripe-js'
import type { StripeExpressCheckoutElementReadyEvent, StripeExpressCheckoutElementClickEvent, StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js'
import { stripePromise, chargerStripePourCompte } from '@/lib/stripe-client'
import { appareilEstIOS, methodesExpressPourAppareil } from '../_lib/express-payments'
import { useCart, type CartItem } from './CartContext'

// Paiement express du panier — Apple Pay sur iOS, Google Pay ailleurs, jamais
// les deux ensemble, Link en plus sur la même ligne (voir _lib/express-payments
// pour la règle complète et pourquoi elle se base sur l'appareil plutôt que
// sur la disponibilité brute annoncée par Stripe).

const MONTANT_DETECTION_CENTS = 1000
const DELAI_DETECTION_MS = 8000

const abonnementHydratation = () => () => {}
const navigateurHydrate = () => true
const renduServeur = () => false

export type ExpressStatus = 'loading' | 'visible' | 'hidden'

type Props = {
  slug: string
  items: CartItem[]
  onStatusChange: (status: ExpressStatus) => void
  onSuccess: (info: { paymentIntentId: string }) => void
}

type ContextePaiement = { mode: 'direct' | 'held'; stripe_account_id: string | null }

export default function CartExpressPay(props: Props) {
  const { slug, items } = props
  const beatIdsKey = [...new Set(items.map(i => i.beatId))].sort().join(',')
  // Résolu avant le montage d'Elements (pas après coup) — Stripe.js doit
  // connaître le compte connecté dès le chargement pour le paiement express.
  const [contexte, setContexte] = useState<ContextePaiement | null | undefined>(undefined)

  useEffect(() => {
    if (!beatIdsKey) return
    let annule = false
    fetch('/api/stripe/contexte-paiement', {
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

  // Direct Charge : Stripe.js chargé avec le contexte du compte connecté.
  // "held" (splits collab) : fonds retenus sur la plateforme, client Stripe.js
  // plateforme classique, sans contexte de compte connecté.
  const stripeClient = resolu?.mode === 'direct' && resolu.stripe_account_id
    ? chargerStripePourCompte(resolu.stripe_account_id)
    : stripePromise

  return (
    <Elements
      key={resolu?.mode === 'direct' ? `direct:${resolu.stripe_account_id}` : 'held'}
      stripe={stripeClient}
      options={{ mode: 'payment', amount: MONTANT_DETECTION_CENTS, currency: 'eur' }}
    >
      <ExpressButtons {...props} />
    </Elements>
  )
}

function ExpressButtons({ slug, items, onStatusChange, onSuccess }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const { clear } = useCart()
  const estHydrate = useSyncExternalStore(abonnementHydratation, navigateurHydrate, renduServeur)
  const estIOS = estHydrate ? appareilEstIOS() : null
  const [methodesDisponibles, setMethodesDisponibles] = useState(false)
  // Vrai uniquement une fois que /api/stripe/prix-panier a confirmé le
  // montant réel (TVA/remises/réduction par lot) et que elements.update()
  // a été appelé avec — tant que ce n'est pas le cas, le bouton express
  // reste masqué plutôt que de risquer d'afficher/autoriser le montant de
  // détection par défaut (bug réel : Link a pu s'ouvrir sur 10 € au lieu du
  // vrai total si le client cliquait avant la fin de cet appel réseau).
  const [montantSynchronise, setMontantSynchronise] = useState(false)
  const [pret, setPret] = useState(false)
  const [expiree, setExpiree] = useState(false)
  const [confirmErreur, setConfirmErreur] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const enCoursRef = useRef(false)

  // Montant affiché aux wallets = le vrai montant qui sera facturé (TVA,
  // remise membre, réduction par lot déjà appliquées côté serveur) — jamais
  // une approximation locale, sinon la fenêtre Apple Pay/Google Pay peut
  // afficher un montant différent de celui réellement débité au clic
  // (bug réel trouvé le 2026-08-28 : TVA absente de l'ancien calcul local).
  const itemsKey = items.map(i => `${i.beatId}:${i.licenceId}`).sort().join(',')

  useEffect(() => {
    if (!elements || items.length === 0) return
    let annule = false
    // Le panier a changé : redevient non-fiable tant que le nouveau total
    // n'est pas reconfirmé (jamais garder la confiance acquise sur l'ancien
    // montant pendant qu'un nouveau chargement est en cours).
    setMontantSynchronise(false)
    fetch('/api/stripe/prix-panier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })) }),
    })
      .then(r => r.json())
      .then((data: { totalCents?: number }) => {
        if (annule) return
        if (typeof data.totalCents === 'number') {
          elements.update({ amount: data.totalCents })
          setMontantSynchronise(true)
        }
      })
      .catch(() => {})
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, slug, itemsKey, items.length])

  useEffect(() => {
    if (pret) return
    const t = setTimeout(() => setExpiree(true), DELAI_DETECTION_MS)
    return () => clearTimeout(t)
  }, [pret])

  const decide = pret || expiree || loadError
  const affichable = pret && !expiree && !loadError && methodesDisponibles && montantSynchronise
  const status: ExpressStatus = !decide ? 'loading' : (affichable ? 'visible' : 'hidden')

  useEffect(() => {
    onStatusChange(status)
  }, [status, onStatusChange])

  const handleReady = useCallback((event: StripeExpressCheckoutElementReadyEvent) => {
    setMethodesDisponibles(Boolean(event.availablePaymentMethods))
    setPret(true)
  }, [])

  const rienADetecter = loadError || (expiree && !pret) || (pret && !methodesDisponibles)
  if (estIOS === null || rienADetecter) return null

  return (
    <div className="shop-cart-express" style={{ opacity: affichable ? 1 : 0, pointerEvents: affichable ? 'auto' : 'none' }}>
      <ExpressCheckoutElement
        options={{
          buttonHeight: 46,
          layout: { maxColumns: 2, maxRows: 0, overflow: 'never' },
          paymentMethods: methodesExpressPourAppareil(estIOS),
          emailRequired: true,
          // Adresse obligatoire (contrat de licence — voir lib/contrat.ts),
          // téléphone facultatif (jamais utilisé dans le contrat, juste
          // confort CRM) — le retirer accélère Link/Apple/Google Pay.
          billingAddressRequired: true,
        }}
        onReady={handleReady}
        onLoadError={() => setLoadError(true)}
        onClick={(event: StripeExpressCheckoutElementClickEvent) => {
          if (items.length === 0) { event.reject(); return }
          event.resolve()
        }}
        onConfirm={async (event: StripeExpressCheckoutElementConfirmEvent) => {
          if (!stripe || !elements || items.length === 0 || enCoursRef.current) return
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
          } catch {
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
