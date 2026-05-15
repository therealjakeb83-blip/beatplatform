'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type Stripe from 'stripe'

export default function CodesPromoClient({
  coupons,
  promoCodes,
}: {
  coupons: Stripe.Coupon[]
  promoCodes: Stripe.PromotionCode[]
}) {
  const router = useRouter()
  const [nom, setNom] = useState('')
  const [type, setType] = useState<'pourcentage' | 'montant'>('pourcentage')
  const [valeur, setValeur] = useState('')
  const [expiration, setExpiration] = useState('')
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState('')

  async function creerCode() {
    setErreur('')
    if (!nom || !valeur) { setErreur('Remplis tous les champs.'); return }
    setChargement(true)
    const res = await fetch('/api/stripe/codes-promo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, type, valeur: Number(valeur), expiration: expiration || null }),
    })
    const data = await res.json()
    if (!res.ok) { setErreur(data.erreur ?? 'Erreur'); setChargement(false); return }
    setNom(''); setValeur(''); setExpiration('')
    setChargement(false)
    router.refresh()
  }

  async function supprimerCode(couponId: string) {
    await fetch('/api/stripe/codes-promo', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon_id: couponId }),
    })
    router.refresh()
  }

  function getPromoCode(couponId: string) {
    return promoCodes.find(p => {
      const promo = p.promotion as unknown as { type: string; coupon?: string }
      return promo.type === 'coupon' && promo.coupon === couponId
    })?.code ?? null
  }

  function formatReduction(coupon: Stripe.Coupon) {
    if (coupon.percent_off) return `-${coupon.percent_off}%`
    if (coupon.amount_off) return `-${coupon.amount_off / 100}€`
    return ''
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Codes promo</h1>
          <p className="text-gray-400 text-sm">Crée des codes de réduction utilisables au checkout.</p>
        </div>

        {/* Formulaire création */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">Nouveau code</h2>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nom du code</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value.toUpperCase())}
                placeholder="ETE2025"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500 uppercase"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as 'pourcentage' | 'montant')}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                >
                  <option value="pourcentage">Pourcentage (%)</option>
                  <option value="montant">Montant fixe (€)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-400 mb-1">
                  {type === 'pourcentage' ? 'Réduction (%)' : 'Réduction (€)'}
                </label>
                <input
                  type="number"
                  value={valeur}
                  onChange={e => setValeur(e.target.value)}
                  min="0"
                  placeholder={type === 'pourcentage' ? '20' : '10'}
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Date d&apos;expiration (optionnel)</label>
              <input
                type="date"
                value={expiration}
                onChange={e => setExpiration(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {erreur && <p className="text-red-400 text-sm">{erreur}</p>}

            <button
              onClick={creerCode}
              disabled={chargement}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {chargement ? 'Création...' : 'Créer le code'}
            </button>
          </div>
        </section>

        {/* Liste des codes */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-4">Codes actifs ({coupons.length})</h2>
          {coupons.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun code promo créé.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {coupons.map(coupon => {
                const code = getPromoCode(coupon.id)
                return (
                  <div
                    key={coupon.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-800"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white">{code ?? coupon.name}</span>
                        <span className="text-sm text-indigo-400 font-semibold">{formatReduction(coupon)}</span>
                      </div>
                      {coupon.redeem_by && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Expire le {new Date(coupon.redeem_by * 1000).toLocaleDateString('fr-FR')}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => supprimerCode(coupon.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Supprimer
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
