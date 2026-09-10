'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Elements,
  ExpressCheckoutElement,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import type {
  StripeExpressCheckoutElementReadyEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeCardNumberElementChangeEvent,
} from '@stripe/stripe-js'
import { stripePromise, chargerStripePourCompte } from '@/lib/stripe-client'
import { CartProvider, useCart } from '@/app/[slug]/_components/CartContext'
import { computeItemsPricing, computeTotal, formatPrix, type ReductionLotRule } from '@/app/[slug]/_lib/reductions-lot'
import { listePays } from '@/lib/pays-iso'

const MONTANT_DETECTION_CENTS = 1000

type ContextePaiement = { mode: 'direct' | 'held'; stripe_account_id: string | null }

type Props = {
  slug: string
  logoUrl: string | null
  nomArtiste: string
  reglesLot: ReductionLotRule[]
}

const CHEVRON_LEFT = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
  </svg>
)
const CHEVRON_DOWN = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
  </svg>
)

export default function PaiementClient(props: Props) {
  return (
    <CartProvider slug={props.slug}>
      <PaiementInner {...props} />
    </CartProvider>
  )
}

function PaiementInner({ slug, logoUrl, nomArtiste, reglesLot }: Props) {
  const { items } = useCart()
  const beatIdsKey = [...new Set(items.map(i => i.beatId))].sort().join(',')
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

  if (items.length === 0) {
    return (
      <div className="pmt-page">
        <div className="pmt-col">
          <div className="pmt-body">
            <p style={{ textAlign: 'center', color: 'rgba(10,10,12,.6)', fontSize: 13 }}>
              Ton panier est vide.
            </p>
            <Link href={`/${slug}`} className="pmt-cta" style={{ textAlign: 'center', lineHeight: '54px', textDecoration: 'none' }}>
              Retour à la boutique
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (contexte === undefined) return null

  const stripeClient = contexte?.mode === 'direct' && contexte.stripe_account_id
    ? chargerStripePourCompte(contexte.stripe_account_id)
    : stripePromise

  return (
    <Elements
      key={contexte?.mode === 'direct' ? `direct:${contexte.stripe_account_id}` : 'held'}
      stripe={stripeClient}
      options={{ mode: 'payment', amount: MONTANT_DETECTION_CENTS, currency: 'eur' }}
    >
      <PaiementForm slug={slug} logoUrl={logoUrl} nomArtiste={nomArtiste} reglesLot={reglesLot} />
    </Elements>
  )
}

type Champs = {
  email: string
  prenom: string
  nom: string
  telephone: string
  adresse: string
  codePostal: string
  ville: string
  pays: string
  raisonSociale: string
  numeroTva: string
}

const CHAMPS_VIDES: Champs = {
  email: '', prenom: '', nom: '', telephone: '', adresse: '', codePostal: '', ville: '',
  pays: 'FR', raisonSociale: '', numeroTva: '',
}

const cardElementStyle = {
  base: {
    fontSize: '14px',
    fontFamily: 'var(--pmt-font, inherit)',
    color: '#0A0A0C',
    '::placeholder': { color: 'rgba(10,10,12,.6)' },
  },
  invalid: { color: '#D92D20' },
}

function PaiementForm({ slug, logoUrl, nomArtiste, reglesLot }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const { items, clear } = useCart()
  const pays = useMemo(() => listePays(), [])

  const [recapOpen, setRecapOpen] = useState(false)
  const [pro, setPro] = useState(false)
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES)
  const [erreursChamps, setErreursChamps] = useState<Partial<Record<keyof Champs, string>>>({})

  const [codeInput, setCodeInput] = useState('')
  const [codeApplique, setCodeApplique] = useState<{ code: string; type_valeur: 'pourcentage' | 'montant'; valeur: number } | null>(null)
  const [erreurCode, setErreurCode] = useState<string | null>(null)
  const [chargementCode, setChargementCode] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState({ number: false, expiry: false, cvc: false })

  const pricedItems = computeItemsPricing(items, reglesLot)
  const total = computeTotal(items, reglesLot)
  const totalApresCode = codeApplique
    ? (codeApplique.type_valeur === 'pourcentage'
        ? total * (1 - codeApplique.valeur / 100)
        : Math.max(0, total - codeApplique.valeur))
    : total

  // Montant réellement facturé (TVA/remises/code promo/lot déjà appliqués
  // côté serveur) — jamais une approximation locale, sinon la fenêtre Apple/
  // Google Pay ou le débit carte peuvent différer de ce qui est affiché.
  useEffect(() => {
    if (!elements || items.length === 0) return
    let annule = false
    fetch('/api/stripe/prix-panier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })),
        code_promo: codeApplique?.code,
        email_acheteur: champs.email || undefined,
      }),
    })
      .then(r => r.json())
      .then((data: { totalCents?: number }) => {
        if (!annule && typeof data.totalCents === 'number') elements.update({ amount: data.totalCents })
      })
      .catch(() => {})
    return () => { annule = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, slug, items.map(i => `${i.beatId}:${i.licenceId}`).join(','), codeApplique?.code])

  async function validerCode() {
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    setChargementCode(true)
    setErreurCode(null)
    try {
      const res = await fetch('/api/stripe/valider-code-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, beat_ids: items.map(i => i.beatId), slug, email: champs.email.trim() || undefined }),
      })
      const data = await res.json()
      if (data.valide) {
        setCodeApplique({ code, type_valeur: data.type_valeur, valeur: data.valeur })
        setCodeInput('')
      } else {
        setErreurCode(data.erreur ?? 'Code invalide')
      }
    } catch {
      setErreurCode('Erreur réseau')
    } finally {
      setChargementCode(false)
    }
  }

  function majChamp<K extends keyof Champs>(cle: K, valeur: string) {
    setChamps(c => ({ ...c, [cle]: valeur }))
    setErreursChamps(e => (e[cle] ? { ...e, [cle]: undefined } : e))
  }

  // Validation minimale à la soumission — le PSP valide lui-même la carte,
  // on ne vérifie ici que ce qui bloquerait sinon silencieusement l'appel API.
  function validerFormulaire(): boolean {
    const erreurs: Partial<Record<keyof Champs, string>> = {}
    if (!/^\S+@\S+\.\S+$/.test(champs.email)) erreurs.email = 'Email invalide'
    if (!champs.prenom.trim()) erreurs.prenom = 'Requis'
    if (!champs.nom.trim()) erreurs.nom = 'Requis'
    if (!champs.telephone.trim()) erreurs.telephone = 'Requis'
    if (!champs.adresse.trim()) erreurs.adresse = 'Requis'
    if (!champs.codePostal.trim()) erreurs.codePostal = 'Requis'
    if (!champs.ville.trim()) erreurs.ville = 'Requis'
    if (pro && !champs.raisonSociale.trim()) erreurs.raisonSociale = 'Requis'
    // Format seulement — pas de vérification VIES en direct (fondation de
    // données Phase 9, pas de logique fiscale active).
    if (pro && !/^[A-Za-z]{2}[A-Za-z0-9]{2,13}$/.test(champs.numeroTva.trim())) erreurs.numeroTva = 'Format attendu : FR12345678901'
    setErreursChamps(erreurs)
    return Object.keys(erreurs).length === 0
  }

  async function creerPaymentIntent() {
    const res = await fetch('/api/stripe/express-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })),
        slug,
        code_promo: codeApplique?.code,
        email_acheteur: champs.email,
        prenom: champs.prenom,
        nom: champs.nom,
        telephone: champs.telephone,
        adresse: champs.adresse,
        code_postal: champs.codePostal,
        ville: champs.ville,
        pays: champs.pays,
        type_client: pro ? 'professionnel' : 'particulier',
        raison_sociale: pro ? champs.raisonSociale : undefined,
        numero_tva: pro ? champs.numeroTva : undefined,
        source_marketing: typeof window !== 'undefined' ? (sessionStorage.getItem('source_marketing') ?? 'direct') : 'direct',
      }),
    })
    return res.json() as Promise<{ clientSecret?: string; erreur?: string }>
  }

  async function apresSucces(paymentIntentId: string) {
    clear()
    for (let tentative = 0; tentative < 10; tentative++) {
      const res = await fetch(`/api/telechargement/lookup?payment_intent=${paymentIntentId}`)
      if (res.ok) {
        const data = await res.json() as { commande_id?: string }
        if (data.commande_id) {
          window.location.href = `/telechargement/${data.commande_id}`
          return
        }
      }
      await new Promise(r => setTimeout(r, 1000))
    }
    window.location.href = `/${slug}`
  }

  async function payerParCarte() {
    if (!stripe || !elements || submitting) return
    if (!validerFormulaire()) return
    const cardNumberElement = elements.getElement(CardNumberElement)
    if (!cardNumberElement) return

    setSubmitting(true)
    setErreurGlobale(null)
    try {
      const data = await creerPaymentIntent()
      if (!data.clientSecret) {
        setErreurGlobale(data.erreur ?? 'Erreur serveur, réessaie')
        return
      }

      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: `${champs.prenom} ${champs.nom}`.trim(),
            email: champs.email,
            phone: champs.telephone,
            address: {
              line1: champs.adresse,
              postal_code: champs.codePostal,
              city: champs.ville,
              country: champs.pays,
            },
          },
        },
      })

      if (error) {
        setErreurGlobale(error.message ?? 'Paiement refusé')
        return
      }
      if (paymentIntent) await apresSucces(paymentIntent.id)
    } catch {
      setErreurGlobale('Erreur réseau, réessaie')
    } finally {
      setSubmitting(false)
    }
  }

  const cardOk = cardComplete.number && cardComplete.expiry && cardComplete.cvc

  return (
    <div className="pmt-page">
      <div className="pmt-col">
        <header className="pmt-header">
          <Link href={`/${slug}`} className="pmt-back" aria-label="Retour au panier">{CHEVRON_LEFT}</Link>
          {logoUrl ? (
            <img src={logoUrl} alt={nomArtiste} className="pmt-logo" />
          ) : (
            <span style={{ margin: '0 auto', fontWeight: 700, fontSize: 15 }}>{nomArtiste}</span>
          )}
          <div className="pmt-header-spacer" />
        </header>

        <div className="pmt-body">
          {/* Récapitulatif */}
          <div className="pmt-recap">
            <button className="pmt-recap-head" onClick={() => setRecapOpen(o => !o)} aria-expanded={recapOpen}>
              <div className="pmt-recap-thumbs">
                {pricedItems.slice(0, 2).map(item => (
                  item.imageUrl
                    ? <img key={`${item.beatId}:${item.licenceId}`} src={item.imageUrl} alt="" className="pmt-recap-thumb" />
                    : <div key={`${item.beatId}:${item.licenceId}`} className="pmt-recap-thumb" />
                ))}
              </div>
              <span className="pmt-recap-label">{items.length} beat{items.length > 1 ? 's' : ''}</span>
              <span className="pmt-recap-total">{formatPrix(totalApresCode)}</span>
              <span className={`pmt-recap-chevron${recapOpen ? ' is-open' : ''}`}>{CHEVRON_DOWN}</span>
            </button>
            <div className={`pmt-recap-content${recapOpen ? ' is-open' : ''}`}>
              <div className="pmt-recap-inner">
                <div className="pmt-hr" />
                {pricedItems.map(item => (
                  <div key={`${item.beatId}:${item.licenceId}`} className="pmt-recap-item">
                    {item.imageUrl
                      ? <img src={item.imageUrl} alt="" className="pmt-recap-item-img" />
                      : <div className="pmt-recap-item-img" />}
                    <div>
                      <div className="pmt-recap-item-title">{item.titre}</div>
                      <div className="pmt-recap-item-licence">{item.licenceNom}</div>
                    </div>
                    <div className="pmt-recap-item-price">{item.isFree ? 'Gratuit' : formatPrix(item.prix)}</div>
                  </div>
                ))}
                <div className="pmt-hr" />
                <div className="pmt-row pmt-row-sub"><span>Sous-total</span><span>{formatPrix(total)}</span></div>
                <div className="pmt-row pmt-row-total"><span>Total</span><span>{formatPrix(totalApresCode)}</span></div>
              </div>
            </div>
          </div>

          {codeApplique ? (
            <div className="pmt-promo-applied">
              <span>Code <strong>{codeApplique.code}</strong> appliqué</span>
              <button className="pmt-promo-remove" onClick={() => setCodeApplique(null)}>Supprimer</button>
            </div>
          ) : (
            <div className="pmt-promo-row">
              <input
                className="pmt-field"
                type="text"
                value={codeInput}
                onChange={e => { setCodeInput(e.target.value.toUpperCase()); setErreurCode(null) }}
                onKeyDown={e => e.key === 'Enter' && validerCode()}
                placeholder="Code promo"
              />
              <button className="pmt-promo-apply" onClick={validerCode} disabled={!codeInput.trim() || chargementCode}>
                {chargementCode ? '...' : 'OK'}
              </button>
            </div>
          )}
          {erreurCode && <p className="pmt-field-error">{erreurCode}</p>}

          {/* Paiement express */}
          <div className="pmt-express">
            <span className="pmt-express-title">Paiement express</span>
            <ExpressButtons slug={slug} items={items.map(i => ({ beatId: i.beatId, licenceId: i.licenceId }))} codePromo={codeApplique?.code} onSucces={apresSucces} />
          </div>

          <div className="pmt-sep">
            <span className="pmt-sep-line" /><span className="pmt-sep-text">ou</span><span className="pmt-sep-line" />
          </div>

          {/* Formulaire */}
          <div className="pmt-form">
            <button className="pmt-toggle-row" onClick={() => setPro(p => !p)} aria-pressed={pro}>
              <span className={`pmt-toggle-track${pro ? ' is-on' : ''}`}><span className="pmt-toggle-thumb" /></span>
              <span className="pmt-toggle-label">J&apos;achète en tant que professionnel</span>
            </button>
            <div className={`pmt-pro-fields${pro ? ' is-open' : ''}`}>
              <input
                className={`pmt-field${erreursChamps.raisonSociale ? ' has-error' : ''}`}
                placeholder="Raison sociale"
                value={champs.raisonSociale}
                onChange={e => majChamp('raisonSociale', e.target.value)}
              />
              <input
                className={`pmt-field${erreursChamps.numeroTva ? ' has-error' : ''}`}
                placeholder="N° de TVA intracommunautaire"
                value={champs.numeroTva}
                onChange={e => majChamp('numeroTva', e.target.value.toUpperCase())}
              />
              {erreursChamps.numeroTva && <p className="pmt-field-error">{erreursChamps.numeroTva}</p>}
              <p className="pmt-field-help">La facture sera émise au nom de la société.</p>
            </div>

            <div className="pmt-connexion-row">
              <span>Déjà client ?</span>
              <Link href={`/artiste/connexion?redirect=/paiement/${slug}`} className="pmt-connexion-link">Connexion</Link>
            </div>

            <div>
              <input
                className={`pmt-field${erreursChamps.email ? ' has-error' : ''}`}
                type="email"
                placeholder="E-mail"
                value={champs.email}
                onChange={e => majChamp('email', e.target.value)}
              />
              {erreursChamps.email && <p className="pmt-field-error">{erreursChamps.email}</p>}
              <p className="pmt-field-help">Les licences PDF et les fichiers y seront envoyés.</p>
            </div>

            <div className="pmt-grid-2">
              <div>
                <input className={`pmt-field${erreursChamps.prenom ? ' has-error' : ''}`} placeholder="Prénom" value={champs.prenom} onChange={e => majChamp('prenom', e.target.value)} />
              </div>
              <div>
                <input className={`pmt-field${erreursChamps.nom ? ' has-error' : ''}`} placeholder="Nom" value={champs.nom} onChange={e => majChamp('nom', e.target.value)} />
              </div>
            </div>

            <input className={`pmt-field${erreursChamps.telephone ? ' has-error' : ''}`} type="tel" placeholder="Téléphone" value={champs.telephone} onChange={e => majChamp('telephone', e.target.value)} />
            <input className={`pmt-field${erreursChamps.adresse ? ' has-error' : ''}`} placeholder="Adresse" value={champs.adresse} onChange={e => majChamp('adresse', e.target.value)} />

            <div className="pmt-grid-cp">
              <input className={`pmt-field${erreursChamps.codePostal ? ' has-error' : ''}`} placeholder="Code postal" value={champs.codePostal} onChange={e => majChamp('codePostal', e.target.value)} />
              <input className={`pmt-field${erreursChamps.ville ? ' has-error' : ''}`} placeholder="Ville" value={champs.ville} onChange={e => majChamp('ville', e.target.value)} />
            </div>

            <select className="pmt-select" value={champs.pays} onChange={e => majChamp('pays', e.target.value)}>
              {pays.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}
            </select>

            <div className="pmt-hr" style={{ margin: '6px 0' }} />

            <div className={`pmt-card-box${erreurGlobale ? '' : ''}`}>
              <CardNumberElement
                className="StripeElement"
                options={{ style: cardElementStyle, showIcon: false, placeholder: 'Numéro de carte' }}
                onChange={(e: StripeCardNumberElementChangeEvent) => setCardComplete(c => ({ ...c, number: e.complete }))}
              />
              <div className="pmt-card-brands">
                <span className="pmt-card-brand pmt-card-brand--visa" />
                <span className="pmt-card-brand pmt-card-brand--mc" />
              </div>
            </div>
            <div className="pmt-card-split">
              <div className="pmt-card-box">
                <CardExpiryElement className="StripeElement" options={{ style: cardElementStyle }} onChange={e => setCardComplete(c => ({ ...c, expiry: e.complete }))} />
              </div>
              <div className="pmt-card-box">
                <CardCvcElement className="StripeElement" options={{ style: cardElementStyle }} onChange={e => setCardComplete(c => ({ ...c, cvc: e.complete }))} />
              </div>
            </div>
          </div>

          {erreurGlobale && <p className="pmt-error-global">{erreurGlobale}</p>}

          <button className="pmt-cta" onClick={payerParCarte} disabled={submitting || !cardOk}>
            {submitting ? 'Traitement…' : `Payer ${formatPrix(totalApresCode)}`}
          </button>
          <p className="pmt-legal">
            En payant, tu acceptes les <Link href={`/${slug}/cgv`}>CGV</Link> et les conditions de licence.
          </p>
        </div>
      </div>
    </div>
  )
}

// Boutons express (Apple Pay/Google Pay/Link) — PayPal exclu (incompatible
// Direct Charge, voir memory project_phase2_direct_charge_implementation).
// Link est un moyen Stripe natif, pas un tiers, activé ici contrairement à
// LicenceExpressPay/CartExpressPay (hors spec de cette page-là).
function ExpressButtons({
  slug, items, codePromo, onSucces,
}: {
  slug: string
  items: { beatId: string; licenceId: string }[]
  codePromo: string | undefined
  onSucces: (paymentIntentId: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [pret, setPret] = useState(false)
  const [visible, setVisible] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const handleReady = (event: StripeExpressCheckoutElementReadyEvent) => {
    setPret(true)
    setVisible(!!(event.availablePaymentMethods && Object.values(event.availablePaymentMethods).some(Boolean)))
  }

  if (!pret) {
    // Rendu invisible pendant la détection, jamais démonté (Stripe a besoin
    // de l'Element monté pour déclencher onReady).
  }

  return (
    <div style={{ display: visible ? 'block' : 'none' }}>
      <ExpressCheckoutElement
        options={{
          buttonHeight: 50,
          layout: { maxColumns: 1, maxRows: 3, overflow: 'never' },
          paymentMethods: { applePay: 'auto', googlePay: 'auto', paypal: 'never', link: 'auto', amazonPay: 'never', klarna: 'never' },
          emailRequired: true,
          billingAddressRequired: true,
          phoneNumberRequired: true,
        }}
        onReady={handleReady}
        onConfirm={async (event: StripeExpressCheckoutElementConfirmEvent) => {
          if (!stripe || !elements) return
          try {
            const res = await fetch('/api/stripe/express-checkout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })),
                slug,
                code_promo: codePromo,
              }),
            })
            const data = await res.json() as { clientSecret?: string; erreur?: string }
            if (!res.ok || !data.clientSecret) {
              setErreur(data.erreur ?? 'Erreur serveur, réessaie')
              event.paymentFailed({ reason: 'fail', message: data.erreur })
              return
            }
            const { error, paymentIntent } = await stripe.confirmPayment({
              elements,
              clientSecret: data.clientSecret,
              confirmParams: { return_url: `${window.location.origin}/${slug}?express_pi={PAYMENT_INTENT_ID}` },
              redirect: 'if_required',
            })
            if (error) {
              setErreur(error.message ?? 'Paiement refusé')
              event.paymentFailed({ reason: 'fail', message: error.message })
              return
            }
            if (paymentIntent) onSucces(paymentIntent.id)
          } catch {
            setErreur('Erreur réseau, réessaie')
            event.paymentFailed({ reason: 'fail' })
          }
        }}
      />
      {erreur && <p className="pmt-field-error">{erreur}</p>}
    </div>
  )
}
