'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { AboRow } from '../page'

/* ─── types ─────────────────────────────────────────────────────── */

type UIStatut = 'actif' | 'annulation en cours' | 'en attente' | 'annulé'

/* ─── helpers ────────────────────────────────────────────────────── */

function computeStatut(a: AboRow): UIStatut {
  if (a.annulation_en_cours) return 'annulation en cours'
  if (a.statut === 'annule')  return 'annulé'
  if (a.statut === 'impaye')  return 'en attente'
  return 'actif'
}

function nomClient(a: AboRow): string {
  if (a.clients) return [a.clients.prenom, a.clients.nom].filter(Boolean).join(' ')
  return a.acheteur_nom ?? a.acheteur_email ?? '—'
}

function paysCode(a: AboRow): string | null {
  return a.clients?.pays ?? null
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function paiementSuivant(a: AboRow): string | null {
  if (a.statut !== 'actif' || a.annulation_en_cours) return null
  return a.date_fin
}

function dateFin(a: AboRow): string | null {
  if (a.statut === 'annule' || a.annulation_en_cours) return a.date_fin
  return null
}

function finEssai(a: AboRow): string | null {
  if (a.fin_essai) return a.fin_essai
  if (a.en_essai && a.date_fin) return a.date_fin
  return null
}

function methodLabel(m: string): string {
  if (m === 'paypal') return 'Via PayPal'
  return 'Via Stripe'
}

function idCourt(id: string): string {
  return `A-${id.slice(0, 8).toUpperCase()}`
}

/* ─── constants ──────────────────────────────────────────────────── */

const STATUT_BADGE: Record<UIStatut, string> = {
  'actif':               'bg-green-500/15 text-green-400 border-green-500/20',
  'annulation en cours': 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  'en attente':          'bg-amber-500/15 text-amber-400 border-amber-500/20',
  'annulé':              'bg-red-500/15 text-red-400 border-red-500/20',
}

const TABS: { label: string; value: UIStatut | '' }[] = [
  { label: 'Tous',                value: ''                    },
  { label: 'Actif',               value: 'actif'               },
  { label: 'En attente',          value: 'en attente'          },
  { label: 'Annulé',              value: 'annulé'              },
  { label: 'Annulation en cours', value: 'annulation en cours' },
]

const SCOPES = [
  { value: '',       label: 'Tout'            },
  { value: 'id',     label: 'N° abonnement'   },
  { value: 'email',  label: 'E-mail du client' },
  { value: 'client', label: 'Clients'          },
]

/* ─── component ──────────────────────────────────────────────────── */

export default function AbonnementsClient({ abonnements }: { abonnements: AboRow[] }) {
  const [filtreStatut,  setFiltreStatut]  = useState<UIStatut | ''>('')
  const [search,        setSearch]        = useState('')
  const [scope,         setScope]         = useState('')
  const [scopeOpen,     setScopeOpen]     = useState(false)
  const [filtreMethode, setFiltreMethode] = useState('')
  const [filtrePeriode, setFiltrePeriode] = useState('')

  // Counts par statut (calculés une seule fois)
  const counts = useMemo(() => {
    const res: Record<UIStatut | '', number> = {
      '': abonnements.length, 'actif': 0, 'en attente': 0, 'annulé': 0, 'annulation en cours': 0,
    }
    for (const a of abonnements) res[computeStatut(a)]++
    return res
  }, [abonnements])

  const displayed = useMemo(() => {
    const q = search.toLowerCase()
    const now = Date.now()
    const cutoff = filtrePeriode
      ? new Date(now - parseInt(filtrePeriode) * 86_400_000)
      : null

    return abonnements.filter(a => {
      const uiStatut = computeStatut(a)

      if (filtreStatut && uiStatut !== filtreStatut) return false
      if (filtreMethode && a.methode_paiement !== filtreMethode) return false
      if (cutoff && new Date(a.date_debut) < cutoff) return false

      if (q) {
        const email = a.clients?.email ?? a.acheteur_email ?? ''
        const nom   = nomClient(a)
        const idStr = idCourt(a.id)
        const hay   = scope === 'id'     ? idStr
                    : scope === 'email'  ? email
                    : scope === 'client' ? nom
                    : `${nom} ${idStr} ${email}`
        if (!hay.toLowerCase().includes(q)) return false
      }

      return true
    })
  }, [abonnements, filtreStatut, filtreMethode, filtrePeriode, search, scope])

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Abonnements</h1>
          <p className="text-sm text-gray-500 mt-1">Abonnés actifs et historique</p>
        </div>

        {/* Tabs statut */}
        <div className="flex items-center gap-0 mb-5 border-b border-gray-800">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFiltreStatut(tab.value)}
              className={`px-4 py-2.5 text-sm transition-colors relative ${
                filtreStatut === tab.value
                  ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                filtreStatut === tab.value ? 'bg-indigo-500/20 text-indigo-300' : 'bg-gray-800 text-gray-500'
              }`}>
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-4">
          {/* Scope selector */}
          <div className="relative">
            <button
              onClick={() => setScopeOpen(o => !o)}
              className="flex items-center gap-1.5 bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 whitespace-nowrap transition-colors"
            >
              {SCOPES.find(s => s.value === scope)?.label ?? 'Tout'}
              <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {scopeOpen && (
              <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-20 min-w-[180px] py-1">
                {SCOPES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => { setScope(s.value); setScopeOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${scope === s.value ? 'text-white bg-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              scope === 'id'     ? "Rechercher par n° d'abonnement…"  :
              scope === 'email'  ? 'Rechercher par e-mail…'            :
              scope === 'client' ? 'Rechercher par nom de client…'     :
              "Rechercher un abonné, un n° d'abonnement…"
            }
            className="flex-1 bg-gray-900 border border-gray-800 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors"
          />
          <span className="text-xs text-gray-600 whitespace-nowrap">
            {displayed.length} abonnement{displayed.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* Filtres */}
        <div className="flex items-center gap-2 mb-5">
          <select
            value={filtreMethode}
            onChange={e => setFiltreMethode(e.target.value)}
            className={`bg-gray-900 border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors cursor-pointer ${
              filtreMethode ? 'border-indigo-500 text-white' : 'border-gray-800 text-gray-400'
            }`}
          >
            <option value="">Moyen de paiement</option>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </select>

          <select
            value={filtrePeriode}
            onChange={e => setFiltrePeriode(e.target.value)}
            className={`bg-gray-900 border rounded-lg px-3 py-1.5 text-sm outline-none transition-colors cursor-pointer ${
              filtrePeriode ? 'border-indigo-500 text-white' : 'border-gray-800 text-gray-400'
            }`}
          >
            <option value="">Date de début</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">3 derniers mois</option>
            <option value="180">6 derniers mois</option>
            <option value="365">Cette année</option>
          </select>

          {(filtreMethode || filtrePeriode) && (
            <button
              onClick={() => { setFiltreMethode(''); setFiltrePeriode('') }}
              className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1.5"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Tableau */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Abonnement</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">État</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Date de début</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Fin d'essai</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Paiement suivant</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Dernière commande</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Date de fin</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Total</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-600">Commandes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {displayed.map(a => {
                const uiStatut  = computeStatut(a)
                const pays      = paysCode(a)
                const paiement  = paiementSuivant(a)
                const fin       = dateFin(a)
                const essai     = finEssai(a)
                const nb        = a.mensualites_payees ?? 0

                return (
                  <tr key={a.id} className="hover:bg-gray-800/40 transition-colors">

                    {/* Abonnement */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                          {pays ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`https://flagcdn.com/w40/${pays.toLowerCase()}.png`} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-indigo-300 font-bold text-[10px]">
                              {nomClient(a).split(' ').slice(0,2).map(p => p[0]).join('').toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/business/abonnements/${a.id}`}
                            className="text-gray-500 font-mono font-normal text-xs mr-2 hover:text-indigo-400 transition-colors"
                          >
                            {idCourt(a.id)}
                          </Link>
                          {a.client_id ? (
                            <Link
                              href={`/dashboard/business/contacts/${a.client_id}`}
                              className="text-sm font-medium text-white hover:text-indigo-300 transition-colors"
                            >
                              {nomClient(a)}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium text-white">{nomClient(a)}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* État */}
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium whitespace-nowrap ${STATUT_BADGE[uiStatut]}`}>
                        {uiStatut.charAt(0).toUpperCase() + uiStatut.slice(1)}
                      </span>
                    </td>

                    {/* Date de début */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{formatDate(a.date_debut)}</span>
                    </td>

                    {/* Fin d'essai */}
                    <td className="px-4 py-3">
                      <span className={`text-xs ${essai ? 'text-gray-500' : 'text-gray-700'}`}>
                        {formatDate(essai)}
                      </span>
                    </td>

                    {/* Paiement suivant */}
                    <td className="px-4 py-3">
                      <span className={`text-xs ${paiement ? 'text-gray-500' : 'text-gray-700'}`}>
                        {formatDate(paiement)}
                      </span>
                    </td>

                    {/* Dernière commande */}
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-500">{formatDate(a.derniere_commande)}</span>
                    </td>

                    {/* Date de fin */}
                    <td className="px-4 py-3">
                      <span className={`text-xs ${fin ? 'text-gray-500' : 'text-gray-700'}`}>
                        {formatDate(fin)}
                      </span>
                    </td>

                    {/* Total + méthode */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-white">
                        {(a.prix / 100).toFixed(2)}€ / mois
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">{methodLabel(a.methode_paiement)}</p>
                    </td>

                    {/* Commandes */}
                    <td className="px-4 py-3 text-right">
                      {a.client_id ? (
                        <Link
                          href={`/dashboard/business/commandes?clientId=${a.client_id}`}
                          className="text-sm text-gray-400 hover:text-indigo-400 transition-colors"
                          title="Voir les commandes du client"
                        >
                          {nb}
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-600">{nb}</span>
                      )}
                    </td>

                  </tr>
                )
              })}

              {displayed.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-xs text-gray-700">
                    Aucun abonnement trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
