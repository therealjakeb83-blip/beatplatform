'use client'

import { useState } from 'react'
import { useCart } from './CartContext'
import CartExpressPay, { type ExpressStatus } from './CartExpressPay'
import { computeItemsPricing, computePromoBanner, computeTotal, formatPrix, hasFreeItem, type ReductionLotRule } from '../_lib/reductions-lot'

const TRASH_ICON = (
  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
  </svg>
)
const GIFT_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M20 8h-4.3a2.5 2.5 0 10-3.7-3 2.5 2.5 0 10-3.7 3H4a1 1 0 00-1 1v3a1 1 0 001 1h16a1 1 0 001-1V9a1 1 0 00-1-1z" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    <path d="M5 13v7a1 1 0 001 1h12a1 1 0 001-1v-7M12 8v13" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)
const CHECK_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
    <path d="M4 12.5l5 5L20 6" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function CartDrawer({
  slug,
  reglesLot = [],
}: {
  slug: string
  reglesLot?: ReductionLotRule[]
}) {
  const { items, isOpen, close, removeItem, clear } = useCart()

  const [codeInput, setCodeInput] = useState('')
  const [codeApplique, setCodeApplique] = useState<{ code: string; type_valeur: 'pourcentage' | 'montant'; valeur: number } | null>(null)
  const [erreurCode, setErreurCode] = useState<string | null>(null)
  const [chargementCode, setChargementCode] = useState(false)
  const [emailAcheteur, setEmailAcheteur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [, setExpressStatus] = useState<ExpressStatus>('loading')
  const [expressRedirection, setExpressRedirection] = useState(false)

  if (!isOpen) return null

  const pricedItems = computeItemsPricing(items, reglesLot)
  const total = computeTotal(items, reglesLot)
  const totalApresCode = codeApplique
    ? (codeApplique.type_valeur === 'pourcentage'
        ? total * (1 - codeApplique.valeur / 100)
        : Math.max(0, total - codeApplique.valeur))
    : total
  const promoBanner = computePromoBanner(items, reglesLot)
  const beatGratuitDebloque = hasFreeItem(items, reglesLot)

  async function validerCode() {
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    setChargementCode(true)
    setErreurCode(null)
    try {
      const res = await fetch('/api/stripe/valider-code-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, beat_ids: items.map(i => i.beatId), slug, email: emailAcheteur.trim() || undefined }),
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

  async function passerCommande() {
    setChargement(true)
    setErreur(null)
    const source_marketing = sessionStorage.getItem('source_marketing') ?? 'direct'
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          items: items.map(i => ({ beat_id: i.beatId, licence_id: i.licenceId })),
          code_promo: codeApplique?.code,
          email_acheteur: emailAcheteur || undefined,
          source_marketing,
        }),
      })
      const data = await res.json()
      if (data.url) {
        clear()
        window.location.href = data.url
      } else {
        setErreur(data.erreur ?? 'Erreur lors du paiement')
        setChargement(false)
      }
    } catch {
      setErreur('Erreur réseau')
      setChargement(false)
    }
  }

  // Apple Pay/Google Pay (pas de redirection externe) : le webhook crée la
  // commande de façon asynchrone, on interroge jusqu'à ce qu'elle existe puis
  // on va directement à la page de téléchargement. PayPal (redirection
  // externe) est géré séparément au retour, dans SuccessBanner.tsx.
  async function apresSuccesExpress({ paymentIntentId }: { paymentIntentId: string }) {
    setExpressRedirection(true)
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

  return (
    <div className="shop-cart-overlay" onClick={close}>
      <aside className="shop-cart-panel" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="shop-cart-header">
          <h2>Panier <span className="shop-cart-count-label">({items.length})</span></h2>
          <button onClick={close} className="shop-cart-close" aria-label="Fermer">×</button>
        </div>

        <div className="shop-cart-body">
          {items.length === 0 ? (
            <p className="shop-cart-empty">Ton panier est vide.<br />Ajoute un beat depuis la boutique pour commencer.</p>
          ) : (
            <>
              {pricedItems.map(item => (
                <div key={`${item.beatId}:${item.licenceId}`} className="shop-cart-item">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.titre} className="shop-cart-item-cover" />
                  ) : (
                    <div className="shop-cart-item-cover" />
                  )}
                  <div className="shop-cart-item-body">
                    <p className="shop-cart-item-title">{item.titre}</p>
                    <div className="shop-cart-item-licence">Licence : {item.licenceNom}</div>
                    <button
                      onClick={() => removeItem(item.beatId, item.licenceId)}
                      className="shop-cart-item-remove"
                      title="Retirer"
                      aria-label="Retirer"
                    >
                      {TRASH_ICON}
                    </button>
                  </div>
                  <div className="shop-cart-item-price">
                    {item.isFree ? (
                      <>
                        <div className="shop-cart-price-original">{formatPrix(item.prix)}</div>
                        <div className="shop-cart-price-gratuit">GRATUIT</div>
                      </>
                    ) : (
                      <div className="shop-cart-price-paid">{formatPrix(item.prix)}</div>
                    )}
                  </div>
                </div>
              ))}

              {beatGratuitDebloque && (
                <div className="shop-cart-banner">
                  <div className="shop-cart-banner-row">
                    <div className="shop-cart-banner-icon">{CHECK_ICON}</div>
                    <div className="shop-cart-banner-text">Bravo, tu as débloqué ton beat gratuit 😎</div>
                  </div>
                </div>
              )}

              {promoBanner && (
                <div className="shop-cart-banner shop-cart-banner--promo">
                  <div className="shop-cart-banner-row">
                    <div className="shop-cart-banner-icon">{GIFT_ICON}</div>
                    <div className="shop-cart-banner-text">
                      {promoBanner.ready ? (
                        promoBanner.nbOfferts > 1 ? (
                          <>Ton prochain beat en <strong>{promoBanner.licenceNom}</strong> débloque <strong>{promoBanner.nbOfferts} beats offerts</strong> — ajoute-le maintenant !</>
                        ) : (
                          <>Ton {promoBanner.tailleLot}<sup>e</sup> beat en <strong>{promoBanner.licenceNom}</strong> est <strong>offert</strong> — ajoute-le maintenant !</>
                        )
                      ) : (
                        promoBanner.nbOfferts > 1 ? (
                          <>Ajoute encore <strong>{promoBanner.remaining} beat{promoBanner.remaining > 1 ? 's' : ''} en {promoBanner.licenceNom}</strong> pour débloquer {promoBanner.nbOfferts} beats offerts !</>
                        ) : (
                          <>Ajoute encore <strong>{promoBanner.remaining} beat{promoBanner.remaining > 1 ? 's' : ''} en {promoBanner.licenceNom}</strong>, le {promoBanner.tailleLot}<sup>e</sup> sera offert !</>
                        )
                      )}
                    </div>
                  </div>
                  <div className="shop-cart-promo-dots">
                    {Array.from({ length: promoBanner.tailleLot }).map((_, i) => (
                      <span
                        key={i}
                        className={`shop-cart-promo-dot${i < promoBanner.position ? ' is-filled' : ''}${i === promoBanner.position ? ' is-next' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {items.length > 0 && (
          <div className="shop-cart-footer">
            {codeApplique ? (
              <div className="shop-cart-promo-applied">
                <span>Code <strong>{codeApplique.code}</strong> appliqué</span>
                <button onClick={() => setCodeApplique(null)} className="shop-cart-promo-remove">Supprimer</button>
              </div>
            ) : (
              <div>
                <div className="shop-cart-promo-row">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setErreurCode(null) }}
                    onKeyDown={e => e.key === 'Enter' && validerCode()}
                    placeholder="Code promo"
                    className="shop-cart-input"
                  />
                  <button
                    onClick={validerCode}
                    disabled={!codeInput.trim() || chargementCode}
                    className="shop-cart-promo-apply"
                  >
                    {chargementCode ? '...' : 'Appliquer'}
                  </button>
                </div>
                {erreurCode && <p className="shop-cart-error">{erreurCode}</p>}
              </div>
            )}

            <input
              type="email"
              value={emailAcheteur}
              onChange={e => setEmailAcheteur(e.target.value)}
              placeholder="Ton email (si non connecté)"
              className="shop-cart-input"
            />

            <div className="shop-cart-row">
              <span>Sous-total</span>
              <span>{formatPrix(total)}</span>
            </div>
            <div className="shop-cart-row is-total">
              <span>Total</span>
              <span>
                {codeApplique && totalApresCode !== total && (
                  <span className="shop-cart-strike">{formatPrix(total)}</span>
                )}
                {formatPrix(totalApresCode)}
              </span>
            </div>

            {erreur && <p className="shop-cart-error">{erreur}</p>}

            {expressRedirection ? (
              <div className="shop-cart-express-redirecting">Paiement confirmé — préparation de tes fichiers…</div>
            ) : (
              <CartExpressPay
                slug={slug}
                items={items}
                onStatusChange={setExpressStatus}
                onSuccess={apresSuccesExpress}
              />
            )}

            {!expressRedirection && (
              <button
                onClick={passerCommande}
                disabled={chargement}
                className="shop-cart-checkout"
              >
                {chargement ? '...' : 'Passer commande'}
              </button>
            )}
            <p className="shop-cart-note">Licences PDF envoyées par email · téléchargement immédiat</p>
          </div>
        )}
      </aside>
    </div>
  )
}
