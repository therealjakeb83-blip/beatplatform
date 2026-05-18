'use client'

import { useState } from 'react'

type Plan = {
  abo_actif: boolean
  abo_nom: string | null
  abo_description: string | null
  abo_prix: number | null
  abo_remise_pct: number
  abo_essai_jours: number
  stripe_price_id: string | null
}

type Abonne = {
  id: string
  acheteur_email: string | null
  acheteur_nom: string | null
  statut: string
  en_essai: boolean
  date_debut: string
  stripe_subscription_id: string | null
}

export default function AbonnementsClient({
  plan: planInitial,
  abonnes,
}: {
  plan: Plan
  abonnes: Abonne[]
}) {
  const [plan, setPlan] = useState<Plan>(planInitial)
  const [prixEuros, setPrixEuros] = useState(planInitial.abo_prix ? (planInitial.abo_prix / 100).toFixed(2) : '')
  const [chargement, setChargement] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  async function sauvegarder() {
    const prixCents = Math.round(parseFloat(prixEuros) * 100)
    if (!plan.abo_nom || isNaN(prixCents) || prixCents < 100) {
      setMessage({ type: 'err', texte: 'Nom et prix (min 1€) obligatoires.' })
      return
    }
    setChargement(true)
    setMessage(null)
    try {
      const res = await fetch('/api/stripe/abonnement/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: plan.abo_nom,
          description: plan.abo_description,
          prix_cents: prixCents,
          remise_pct: plan.abo_remise_pct,
          essai_jours: plan.abo_essai_jours,
          actif: plan.abo_actif,
        }),
      })
      if (!res.ok) throw new Error()
      setMessage({ type: 'ok', texte: 'Plan sauvegardé avec succès.' })
    } catch {
      setMessage({ type: 'err', texte: 'Erreur lors de la sauvegarde.' })
    } finally {
      setChargement(false)
    }
  }

  const nbActifs = abonnes.filter(a => a.statut === 'actif').length

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-black text-white mb-2">Abonnements</h1>
      <p className="text-gray-500 text-sm mb-8">Configure le plan d'abonnement de ta boutique.</p>

      {/* Toggle actif */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Abonnements activés</p>
            <p className="text-gray-500 text-sm mt-0.5">Les artistes peuvent s'abonner à ta boutique</p>
          </div>
          <button
            onClick={() => setPlan(p => ({ ...p, abo_actif: !p.abo_actif }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${plan.abo_actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${plan.abo_actif ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>

      {/* Config plan */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6 flex flex-col gap-5">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom du plan</label>
          <input
            type="text"
            value={plan.abo_nom ?? ''}
            onChange={e => setPlan(p => ({ ...p, abo_nom: e.target.value }))}
            placeholder="Ex: Studio, Premium, VIP…"
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Description <span className="text-gray-600">(optionnel)</span></label>
          <textarea
            value={plan.abo_description ?? ''}
            onChange={e => setPlan(p => ({ ...p, abo_description: e.target.value }))}
            placeholder="Avantages du plan…"
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Prix mensuel (€)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={prixEuros}
              onChange={e => setPrixEuros(e.target.value)}
              placeholder="6.99"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Remise abonnés (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={plan.abo_remise_pct}
              onChange={e => setPlan(p => ({ ...p, abo_remise_pct: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500"
            />
            <p className="text-xs text-gray-600 mt-1">Sur toutes licences sauf Illimité</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Essai gratuit (jours)</label>
            <input
              type="number"
              min="0"
              max="90"
              value={plan.abo_essai_jours}
              onChange={e => setPlan(p => ({ ...p, abo_essai_jours: parseInt(e.target.value) || 0 }))}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {message && (
          <p className={`text-sm ${message.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {message.texte}
          </p>
        )}

        <button
          onClick={sauvegarder}
          disabled={chargement}
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
        >
          {chargement ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {/* Abonnés */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="font-bold text-white mb-4">
          Abonnés actifs <span className="text-gray-500 font-normal">({nbActifs})</span>
        </h2>
        {abonnes.length === 0 ? (
          <p className="text-gray-600 text-sm">Aucun abonné pour l'instant.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {abonnes.map(a => (
              <div key={a.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-white text-sm font-medium">{a.acheteur_nom ?? a.acheteur_email}</p>
                  {a.acheteur_nom && <p className="text-gray-600 text-xs">{a.acheteur_email}</p>}
                  <p className="text-gray-600 text-xs mt-0.5">
                    Depuis le {new Date(a.date_debut).toLocaleDateString('fr-FR')}
                    {a.en_essai && ' · Essai gratuit'}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  a.statut === 'actif' ? 'bg-green-500/20 text-green-400'
                  : a.statut === 'annule' ? 'bg-gray-700 text-gray-400'
                  : 'bg-red-500/20 text-red-400'
                }`}>
                  {a.statut === 'actif' ? 'Actif' : a.statut === 'annule' ? 'Annulé' : 'Impayé'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
