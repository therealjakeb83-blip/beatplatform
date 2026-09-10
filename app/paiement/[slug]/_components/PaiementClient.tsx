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
import { detailTva } from '@/lib/prix-affiche'

const MONTANT_DETECTION_CENTS = 1000

type ContextePaiement = { mode: 'direct' | 'held'; stripe_account_id: string | null }

type Props = {
  slug: string
  logoUrl: string | null
  logoInverser: boolean
  nomArtiste: string
  reglesLot: ReductionLotRule[]
  tvaActive: boolean
  tvaTaux: number | null
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
const CHECK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 12.5l5 5L20 6" />
  </svg>
)
const CARD_ICON = (
  <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
    <rect x="2.5" y="5.5" width="19" height="13" rx="2.2" />
    <path strokeLinecap="round" d="M2.5 9.5h19" />
  </svg>
)
const LOCK_ICON = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
    <path strokeLinecap="round" d="M7.5 10.5V7.5a4.5 4.5 0 019 0v3" />
  </svg>
)

export default function PaiementClient(props: Props) {
  return (
    <CartProvider slug={props.slug}>
      <PaiementInner {...props} />
    </CartProvider>
  )
}

function PaiementInner({ slug, logoUrl, logoInverser, nomArtiste, reglesLot, tvaActive, tvaTaux }: Props) {
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
      <PaiementForm slug={slug} logoUrl={logoUrl} logoInverser={logoInverser} nomArtiste={nomArtiste} reglesLot={reglesLot} tvaActive={tvaActive} tvaTaux={tvaTaux} />
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

function PaiementForm({ slug, logoUrl, logoInverser, nomArtiste, reglesLot, tvaActive, tvaTaux }: Props) {
  const stripe = useStripe()
  const elements = useElements()
  const { items, clear } = useCart()
  const pays = useMemo(() => listePays(), [])

  const [recapOpen, setRecapOpen] = useState(false)
  const [pro, setPro] = useState(false)
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES)
  const [erreursChamps, setErreursChamps] = useState<Partial<Record<keyof Champs, string>>>({})

  const [codePromoOpen, setCodePromoOpen] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [codeApplique, setCodeApplique] = useState<{ code: string; type_valeur: 'pourcentage' | 'montant'; valeur: number } | null>(null)
  const [erreurCode, setErreurCode] = useState<string | null>(null)
  const [chargementCode, setChargementCode] = useState(false)
  const [codeNecessiteEmail, setCodeNecessiteEmail] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState({ number: false, expiry: false, cvc: false })
  const [carteOpen, setCarteOpen] = useState(false)
  const [facturationOpen, setFacturationOpen] = useState(false)
  // Purement visuel pour l'instant (décision Jake, 2026-09-10) — jamais
  // envoyé au serveur, pas d'inscription newsletter réelle tant que ce n'est
  // pas explicitement demandé.
  const [newsletterOptIn, setNewsletterOptIn] = useState(false)

  const pricedItems = computeItemsPricing(items, reglesLot)
  const total = computeTotal(items, reglesLot)
  const totalApresCode = codeApplique
    ? (codeApplique.type_valeur === 'pourcentage'
        ? total * (1 - codeApplique.valeur / 100)
        : Math.max(0, total - codeApplique.valeur))
    : total
  const tva = detailTva(totalApresCode, { tvaActive, tvaTaux })

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
        setCodeNecessiteEmail(Boolean(data.a_restriction_email))
        setCodeInput('')
      } else {
        if (data.a_restriction_email) setCodeNecessiteEmail(true)
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
  const facturationOk = /^\S+@\S+\.\S+$/.test(champs.email)
    && Boolean(champs.prenom.trim())
    && Boolean(champs.nom.trim())
    && Boolean(champs.telephone.trim())
    && Boolean(champs.adresse.trim())
    && Boolean(champs.codePostal.trim())
    && Boolean(champs.ville.trim())
    && (!pro || (Boolean(champs.raisonSociale.trim()) && /^[A-Za-z]{2}[A-Za-z0-9]{2,13}$/.test(champs.numeroTva.trim())))

  return (
    <div className="pmt-page">
      <div className="pmt-col">
        <header className="pmt-header">
          <Link href={`/${slug}`} className="pmt-back" aria-label="Retour au panier">{CHEVRON_LEFT}</Link>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={nomArtiste}
              className="pmt-logo"
              style={logoInverser ? { filter: 'invert(1)' } : undefined}
            />
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
              <span className="pmt-recap-total-col">
                <span className="pmt-recap-total">{formatPrix(totalApresCode)}</span>
                {tva && <span className="pmt-recap-tva">dont {tva.taux} % TVA</span>}
              </span>
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

                {codeApplique ? (
                  <div className="pmt-promo-applied">
                    <span>Code <strong>{codeApplique.code}</strong> appliqué</span>
                    <button className="pmt-promo-remove" onClick={() => { setCodeApplique(null); setCodeNecessiteEmail(false) }}>Supprimer</button>
                  </div>
                ) : codePromoOpen ? (
                  <div className="pmt-promo-row">
                    <input
                      className="pmt-field"
                      type="text"
                      autoFocus
                      value={codeInput}
                      onChange={e => { setCodeInput(e.target.value.toUpperCase()); setErreurCode(null); setCodeNecessiteEmail(false) }}
                      onKeyDown={e => e.key === 'Enter' && validerCode()}
                      placeholder="Code promo"
                    />
                    <button className="pmt-promo-apply" onClick={validerCode} disabled={!codeInput.trim() || chargementCode}>
                      {chargementCode ? '...' : 'OK'}
                    </button>
                  </div>
                ) : (
                  <button className="pmt-promo-toggle" onClick={() => setCodePromoOpen(true)}>Code promo ?</button>
                )}
                {codeNecessiteEmail && (
                  <div className="pmt-promo-email">
                    <input
                      className={`pmt-field${erreursChamps.email ? ' has-error' : ''}`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus={!codeApplique}
                      placeholder="Adresse e-mail associée au code"
                      aria-label="Adresse e-mail associée au code promo"
                      value={champs.email}
                      onChange={e => { majChamp('email', e.target.value); setErreurCode(null) }}
                      onKeyDown={e => e.key === 'Enter' && !codeApplique && validerCode()}
                    />
                  </div>
                )}
                {erreurCode && <p className="pmt-field-error">{erreurCode}</p>}

                <div className="pmt-hr" />
                <div className="pmt-row pmt-row-sub"><span>Sous-total</span><span>{formatPrix(total)}</span></div>
                {tva && <div className="pmt-row pmt-row-sub"><span>TVA ({tva.taux} %)</span><span>{formatPrix(tva.montant)}</span></div>}
                <div className="pmt-row pmt-row-total"><span>{tva ? 'Total TTC' : 'Total'}</span><span>{formatPrix(totalApresCode)}</span></div>
              </div>
            </div>
          </div>

          {/* Newsletter — purement visuel pour l'instant, pas d'inscription réelle */}
          <label className="pmt-newsletter">
            <input
              type="checkbox"
              checked={newsletterOptIn}
              onChange={e => setNewsletterOptIn(e.target.checked)}
              className="pmt-newsletter-input"
            />
            <span className={`pmt-newsletter-box${newsletterOptIn ? ' is-checked' : ''}`}>
              {newsletterOptIn && CHECK_ICON}
            </span>
            <span className="pmt-newsletter-label">Je veux recevoir les nouveaux beats et les offres par e-mail</span>
          </label>

          {/* Moyens de paiement */}
          <div className="pmt-express">
            <span className="pmt-express-title">Moyens de paiement</span>
            <ExpressButtons slug={slug} items={items.map(i => ({ beatId: i.beatId, licenceId: i.licenceId }))} codePromo={codeApplique?.code} onSucces={apresSucces} />
          </div>

          {/* Payer par carte */}
          <div className="pmt-carte-accordion">
            <button className="pmt-carte-head" onClick={() => setCarteOpen(o => !o)} aria-expanded={carteOpen}>
              <span className="pmt-carte-head-icon">{CARD_ICON}</span>
              <span className="pmt-carte-head-label">Payer par carte</span>
              <span className={`pmt-carte-chevron${carteOpen ? ' is-open' : ''}`}>{CHEVRON_DOWN}</span>
            </button>
            <div className={`pmt-carte-content${carteOpen ? ' is-open' : ''}`}>
              <div className="pmt-carte-inner">
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

                <div className="pmt-facturation">
                  <button
                    type="button"
                    className="pmt-facturation-head"
                    onClick={() => setFacturationOpen(o => !o)}
                    aria-expanded={facturationOpen}
                    aria-controls="pmt-facturation-content"
                  >
                    <span>Informations de facturation</span>
                    <span className={`pmt-facturation-chevron${facturationOpen ? ' is-open' : ''}`}>{CHEVRON_DOWN}</span>
                  </button>
                  <div id="pmt-facturation-content" className={`pmt-facturation-content${facturationOpen ? ' is-open' : ''}`}>
                    <div className="pmt-facturation-inner">
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
                        <input className={`pmt-field${erreursChamps.prenom ? ' has-error' : ''}`} placeholder="Prénom" value={champs.prenom} onChange={e => majChamp('prenom', e.target.value)} />
                        <input className={`pmt-field${erreursChamps.nom ? ' has-error' : ''}`} placeholder="Nom" value={champs.nom} onChange={e => majChamp('nom', e.target.value)} />
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

                      <button type="button" className="pmt-toggle-row" onClick={() => setPro(p => !p)} aria-pressed={pro}>
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
                    </div>
                  </div>
                </div>

                {erreurGlobale && <p className="pmt-error-global">{erreurGlobale}</p>}

                <button className="pmt-cta" onClick={payerParCarte} disabled={submitting || !cardOk || !facturationOk}>
                  {submitting ? 'Traitement…' : `Payer ${formatPrix(totalApresCode)}`}
                </button>
                <p className="pmt-legal">
                  En payant, tu acceptes les <Link href={`/${slug}/cgv`}>CGV</Link> et les conditions de licence.
                </p>
              </div>
            </div>
          </div>

          <div className="pmt-trust">{LOCK_ICON}<span>Paiement sécurisé par Stripe</span></div>
        </div>

        <footer className="pmt-footer">
          Besoin d&apos;aide ? <Link href={`/${slug}/contact`}>Me contacter</Link>
        </footer>
      </div>
    </div>
  )
}

// Boutons express — Apple Pay uniquement sur iOS, Google Pay sur les autres
// appareils compatibles, et jamais les deux ensemble. Un remount applique
// toujours ce filtrage après la détection Stripe. PayPal exclu (incompatible Direct
// Charge, voir memory project_phase2_direct_charge_implementation) ; Link
// ajouté ici (hors spec de la popup/panier), toujours affiché s'il est
// disponible, en plus du wallet.
// `layout.overflow:'never'` n'est valide qu'avec `maxRows:0` — sinon Stripe
// refuse silencieusement d'initialiser l'Element (aucun bouton ne s'affiche,
// y compris quand Apple Pay est bien détectable), piège déjà rencontré sur
// les autres composants express.
type ExpressMethodPage = 'apple_pay' | 'google_pay' | 'link'

function appareilEstIOS(): boolean {
  if (typeof navigator === 'undefined') return false

  // Sur iPadOS, Safari peut exposer un user-agent de Mac. Le tactile permet
  // de le distinguer d'un vrai Mac, sur lequel Google Pay doit rester
  // prioritaire conformément à la règle produit.
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function selectMethodesPage(
  a: { applePayAvailable: boolean; googlePayAvailable: boolean; linkAvailable: boolean },
  estIOS: boolean,
): ExpressMethodPage[] {
  const wallet: ExpressMethodPage | null = estIOS
    ? (a.applePayAvailable ? 'apple_pay' : null)
    : (a.googlePayAvailable ? 'google_pay' : null)
  return [wallet, a.linkAvailable ? 'link' : null].filter((m): m is ExpressMethodPage => m !== null)
}

function methodesVersOptionsPage(methodes: ExpressMethodPage[] | null) {
  if (methodes === null) {
    // Google Pay doit être demandé explicitement : avec `auto`, Stripe peut
    // ne pas le déclarer dans `availablePaymentMethods` lorsque le wallet
    // n'est pas encore configuré, et certains navigateurs ne le proposent
    // qu'avec `always`. Le conteneur reste invisible pendant cette détection,
    // puis le remount ci-dessous applique la règle iOS/Google Pay.
    return { applePay: 'auto' as const, googlePay: 'always' as const, paypal: 'never' as const, link: 'auto' as const, amazonPay: 'never' as const, klarna: 'never' as const }
  }
  return {
    applePay: methodes.includes('apple_pay') ? 'always' as const : 'never' as const,
    googlePay: methodes.includes('google_pay') ? 'always' as const : 'never' as const,
    paypal: 'never' as const,
    // 'link' n'accepte pas 'always' côté Stripe (contrairement à applePay/
    // googlePay/paypal) — 'auto' suffit, sa présence dans `methodes` prouve
    // déjà sa disponibilité réelle.
    link: methodes.includes('link') ? 'auto' as const : 'never' as const,
    amazonPay: 'never' as const,
    klarna: 'never' as const,
  }
}

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
  const [methodes, setMethodes] = useState<ExpressMethodPage[] | null>(null)
  const [pret, setPret] = useState(false)
  const [expiree, setExpiree] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    if (pret) return
    const t = setTimeout(() => setExpiree(true), 8000)
    return () => clearTimeout(t)
  }, [pret])

  const affichable = pret && !expiree && !loadError && (methodes?.length ?? 0) > 0

  const handleReady = (event: StripeExpressCheckoutElementReadyEvent) => {
    const dispo = event.availablePaymentMethods
    if (methodes === null) {
      const calcule = selectMethodesPage({
        applePayAvailable: !!dispo?.applePay,
        googlePayAvailable: !!dispo?.googlePay,
        linkAvailable: !!dispo?.link,
      }, appareilEstIOS())
      setMethodes(calcule)
    } else {
      setPret(true)
    }
  }

  const rienADetecter = loadError || (expiree && !pret) || (methodes !== null && methodes.length === 0)
  if (rienADetecter) return null

  return (
    <div style={{ opacity: affichable ? 1 : 0, pointerEvents: affichable ? 'auto' : 'none' }}>
      <ExpressCheckoutElement
        key={methodes ? methodes.join(',') : 'detection'}
        options={{
          buttonHeight: 50,
          layout: { maxColumns: 2, maxRows: 0, overflow: 'never' },
          paymentMethods: methodesVersOptionsPage(methodes),
          emailRequired: true,
          billingAddressRequired: true,
          phoneNumberRequired: true,
        }}
        onReady={handleReady}
        onLoadError={() => setLoadError(true)}
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
