'use client'

import { useState } from 'react'
import { useCart } from './CartContext'

export default function CartDrawer({
  slug,
  aboActif = false,
  aboRemisePct = 0,
}: {
  slug: string
  aboActif?: boolean
  aboRemisePct?: number
}) {
  const { items, isOpen, close, removeItem, clear } = useCart()

  const [codeInput, setCodeInput] = useState('')
  const [codeApplique, setCodeApplique] = useState<{ code: string; type_valeur: 'pourcentage' | 'montant'; valeur: number } | null>(null)
  const [erreurCode, setErreurCode] = useState<string | null>(null)
  const [chargementCode, setChargementCode] = useState(false)
  const [emailAcheteur, setEmailAcheteur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  if (!isOpen) return null

  const total = items.reduce((s, i) => s + i.prix, 0)
  const totalApresCode = codeApplique
    ? (codeApplique.type_valeur === 'pourcentage'
        ? total * (1 - codeApplique.valeur / 100)
        : Math.max(0, total - codeApplique.valeur))
    : total

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

  return (
    <div className="shop-cart-overlay" onClick={close}>
      <aside className="shop-cart-drawer" onClick={e => e.stopPropagation()}>
        <div className="shop-cart-header">
          <h2>Panier <span className="shop-section-count">({items.length})</span></h2>
          <button onClick={close} className="shop-cart-close" aria-label="Fermer">×</button>
        </div>

        <div className="shop-cart-items">
          {items.length === 0 ? (
            <p className="shop-cart-empty">Ton panier est vide.</p>
          ) : (
            <>
              {items.map(item => (
                <div key={`${item.beatId}:${item.licenceId}`} className="shop-cart-item">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.titre} className="shop-cart-item-cover" />
                  ) : (
                    <div className="shop-cart-item-cover" />
                  )}
                  <div className="shop-cart-item-body">
                    <p className="shop-cart-item-title">{item.titre}</p>
                    <span className="shop-cart-item-licence">{item.licenceNom} · {item.prix}€</span>
                  </div>
                  <button
                    onClick={() => removeItem(item.beatId, item.licenceId)}
                    className="shop-cart-item-remove"
                    title="Retirer"
                    aria-label="Retirer"
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}

              {aboActif && (
                <div className="shop-cart-member-banner">
                  👑 Membre : {aboRemisePct > 0 ? `−${aboRemisePct}% sur toutes les licences.` : 'des avantages exclusifs sur toutes les licences.'}
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
              <span>{total.toFixed(2)}€</span>
            </div>
            <div className="shop-cart-row is-total">
              <span>Total</span>
              <span>
                {codeApplique && totalApresCode !== total && (
                  <span className="shop-cart-strike">{total.toFixed(2)}€</span>
                )}
                {totalApresCode.toFixed(2)}€
              </span>
            </div>

            {erreur && <p className="shop-cart-error">{erreur}</p>}

            <button onClick={passerCommande} disabled={chargement} className="shop-cart-checkout">
              {chargement ? '...' : 'Passer commande'}
            </button>
            <p className="shop-cart-note">Licences PDF envoyées par email · téléchargement immédiat</p>
          </div>
        )}
      </aside>
    </div>
  )
}
