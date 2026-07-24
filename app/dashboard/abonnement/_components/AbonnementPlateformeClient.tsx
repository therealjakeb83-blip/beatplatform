'use client'

import { useState } from 'react'
import Link from 'next/link'

type Abonnement = {
  id: string
  statut: string
  en_essai: boolean
  essai_fin_le: string
  periode: string
  prix: number
  devise: string
  date_fin: string | null
  stripe_customer_id: string | null
  annulation_prevue_le: string | null
} | null

const STATUT_LABEL: Record<string, { label: string; cls: string }> = {
  en_essai: { label: 'Essai gratuit', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
  actif: { label: 'Actif', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  impaye: { label: 'Paiement en échec', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  annule: { label: 'Annulé', cls: 'bg-gray-700/30 text-gray-400 border-gray-600/30' },
  suspendu: { label: 'Suspendu', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export default function AbonnementPlateformeClient({ abonnement }: { abonnement: Abonnement }) {
  const [periode, setPeriode] = useState<'mensuel' | 'annuel'>('mensuel')
  const [loading, setLoading] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  async function sabonner() {
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/stripe/plateforme/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periode }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setErreur(data.erreur ?? 'Une erreur est survenue.'); setLoading(false) }
    } catch {
      setErreur('Impossible de joindre le serveur.')
      setLoading(false)
    }
  }

  async function gererAbonnement() {
    setLoading(true)
    setErreur(null)
    try {
      const res = await fetch('/api/stripe/plateforme/portail', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { setErreur(data.erreur ?? 'Une erreur est survenue.'); setLoading(false) }
    } catch {
      setErreur('Impossible de joindre le serveur.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-screen-sm mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-xs text-gray-500 hover:text-gray-300">← Dashboard</Link>
      <h1 className="text-xl font-bold text-white mt-2 mb-1">Mon abonnement My Producer</h1>
      <p className="text-sm text-gray-500 mb-6">Ce que tu paies pour utiliser la plateforme.</p>

      {erreur && <p className="text-sm text-red-400 mb-4">{erreur}</p>}

      {abonnement ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Plan Standard — {abonnement.periode}</p>
            <span className={`text-xs px-2 py-1 rounded border ${STATUT_LABEL[abonnement.statut]?.cls ?? ''}`}>
              {STATUT_LABEL[abonnement.statut]?.label ?? abonnement.statut}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {(abonnement.prix / 100).toFixed(2)}{abonnement.devise === 'USD' ? '$' : '€'} / {abonnement.periode === 'annuel' ? 'an' : 'mois'}
          </p>
          {abonnement.en_essai && (
            <p className="text-xs text-gray-500">Essai gratuit jusqu&apos;au {new Date(abonnement.essai_fin_le).toLocaleDateString('fr-FR')}.</p>
          )}
          {abonnement.date_fin && !abonnement.en_essai && (
            <p className="text-xs text-gray-500">Prochain renouvellement le {new Date(abonnement.date_fin).toLocaleDateString('fr-FR')}.</p>
          )}
          {abonnement.annulation_prevue_le && (
            <p className="text-xs text-amber-400">Annulation prévue le {new Date(abonnement.annulation_prevue_le).toLocaleDateString('fr-FR')} — accès conservé jusque-là.</p>
          )}
          {abonnement.stripe_customer_id && (
            <button
              onClick={gererAbonnement}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-800 text-white hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Redirection…' : 'Gérer mon abonnement'}
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setPeriode('mensuel')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${periode === 'mensuel' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setPeriode('annuel')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${periode === 'annuel' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              Annuel
            </button>
          </div>
          <p className="text-2xl font-bold text-white">
            {periode === 'mensuel' ? '49,99€/mois' : '499,90€/an'}
          </p>
          <p className="text-xs text-gray-500">Essai gratuit de 14 jours, carte bancaire requise. Résiliable à tout moment.</p>
          <button
            onClick={sabonner}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold transition-colors"
          >
            {loading ? 'Redirection…' : "Démarrer l'essai gratuit"}
          </button>
        </div>
      )}
    </div>
  )
}
