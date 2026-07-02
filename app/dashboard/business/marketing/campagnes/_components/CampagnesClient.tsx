'use client'

import { useState } from 'react'
import type { CampagneRow, CibleOption, TemplateOption } from '../page'
import NouvelleCampagneWizard from './NouvelleCampagneWizard'

type Props = {
  campagnes: CampagneRow[]
  segments: CibleOption[]
  listes: CibleOption[]
  templates: TemplateOption[]
  segmentPreselectionne: string | null
  erreur: string | null
  creerCampagne:     (fd: FormData) => Promise<void>
  dupliquerCampagne: (fd: FormData) => Promise<void>
  supprimerCampagne: (fd: FormData) => Promise<void>
  planifierCampagne: (fd: FormData) => Promise<void>
  envoyerMaintenant: (fd: FormData) => Promise<void>
}

function formatDate(iso: string | null): string {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function pct(n: number, total: number): string {
  if (total === 0) return '–'
  return `${Math.round((n / total) * 100)}%`
}

const STATUT_BADGE: Record<CampagneRow['statut'], string> = {
  brouillon: 'bg-gray-700 text-gray-300',
  planifiee: 'bg-amber-500/20 text-amber-400',
  envoyee:   'bg-green-500/20 text-green-400',
}
const STATUT_LABEL: Record<CampagneRow['statut'], string> = {
  brouillon: 'Brouillon',
  planifiee: 'Planifiée',
  envoyee:   'Envoyée',
}

export default function CampagnesClient({
  campagnes, segments, listes, templates, segmentPreselectionne, erreur,
  creerCampagne, dupliquerCampagne, supprimerCampagne, planifierCampagne, envoyerMaintenant,
}: Props) {
  const [showWizard, setShowWizard] = useState(!!segmentPreselectionne)
  const [planifId,   setPlanifId]   = useState<string | null>(null)

  const envoyees = campagnes.filter(c => c.statut === 'envoyee')
  const planifiees = campagnes.filter(c => c.statut === 'planifiee')
  const brouillons = campagnes.filter(c => c.statut === 'brouillon')

  const tauxMoyen = (champ: 'ouvertures' | 'clics' | 'conversions') => {
    const avecDest = envoyees.filter(c => c.destinataires > 0)
    if (avecDest.length === 0) return '–'
    const moyenne = avecDest.reduce((s, c) => s + c[champ] / c.destinataires, 0) / avecDest.length
    return `${Math.round(moyenne * 100)}%`
  }

  async function handleCreate(fd: FormData) {
    await creerCampagne(fd)
    setShowWizard(false)
  }

  async function handlePlanifier(fd: FormData) {
    await planifierCampagne(fd)
    setPlanifId(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">Campagnes</h1>
          <p className="text-xs text-gray-500 mt-0.5">Emails ciblés envoyés à tes segments et listes</p>
        </div>
        <button
          onClick={() => setShowWizard(true)}
          className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          + Nouvelle campagne
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {erreur && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            {erreur}
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Campagnes envoyées</p>
            <p className="text-2xl font-black text-white">{envoyees.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Taux d&apos;ouverture moyen</p>
            <p className="text-2xl font-black text-white">{tauxMoyen('ouvertures')}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Taux de clic moyen</p>
            <p className="text-2xl font-black text-white">{tauxMoyen('clics')}</p>
          </div>
          <div className="p-4 rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Conversion moyenne</p>
            <p className="text-2xl font-black text-white">{tauxMoyen('conversions')}</p>
          </div>
        </div>

        {/* Planifiées */}
        {planifiees.length > 0 && (
          <Section titre="Planifiées">
            <div className="grid grid-cols-2 gap-3">
              {planifiees.map(c => (
                <CarteCampagne key={c.id} c={c} supprimerCampagne={supprimerCampagne} dupliquerCampagne={dupliquerCampagne}>
                  <p className="text-xs text-amber-400 mt-2">Envoi prévu le {formatDate(c.scheduled_at)}</p>
                </CarteCampagne>
              ))}
            </div>
          </Section>
        )}

        {/* Brouillons */}
        {brouillons.length > 0 && (
          <Section titre="Brouillons">
            <div className="grid grid-cols-2 gap-3">
              {brouillons.map(c => (
                <CarteCampagne key={c.id} c={c} supprimerCampagne={supprimerCampagne} dupliquerCampagne={dupliquerCampagne}>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => setPlanifId(c.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium transition-colors"
                    >
                      Planifier
                    </button>
                    <form action={envoyerMaintenant}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                        onClick={e => { if (!confirm(`Envoyer "${c.nom}" à ${c.destinataires || '…'} destinataires maintenant ?`)) e.preventDefault() }}
                      >
                        Envoyer maintenant
                      </button>
                    </form>
                  </div>
                </CarteCampagne>
              ))}
            </div>
          </Section>
        )}

        {/* Historique */}
        <Section titre="Historique">
          {envoyees.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">Aucune campagne envoyée pour l&apos;instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campagne</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Envoyée</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dest.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ouv.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Clics</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Conv.</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Désinscrits</th>
                  </tr>
                </thead>
                <tbody>
                  {envoyees.map(c => (
                    <tr key={c.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40">
                      <td className="px-3 py-3">
                        <p className="font-semibold text-white text-xs">{c.nom}</p>
                        <p className="text-[11px] text-gray-500">{c.objet}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400">{formatDate(c.sent_at)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-300">{c.destinataires}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-300">{pct(c.ouvertures, c.destinataires)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-300">{pct(c.clics, c.destinataires)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-300">{pct(c.conversions, c.destinataires)}</td>
                      <td className="px-3 py-3 text-right text-xs text-gray-500">{c.desinscrits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      {showWizard && (
        <NouvelleCampagneWizard
          segments={segments}
          listes={listes}
          templates={templates}
          segmentInitial={segmentPreselectionne}
          onClose={() => setShowWizard(false)}
          onCreate={handleCreate}
        />
      )}

      {planifId && (
        <ModalePlanifier
          onClose={() => setPlanifId(null)}
          onConfirm={async (date) => {
            const fd = new FormData()
            fd.append('id', planifId)
            fd.append('scheduled_at', date)
            await handlePlanifier(fd)
          }}
        />
      )}
    </div>
  )
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{titre}</h2>
      {children}
    </div>
  )
}

function CarteCampagne({
  c, children, supprimerCampagne, dupliquerCampagne,
}: {
  c: CampagneRow
  children: React.ReactNode
  supprimerCampagne: (fd: FormData) => Promise<void>
  dupliquerCampagne: (fd: FormData) => Promise<void>
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-colors group">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[c.statut]}`}>
            {STATUT_LABEL[c.statut]}
          </span>
          <p className="font-semibold text-white text-sm mt-1.5 truncate">{c.nom}</p>
          <p className="text-xs text-gray-500 truncate">{c.objet}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <form action={dupliquerCampagne}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
              title="Dupliquer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M4 2.5A1.5 1.5 0 0 1 5.5 1h5A1.5 1.5 0 0 1 12 2.5V4h-1.5V2.5h-5v9H7V13H5.5A1.5 1.5 0 0 1 4 11.5v-9Z" />
                <path fillRule="evenodd" d="M8.5 6A1.5 1.5 0 0 0 7 7.5v6A1.5 1.5 0 0 0 8.5 15h4A1.5 1.5 0 0 0 14 13.5v-6A1.5 1.5 0 0 0 12.5 6h-4ZM8.5 7.5h4v6h-4v-6Z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
          <form action={supprimerCampagne}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
              title="Supprimer"
              onClick={e => { if (!confirm(`Supprimer "${c.nom}" ?`)) e.preventDefault() }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.712Z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  )
}

function ModalePlanifier({ onClose, onConfirm }: { onClose: () => void; onConfirm: (date: string) => Promise<void> }) {
  const [date, setDate] = useState('')
  const [pending, setPending] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-sm font-bold text-white mb-4">Planifier l&apos;envoi</h3>
        <input
          type="datetime-local"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm mb-2"
        />
        <p className="text-[11px] text-gray-600 mb-4">
          La campagne part au prochain passage du cron quotidien (matin), pas à la minute précise choisie.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
            Annuler
          </button>
          <button
            disabled={!date || pending}
            onClick={async () => { setPending(true); await onConfirm(date); setPending(false) }}
            className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-colors"
          >
            Planifier
          </button>
        </div>
      </div>
    </div>
  )
}
