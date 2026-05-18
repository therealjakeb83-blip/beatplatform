'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PaiementsClient({
  stripeAccountId,
  tvaActive,
  tvaTaux,
  tvaNumero,
}: {
  stripeAccountId: string | null
  tvaActive: boolean
  tvaTaux: number
  tvaNumero: string
}) {
  const router = useRouter()
  const [chargementConnect, setChargementConnect] = useState(false)
  const [tvaActif, setTvaActif] = useState(tvaActive)
  const [taux, setTaux] = useState(String(tvaTaux || 20))
  const [numero, setNumero] = useState(tvaNumero || '')
  const [sauvegardeOk, setSauvegardeOk] = useState(false)
  const [chargementTva, setChargementTva] = useState(false)

  async function connecterStripe() {
    setChargementConnect(true)
    const res = await fetch('/api/stripe/connect/creer', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else setChargementConnect(false)
  }

  async function sauvegarderTva() {
    setChargementTva(true)
    setSauvegardeOk(false)
    await fetch('/api/stripe/tva', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tva_active: tvaActif, tva_taux: Number(taux), tva_numero: numero }),
    })
    setChargementTva(false)
    setSauvegardeOk(true)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Paiements</h1>
          <p className="text-gray-400 text-sm">Connecte ton compte bancaire et configure ta TVA.</p>
        </div>

        {/* Stripe Connect */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">Compte Stripe Connect</h2>
          <p className="text-gray-400 text-sm mb-4">
            Lie ton compte bancaire pour recevoir les paiements de tes acheteurs.
          </p>

          {stripeAccountId ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-green-400 font-medium">Compte connecté</span>
                <span className="text-gray-600 text-xs">{stripeAccountId}</span>
              </div>
              <button
                onClick={connecterStripe}
                disabled={chargementConnect}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium disabled:opacity-50 transition-colors w-fit"
              >
                {chargementConnect ? 'Redirection...' : 'Compléter / mettre à jour la configuration Stripe'}
              </button>
            </div>
          ) : (
            <button
              onClick={connecterStripe}
              disabled={chargementConnect}
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {chargementConnect ? 'Redirection...' : 'Connecter mon compte bancaire'}
            </button>
          )}
        </section>

        {/* TVA */}
        <section className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold mb-1">TVA</h2>
          <p className="text-gray-400 text-sm mb-4">
            Active uniquement si tu es assujetti à la TVA. Elle sera ajoutée au prix affiché.
          </p>

          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => setTvaActif(!tvaActif)}
              className={`relative w-12 h-6 rounded-full transition-colors ${tvaActif ? 'bg-indigo-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${tvaActif ? 'left-7' : 'left-1'}`} />
            </button>
            <span className="text-sm text-gray-300">
              {tvaActif ? 'TVA activée' : 'TVA désactivée'}
            </span>
          </div>

          {tvaActif && (
            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Taux de TVA (%)</label>
                <input
                  type="number"
                  value={taux}
                  onChange={e => setTaux(e.target.value)}
                  min="0"
                  max="100"
                  className="w-32 px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Numéro de TVA intracommunautaire</label>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="FR12345678901"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={sauvegarderTva}
            disabled={chargementTva}
            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {chargementTva ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          {sauvegardeOk && (
            <p className="text-green-400 text-sm mt-2">Sauvegardé.</p>
          )}
        </section>
      </div>
    </main>
  )
}
