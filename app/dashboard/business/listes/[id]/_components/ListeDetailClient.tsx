'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import SocialIcon from '../../../_components/SocialIcon'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MembreRow = {
  id: string
  label: string
  nom: string
  email: string
  pays: string | null
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  statut_abo_detail: string | null
  nb_achats: number
  ltv: number
  panier_moyen: number
  dernier_achat_iso: string | null
  premiere_contact_iso: string | null
  dernier_contact_iso: string | null
  newsletter_consent: boolean
  lead_source: string | null
  lead_nb_favoris: number
  lead_nb_free_dl: number
  pref_style: string | null
  pref_type_beat: string | null
  pref_ambiance: string | null
  instagram: string | null
  spotify: string | null
  youtube: string | null
  tiktok: string | null
  telephone: string | null
}

export type ContactLight = {
  id: string
  label: string
  nom: string
  email: string
  pays: string | null
}

// ── Définition des colonnes ───────────────────────────────────────────────────

type ColDef = { key: string; label: string; defaultOn: boolean; align: 'left' | 'right' }

const COLONNES: ColDef[] = [
  { key: 'statut',          label: 'Statut',          defaultOn: true,  align: 'left'  },
  { key: 'score',           label: 'Score',           defaultOn: false, align: 'left'  },
  { key: 'newsletter',      label: 'Newsletter',      defaultOn: false, align: 'left'  },
  { key: 'ltv',             label: 'LTV',             defaultOn: true,  align: 'right' },
  { key: 'dernier_achat',   label: 'Dernier achat',   defaultOn: true,  align: 'right' },
  { key: 'nb_licences',     label: 'Nb licences',     defaultOn: false, align: 'right' },
  { key: 'panier_moyen',    label: 'Panier moyen',    defaultOn: false, align: 'right' },
  { key: 'abonnement',      label: 'Abonnement',      defaultOn: false, align: 'left'  },
  { key: 'premiere_action', label: '1ère action',     defaultOn: false, align: 'left'  },
  { key: 'derniere_action', label: 'Dernière action', defaultOn: false, align: 'left'  },
  { key: 'source',          label: 'Source',          defaultOn: false, align: 'left'  },
  { key: 'favoris',         label: 'Favoris',         defaultOn: false, align: 'right' },
  { key: 'free_dl',         label: 'Free DL',         defaultOn: false, align: 'right' },
  { key: 'socials',         label: 'Socials',         defaultOn: false, align: 'left'  },
  { key: 'prefs',           label: 'Préférences',     defaultOn: false, align: 'left'  },
]

const ALL_KEYS     = COLONNES.map(c => c.key)
const DEFAULT_KEYS = new Set(COLONNES.filter(c => c.defaultOn).map(c => c.key))
const LS_KEYS  = 'business_liste_colonnes'
const LS_ORDER = 'business_liste_colonnes_order'

function loadActiveKeys(): Set<string> {
  if (typeof window === 'undefined') return DEFAULT_KEYS
  try {
    const raw = localStorage.getItem(LS_KEYS)
    if (!raw) return DEFAULT_KEYS
    return new Set(JSON.parse(raw) as string[])
  } catch { return DEFAULT_KEYS }
}
function saveActiveKeys(keys: Set<string>) {
  try { localStorage.setItem(LS_KEYS, JSON.stringify([...keys])) } catch {}
}

function loadColOrder(): string[] {
  if (typeof window === 'undefined') return ALL_KEYS
  try {
    const raw = localStorage.getItem(LS_ORDER)
    if (!raw) return ALL_KEYS
    const saved = JSON.parse(raw) as string[]
    const knownSet = new Set(ALL_KEYS)
    const valid    = saved.filter(k => knownSet.has(k))
    const newCols  = ALL_KEYS.filter(k => !valid.includes(k))
    return [...valid, ...newCols]
  } catch { return ALL_KEYS }
}
function saveColOrder(order: string[]) {
  try { localStorage.setItem(LS_ORDER, JSON.stringify(order)) } catch {}
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

function joursDepuis(iso: string | null): number {
  if (!iso) return Infinity
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function scoreRF(nb_achats: number, dernier_achat_iso: string | null): { label: string; cls: string } {
  const frequent = nb_achats >= 3
  const recent   = dernier_achat_iso ? joursDepuis(dernier_achat_iso) <= 180 : false
  if (frequent && recent)  return { label: 'Régulier',    cls: 'bg-green-500/20 text-green-400'  }
  if (frequent && !recent) return { label: 'Fidèle',      cls: 'bg-indigo-500/20 text-indigo-400' }
  if (!frequent && recent) return { label: 'Occasionnel', cls: 'bg-amber-500/20 text-amber-400'  }
  return                          { label: 'Dormant',     cls: 'bg-gray-700/60 text-gray-500'    }
}

function scoreChaleur(m: MembreRow): { label: string; cls: string } {
  let score = 0
  if (m.lead_source === 'free_download') score += 40
  else if (m.lead_source === 'newsletter') score += 20
  else if (m.lead_source === 'visite')   score += 10
  score += m.lead_nb_favoris * 10
  if (m.newsletter_consent) score += 15
  if (score > 55) return { label: 'Chaud', cls: 'bg-red-500/20 text-red-400'    }
  if (score >= 25) return { label: 'Tiède', cls: 'bg-amber-500/20 text-amber-400' }
  return                  { label: 'Froid', cls: 'bg-gray-700/60 text-gray-500'  }
}

const STATUT_LABEL: Record<MembreRow['statut'], string> = {
  abonne: 'Abonné',
  ancien: 'Ancien abonné',
  client: 'Client',
  lead:   'Lead',
}
const STATUT_CLS: Record<MembreRow['statut'], string> = {
  abonne: 'bg-indigo-500/20 text-indigo-400',
  ancien: 'bg-gray-700/60 text-gray-500',
  client: 'bg-green-500/20 text-green-400',
  lead:   'bg-amber-500/20 text-amber-400',
}

const STATUT_ABO_LABEL: Record<string, string> = {
  actif:                'Actif',
  impaye:               'Impayé',
  annulation_en_cours:  'Annulation...',
  annule:               'Annulé',
}

function renderCell(key: string, m: MembreRow): React.ReactNode {
  switch (key) {
    case 'statut':
      return (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUT_CLS[m.statut]}`}>
          {STATUT_LABEL[m.statut]}
        </span>
      )
    case 'score': {
      const s = m.statut !== 'lead' ? scoreRF(m.nb_achats, m.dernier_achat_iso) : scoreChaleur(m)
      return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${s.cls}`}>{s.label}</span>
    }
    case 'newsletter':
      return m.newsletter_consent
        ? <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-500">Newsletter</span>
        : <span className="text-gray-700 text-xs">—</span>
    case 'ltv':
      return <span className="text-xs font-semibold text-white">{fmt(m.ltv)}</span>
    case 'dernier_achat':
      return <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(m.dernier_achat_iso)}</span>
    case 'nb_licences':
      return <span className="text-xs text-gray-300">{m.nb_achats > 0 ? m.nb_achats : '—'}</span>
    case 'panier_moyen':
      return <span className="text-xs text-gray-300">{m.panier_moyen > 0 ? fmt(m.panier_moyen) : '—'}</span>
    case 'abonnement':
      return m.statut_abo_detail
        ? <span className="text-xs text-gray-300">{STATUT_ABO_LABEL[m.statut_abo_detail] ?? m.statut_abo_detail}</span>
        : <span className="text-gray-700 text-xs">—</span>
    case 'premiere_action':
      return <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(m.premiere_contact_iso)}</span>
    case 'derniere_action':
      return <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(m.dernier_contact_iso)}</span>
    case 'source':
      return <span className="text-xs text-gray-300">{m.lead_source ?? <span className="text-gray-700">—</span>}</span>
    case 'favoris':
      return <span className="text-xs text-gray-300">{m.lead_nb_favoris > 0 ? m.lead_nb_favoris : <span className="text-gray-700">—</span>}</span>
    case 'free_dl':
      return <span className="text-xs text-gray-300">{m.lead_nb_free_dl > 0 ? m.lead_nb_free_dl : <span className="text-gray-700">—</span>}</span>
    case 'socials':
      return (
        <div className="flex items-center gap-1.5">
          <SocialIcon platform="instagram" value={m.instagram} size={14} />
          <SocialIcon platform="spotify"   value={m.spotify}   size={14} />
          <SocialIcon platform="youtube"   value={m.youtube}   size={14} />
          <SocialIcon platform="tiktok"    value={m.tiktok}    size={14} />
          <SocialIcon platform="whatsapp"  value={m.telephone} size={14} />
        </div>
      )
    case 'prefs': {
      const prefs = [m.pref_style, m.pref_type_beat, m.pref_ambiance].filter(Boolean)
      return prefs.length > 0
        ? <span className="text-xs text-gray-400">{prefs.join(' · ')}</span>
        : <span className="text-gray-700 text-xs">—</span>
    }
    default:
      return null
  }
}

// ── Sélecteur de colonnes (visibilité uniquement) ────────────────────────────

const COL_BY_KEY = new Map(COLONNES.map(c => [c.key, c]))

function ColonnePicker({
  activeKeys,
  colOrder,
  onToggle,
}: {
  activeKeys: Set<string>
  colOrder: string[]
  onToggle: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors border ${
          open
            ? 'bg-gray-700 border-gray-600 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm6 4.25a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 8 12.25Z" clipRule="evenodd" />
        </svg>
        Colonnes
        <span className="text-[10px] text-gray-500">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-40 w-52 overflow-hidden">
          <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            Colonnes visibles
          </p>
          <div className="p-1 pb-2">
            {colOrder.map(key => {
              const col = COL_BY_KEY.get(key)
              if (!col) return null
              return (
                <label
                  key={key}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer hover:bg-gray-800 transition-colors group"
                >
                  <div
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      activeKeys.has(key) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'
                    }`}
                  >
                    {activeKeys.has(key) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-2.5 h-2.5">
                        <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" checked={activeKeys.has(key)} onChange={() => onToggle(key)} className="sr-only" />
                  <span className="text-xs text-gray-400 group-hover:text-white transition-colors">{col.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
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
                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                  {c.pays
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                    : <span className="text-indigo-300 font-bold text-[10px]">{initiales(c.label, c.nom)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{c.label} {c.nom}</p>
                  <p className="text-[10px] text-gray-600 truncate">{c.email}</p>
                </div>
                <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  selected.has(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-600'
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

        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500">
            {selected.size > 0 ? `${selected.size} sélectionné${selected.size > 1 ? 's' : ''}` : 'Aucune sélection'}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors">
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

type Props = {
  liste: { id: string; nom: string; description: string | null }
  membres: MembreRow[]
  tousContacts: ContactLight[]
  ajouterContacts: (fd: FormData) => Promise<void>
  retirerContact: (fd: FormData) => Promise<void>
}

export default function ListeDetailClient({
  liste,
  membres,
  tousContacts,
  ajouterContacts,
  retirerContact,
}: Props) {
  const [showModal,     setShowModal]     = useState(false)
  const [activeKeys,    setActiveKeys]    = useState<Set<string>>(DEFAULT_KEYS)
  const [colOrder,      setColOrder]      = useState<string[]>(ALL_KEYS)
  const [draggingKey,   setDraggingKey]   = useState<string | null>(null)
  const [dragOverKey,   setDragOverKey]   = useState<string | null>(null)
  const dragIdx = useRef<number | null>(null)

  // Hydrate depuis localStorage après montage
  useEffect(() => {
    setActiveKeys(loadActiveKeys())
    setColOrder(loadColOrder())
  }, [])

  function toggleCol(key: string) {
    setActiveKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      saveActiveKeys(next)
      return next
    })
  }

  function reorderCols(order: string[]) {
    setColOrder(order)
    saveColOrder(order)
  }

  // ── Drag & drop sur les headers de colonne ──────────────────────────────────
  function onColDragStart(key: string) {
    dragIdx.current = colOrder.indexOf(key)
    setDraggingKey(key)
  }
  function onColDragOver(e: React.DragEvent, key: string) {
    e.preventDefault()
    setDragOverKey(key)
    const from = dragIdx.current
    if (from === null) return
    const to = colOrder.indexOf(key)
    if (from === to) return
    const next = [...colOrder]
    const [removed] = next.splice(from, 1)
    next.splice(to, 0, removed)
    dragIdx.current = to
    reorderCols(next)
  }
  function onColDragEnd() {
    dragIdx.current = null
    setDraggingKey(null)
    setDragOverKey(null)
  }

  const colsActives = colOrder
    .map(key => COL_BY_KEY.get(key))
    .filter((c): c is ColDef => !!c && activeKeys.has(c.key))

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
              <ColonnePicker
                activeKeys={activeKeys}
                colOrder={colOrder}
                onToggle={toggleCol}
              />

              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-semibold text-white transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                  <path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" />
                </svg>
                Ajouter des contacts
              </button>

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
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-950 z-10">
                    Contact
                  </th>
                  {colsActives.map(col => (
                    <th
                      key={col.key}
                      draggable
                      onDragStart={() => onColDragStart(col.key)}
                      onDragOver={(e) => onColDragOver(e, col.key)}
                      onDragEnd={onColDragEnd}
                      className={[
                        'px-4 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap select-none transition-all',
                        col.align === 'right' ? 'text-right' : 'text-left',
                        draggingKey === col.key
                          ? 'opacity-30 cursor-grabbing text-gray-500'
                          : 'cursor-grab text-gray-500 hover:text-gray-300',
                        dragOverKey === col.key && draggingKey !== col.key
                          ? 'border-l-2 border-indigo-500'
                          : '',
                      ].join(' ')}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="w-16" />
                </tr>
              </thead>
              <tbody>
                {membres.map(m => (
                  <tr key={m.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 transition-colors group">

                    {/* Contact — fixe */}
                    <td className="px-6 py-3 sticky left-0 bg-gray-950 group-hover:bg-gray-800/40 transition-colors z-10">
                      <Link href={`/dashboard/business/contacts/${m.id}`} className="flex items-center gap-3 group/link">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center flex-shrink-0">
                          {m.pays
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={`https://flagcdn.com/w40/${m.pays.toLowerCase()}.png`} alt={m.pays} className="w-full h-full object-cover" />
                            : <span className="text-indigo-300 font-bold text-xs">{initiales(m.label, m.nom)}</span>
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white group-hover/link:text-indigo-300 transition-colors text-xs whitespace-nowrap">
                            {m.label} {m.nom}
                          </p>
                          <p className="text-[10px] text-gray-600 truncate max-w-[160px]">{m.email}</p>
                        </div>
                      </Link>
                    </td>

                    {/* Colonnes dynamiques */}
                    {colsActives.map(col => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : ''}`}
                      >
                        {renderCell(col.key, m)}
                      </td>
                    ))}

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
