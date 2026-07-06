'use client'

import { useState } from 'react'

type Plan = {
  abo_actif: boolean
  abo_nom: string | null
  abo_description: string | null
  abo_prix: number | null       // en centimes
  abo_remise_pct: number
  abo_essai_jours: number
  abo_recurrence_cadeau_mois: number
  stripe_price_id: string | null
}

const inp = 'w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500'

export default function PlansClient({ plan: planInitial }: { plan: Plan }) {
  const [plan, setPlan]         = useState<Plan>(planInitial)
  const [prixEuros, setPrix]    = useState(planInitial.abo_prix ? (planInitial.abo_prix / 100).toFixed(2) : '')
  const [chargement, setCharge] = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; texte: string } | null>(null)

  async function sauvegarder() {
    const prixCents = Math.round(parseFloat(prixEuros) * 100)
    if (!plan.abo_nom?.trim()) {
      setMsg({ type: 'err', texte: 'Le nom du plan est obligatoire.' })
      return
    }
    if (isNaN(prixCents) || prixCents < 100) {
      setMsg({ type: 'err', texte: 'Le prix doit être d\'au moins 1 €.' })
      return
    }
    setCharge(true)
    setMsg(null)
    try {
      const res = await fetch('/api/stripe/abonnement/plan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom:         plan.abo_nom,
          description: plan.abo_description ?? null,
          prix_cents:  prixCents,
          remise_pct:  plan.abo_remise_pct,
          essai_jours: plan.abo_essai_jours,
          actif:       plan.abo_actif,
          recurrence_cadeau_mois: plan.abo_recurrence_cadeau_mois,
        }),
      })
      if (!res.ok) throw new Error()
      setMsg({ type: 'ok', texte: 'Plan sauvegardé avec succès.' })
    } catch {
      setMsg({ type: 'err', texte: 'Erreur lors de la sauvegarde. Réessaie.' })
    } finally {
      setCharge(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-8">

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Plan d&apos;abonnement</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure l&apos;offre d&apos;abonnement proposée à tes clients.
        </p>
      </div>

      {/* Toggle actif */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white">Abonnements activés</p>
            <p className="text-gray-500 text-sm mt-0.5">
              Les artistes peuvent s&apos;abonner depuis ta boutique
            </p>
          </div>
          <button
            onClick={() => setPlan(p => ({ ...p, abo_actif: !p.abo_actif }))}
            className={`relative w-12 h-6 rounded-full transition-colors ${plan.abo_actif ? 'bg-indigo-600' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${plan.abo_actif ? 'translate-x-6' : ''}`} />
          </button>
        </div>
      </div>

      {/* Formulaire config */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-5">

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">Nom du plan</label>
          <input
            type="text"
            value={plan.abo_nom ?? ''}
            onChange={e => setPlan(p => ({ ...p, abo_nom: e.target.value }))}
            placeholder="Ex : Studio, Premium, VIP…"
            className={inp}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">
            Description <span className="text-gray-600">(optionnel)</span>
          </label>
          <textarea
            value={plan.abo_description ?? ''}
            onChange={e => setPlan(p => ({ ...p, abo_description: e.target.value }))}
            placeholder="Avantages du plan…"
            rows={3}
            className={inp + ' resize-none'}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Prix mensuel (€)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={prixEuros}
              onChange={e => setPrix(e.target.value)}
              placeholder="6.99"
              className={inp}
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
              className={inp}
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
              className={inp}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Beat cadeau tous les (mois)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={plan.abo_recurrence_cadeau_mois}
              onChange={e => setPlan(p => ({ ...p, abo_recurrence_cadeau_mois: parseInt(e.target.value) || 4 }))}
              className={inp}
            />
            <p className="text-xs text-gray-600 mt-1">Mois consécutifs pour débloquer un code promo</p>
          </div>
        </div>

        {msg && (
          <p className={`text-sm ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {msg.texte}
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

    </div>
  )
}
