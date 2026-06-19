'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MembreRow = {
  id: string
  label: string
  nom: string
  email: string
  pays: string | null
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  ltv: number
  dernier_achat_iso: string | null
}

export type ContactLight = {
  id: string
  label: string
  nom: string
  email: string
  pays: string | null
}

type Props = {
  liste: { id: string; nom: string; description: string | null }
  membres: MembreRow[]
  tousContacts: ContactLight[]
  ajouterContacts: (fd: FormData) => Promise<void>
  retirerContact: (fd: FormData) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initiales(label: string, nom: string): string {
  return `${label[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?'
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmt(euros: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(euros)
}

const STATUT_LABEL: Record<MembreRow['statut'], string> = {
  abonne: 'Abonné',
  ancien: 'Ancien abonné',
  client: 'Client',
  lead:   'Lead',
}
const STATUT_CLS: Record<MembreRow['statut'], string> = {
  abonne: 'text-indigo-400',
  ancien: 'text-gray-500',
  client: 'text-green-400',
  lead:   'text-gray-400',
}

// ── Modale ajout contacts ─────────────────────────────────────────────────────

function AjouterModal({
  contacts,
  onClose,
  onSave,
}: {
  contacts: ContactLight[]
  onClose: () => void
  onSave: (ids: string[]) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return contacts
    return contacts.filter(c =>
      `${c.label} ${c.nom} ${c.email}`.toLowerCase().includes(q)
    )
  }, [contacts, search])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!selected.size) return
    setSaving(true)
    await onSave([...selected])
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header modale */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-sm font-bold text-white mb-3">Ajouter des contacts</h2>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            autoFocus
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Liste contacts */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-8">
              {contacts.length === 0 ? 'Tous les contacts sont déjà dans cette liste' : 'Aucun résultat'}
            </p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`w-full flex items-center gap-3 px-5 py-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 transition-colors text-left ${
                  selected.has(c.id) ? 'bg-indigo-950/30' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {c.pays
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                    : <span className="text-indigo-300 font-bold text-[10px]">{initiales(c.label, c.nom)}</span>
                  }
                </div>
                {/* Nom + email */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.label} {c.nom}</p>
                  <p className="text-[10px] text-gray-600 truncate">{c.email}</p>
                </div>
                {/* Checkbox */}
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  selected.has(c.id)
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'border-gray-600'
                }`}>
                  {selected.has(c.id) && (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer modale */}
        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500">
            {selected.size > 0 ? `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}` : 'Aucune sélection'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selected.size === 0}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {saving ? 'Ajout…' : `Ajouter ${selected.size > 0 ? selected.size : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function ListeDetailClient({
  liste,
  membres,
  tousContacts,
  ajouterContacts,
  retirerContact,
}: Props) {
  const [showModal, setShowModal] = useState(false)

  async function handleAjouter(ids: string[]) {
    const fd = new FormData()
    fd.set('client_ids', JSON.stringify(ids))
    await ajouterContacts(fd)
  }

  async function handleRetirer(membreId: string, nom: string) {
    if (!confirm(`Retirer "${nom}" de cette liste ?`)) return
    const fd = new FormData()
    fd.set('client_id', membreId)
    await retirerContact(fd)
  }

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <Link href="/dashboard/business/listes" className="hover:text-white transition-colors">
              Listes
            </Link>
            <span className="text-gray-700">›</span>
            <span className="text-white">{liste.nom}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-white">{liste.nom}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {liste.description && <>{liste.description} · </>}
                <span className="text-gray-400">
                  {membres.length} contact{membres.length !== 1 ? 's' : ''}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Ajouter des contacts */}
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                </svg>
                Ajouter des contacts
              </button>

              {/* Lancer une campagne (désactivé) */}
              <button
                disabled
                title="Disponible dans le sprint Marketing"
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-xl text-xs font-semibold text-gray-500 cursor-not-allowed"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M1.75 2A1.75 1.75 0 0 0 0 3.75v.736a.75.75 0 0 0 .579.731A39.4 39.4 0 0 1 8 6.5a39.4 39.4 0 0 1 7.421-1.283.75.75 0 0 0 .579-.731V3.75A1.75 1.75 0 0 0 14.25 2h-12.5Z" />
                  <path d="M.003 10.563A.75.75 0 0 0 1 11.25v1A1.75 1.75 0 0 0 2.75 14h10.5A1.75 1.75 0 0 0 15 12.25v-1a.75.75 0 0 0 .997-.687A41 41 0 0 0 8 8a41 41 0 0 0-7.997 2.563Z" />
                </svg>
                Lancer une campagne
              </button>
            </div>
          </div>
        </div>

        {/* Contenu */}
        {membres.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-20">
            <p className="text-gray-500 text-sm mb-1">Aucun contact dans cette liste</p>
            <p className="text-gray-700 text-xs mb-5">Clique sur "Ajouter des contacts" pour commencer</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
            >
              + Ajouter des contacts
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dernier achat</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">LTV</th>
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {membres.map(m => (
                  <tr key={m.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors group">

                    {/* Contact */}
                    <td className="px-6 py-3">
                      <Link href={`/dashboard/business/contacts/${m.id}`} className="flex items-center gap-3 group/link">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                          {m.pays
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={`https://flagcdn.com/w40/${m.pays.toLowerCase()}.png`} alt={m.pays} className="w-full h-full object-cover" />
                            : <span className="text-indigo-300 font-bold text-xs">{initiales(m.label, m.nom)}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white group-hover/link:text-indigo-300 transition-colors text-xs">
                            {m.label} {m.nom}
                          </p>
                          <p className="text-[10px] text-gray-600 truncate">{m.email}</p>
                        </div>
                      </Link>
                    </td>

                    {/* Statut */}
                    <td className="px-6 py-3 text-xs">
                      <span className={STATUT_CLS[m.statut]}>{STATUT_LABEL[m.statut]}</span>
                    </td>

                    {/* Dernier achat */}
                    <td className="px-6 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                      {m.dernier_achat_iso
                        ? formatDate(m.dernier_achat_iso)
                        : <span className="text-gray-700">—</span>
                      }
                    </td>

                    {/* LTV */}
                    <td className="px-6 py-3 text-right text-white font-semibold text-xs whitespace-nowrap">
                      {fmt(m.ltv)}
                    </td>

                    {/* Retirer */}
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRetirer(m.id, `${m.label} ${m.nom}`.trim())}
                        className="text-[10px] text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                      >
                        Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <AjouterModal
          contacts={tousContacts}
          onClose={() => setShowModal(false)}
          onSave={handleAjouter}
        />
      )}
    </>
  )
}
