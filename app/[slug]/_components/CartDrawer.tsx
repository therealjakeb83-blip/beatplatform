'use client'

import { useState } from 'react'
import { useCart } from './CartContext'

export default function CartDrawer({ slug }: { slug: string }) {
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
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />

      <div className="relative w-full max-w-md h-full bg-gray-950 border-l border-gray-800 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="font-bold text-white">Panier ({items.length})</h2>
          <button onClick={close} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-8">Ton panier est vide.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {items.map(item => (
                <div key={`${item.beatId}:${item.licenceId}`} className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl p-3">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.titre} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.titre}</p>
                    <p className="text-gray-500 text-xs">{item.licenceNom} · {item.prix}€</p>
                  </div>
                  <button
                    onClick={() => removeItem(item.beatId, item.licenceId)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                    title="Retirer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-800 px-5 py-4 flex flex-col gap-3">
            {/* Code promo */}
            {codeApplique ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-400">
                  Code <strong>{codeApplique.code}</strong> appliqué
                </span>
                <button onClick={() => setCodeApplique(null)} className="text-gray-500 hover:text-gray-300 text-xs underline">
                  Supprimer
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={codeInput}
                    onChange={e => { setCodeInput(e.target.value.toUpperCase()); setErreurCode(null) }}
                    onKeyDown={e => e.key === 'Enter' && validerCode()}
                    placeholder="Code promo"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                  />
                  <button
                    onClick={validerCode}
                    disabled={!codeInput.trim() || chargementCode}
                    className="px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {chargementCode ? '...' : 'Appliquer'}
                  </button>
                </div>
                {erreurCode && <p className="text-red-400 text-xs mt-2">{erreurCode}</p>}
              </div>
            )}

            <input
              type="email"
              value={emailAcheteur}
              onChange={e => setEmailAcheteur(e.target.value)}
              placeholder="Ton email (si non connecté)"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
            />

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total</span>
              <span className="text-white font-bold text-lg">
                {codeApplique && totalApresCode !== total && (
                  <span className="text-gray-500 line-through text-sm mr-2">{total.toFixed(2)}€</span>
                )}
                {totalApresCode.toFixed(2)}€
              </span>
            </div>

            {erreur && <p className="text-red-400 text-xs">{erreur}</p>}

            <button
              onClick={passerCommande}
              disabled={chargement}
              className="w-full px-4 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
            >
              {chargement ? '...' : 'Passer commande'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
