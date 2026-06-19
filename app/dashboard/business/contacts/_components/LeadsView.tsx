'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────

export type LeadRow = {
  id: string
  prenom: string | null
  nom: string | null
  pays: string | null
  newsletter_consent: boolean
  source: string          // 'visite' | 'newsletter' | 'free_download' | 'achat'
  lead_created_at: string // = 1ère action
  derniere_action_at: string
  derniere_action_type: string
  nb_favoris: number
  nb_free_downloads: number
  pref_style: string | null
  pref_type_beat: string | null
  pref_ambiance: string | null
}

// ── Score chaleur ──────────────────────────────────────────────────────────────

function scoreChaleur(l: LeadRow): { score: number; label: 'Chaud' | 'Tiède' | 'Froid'; cls: string } {
  let score = 0
  if (l.source === 'free_download') score += 40
  else if (l.source === 'newsletter') score += 20
  else if (l.source === 'visite')   score += 10
  score += l.nb_favoris * 10
  if (l.newsletter_consent) score += 15
  const label: 'Chaud' | 'Tiède' | 'Froid' = score > 55 ? 'Chaud' : score >= 25 ? 'Tiède' : 'Froid'
  const cls = score > 55
    ? 'bg-red-500/20 text-red-400'
    : score >= 25
    ? 'bg-amber-500/20 text-amber-400'
    : 'bg-gray-700/60 text-gray-500'
  return { score, label, cls }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initiales(prenom: string | null, nom: string | null) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?'
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

function dateRel(iso: string): string {
  const j = daysAgo(iso)
  if (j === 0) return "Aujourd'hui"
  if (j === 1) return 'Hier'
  if (j < 7)   return `Il y a ${j}j`
  if (j < 30)  return `Il y a ${Math.floor(j / 7)} sem`
  if (j < 365) return `Il y a ${Math.floor(j / 30)} mois`
  const a = Math.floor(j / 365)
  return `Il y a ${a} an${a > 1 ? 's' : ''}`
}

function sourceLabel(source: string): string {
  if (source === 'free_download') return 'Free download'
  if (source === 'newsletter')   return 'Inscription NWT'
  if (source === 'visite')       return 'Compte créé'
  if (source === 'achat')        return 'Achat'
  if (source === 'manuel')       return 'Ajout manuel'
  return source
}

function toDays(val: number, unite: string): number {
  if (unite === 'jours')    return val
  if (unite === 'semaines') return val * 7
  if (unite === 'mois')     return val * 30
  return val * 365
}

function compareSigne(val: number, signe: string, ref: number): boolean {
  switch (signe) {
    case '=':  return val === ref
    case '>':  return val > ref
    case '<':  return val < ref
    case '>=': return val >= ref
    case '<=': return val <= ref
    default:   return true
  }
}

function topOf(vals: (string | null)[]) {
  const nonNull = vals.filter(Boolean) as string[]
  const counts: Record<string, number> = {}
  for (const v of nonNull) counts[v] = (counts[v] ?? 0) + 1
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? { value: top[0], count: top[1], total: nonNull.length } : { value: '—', count: 0, total: 0 }
}

// ── Composant ──────────────────────────────────────────────────────────────────

export default function LeadsView({
  leads,
  listes,
}: {
  leads: LeadRow[]
  listes: { id: string; nom: string; nb: number }[]
}) {
  const [selected,          setSelected]          = useState<Set<string>>(new Set())
  const [filtreChaleur,     setFiltreChaleur]     = useState<'Chaud' | 'Tiède' | 'Froid' | ''>('')
  const [filtreSearch,      setFiltreSearch]      = useState('')
  const [filtreNewsletter,  setFiltreNewsletter]  = useState('')
  const [filtreFreeDLSigne, setFiltreFreeDLSigne] = useState('>=')
  const [filtreFreeDLVal,   setFiltreFreeDLVal]   = useState('')
  const [filtreFavSigne,    setFiltreFavSigne]    = useState('>=')
  const [filtreFavVal,      setFiltreFavVal]      = useState('')
  const [filtrePremierSigne,  setFiltrePremierSigne]  = useState('>')
  const [filtrePremierVal,    setFiltrePremierVal]    = useState('')
  const [filtrePremierUnite,  setFiltrePremierUnite]  = useState('mois')
  const [filtreStyle,     setFiltreStyle]     = useState('')
  const [filtreTypeBeat,  setFiltreTypeBeat]  = useState('')
  const [filtreAmbiance,  setFiltreAmbiance]  = useState('')

  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const refContact = useRef<HTMLDivElement>(null)
  const refPremier = useRef<HTMLDivElement>(null)
  const refFreeDL  = useRef<HTMLDivElement>(null)
  const refFavoris = useRef<HTMLDivElement>(null)
  const refPrefs   = useRef<HTMLDivElement>(null)

  const [showListeModal, setShowListeModal] = useState(false)
  const [nomListe,   setNomListe]   = useState('')
  const [descListe,  setDescListe]  = useState('')
  const [listeCreee, setListeCreee] = useState(false)
  const [savingListe, setSavingListe] = useState(false)
  const [listeError,  setListeError]  = useState<string | null>(null)

  useEffect(() => {
    if (!openPopover) return
    const zones = [refContact, refPremier, refFreeDL, refFavoris, refPrefs]
    function handleClick(e: MouseEvent) {
      if (!zones.some(r => r.current?.contains(e.target as Node))) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openPopover])

  const styles    = useMemo(() => [...new Set(leads.map(l => l.pref_style).filter(Boolean) as string[])].sort(), [leads])
  const typeBeats = useMemo(() => [...new Set(leads.map(l => l.pref_type_beat).filter(Boolean) as string[])].sort(), [leads])
  const ambiances = useMemo(() => [...new Set(leads.map(l => l.pref_ambiance).filter(Boolean) as string[])].sort(), [leads])

  const hasFilterContact = filtreNewsletter !== '' || filtreChaleur !== ''
  const hasFilterFreeDL  = filtreFreeDLVal !== ''
  const hasFilterFav     = filtreFavVal !== ''
  const hasFilterPremier = filtrePremierVal !== ''
  const hasFilterPrefs   = filtreStyle !== '' || filtreTypeBeat !== '' || filtreAmbiance !== ''
  const hasAnyFilter     = filtreChaleur !== '' || filtreSearch !== '' || filtreNewsletter !== '' ||
                           hasFilterFreeDL || hasFilterFav || hasFilterPremier || hasFilterPrefs

  function resetAll() {
    setFiltreChaleur(''); setFiltreSearch(''); setFiltreNewsletter('')
    setFiltreFreeDLVal(''); setFiltreFreeDLSigne('>=')
    setFiltreFavVal(''); setFiltreFavSigne('>=')
    setFiltrePremierVal(''); setFiltrePremierSigne('>'); setFiltrePremierUnite('mois')
    setFiltreStyle(''); setFiltreTypeBeat(''); setFiltreAmbiance('')
  }

  function togglePopover(key: string) { setOpenPopover(p => p === key ? null : key) }

  const displayed = useMemo(() => leads.filter(l => {
    const chaleur = scoreChaleur(l)
    if (filtreSearch && !(l.prenom + ' ' + l.nom).toLowerCase().includes(filtreSearch.toLowerCase())) return false
    if (filtreChaleur && chaleur.label !== filtreChaleur) return false
    if (filtreNewsletter === 'inscrit' && !l.newsletter_consent) return false
    if (filtreNewsletter === 'non'     &&  l.newsletter_consent) return false
    if (filtreFreeDLVal !== '') {
      const ref = parseInt(filtreFreeDLVal)
      if (!isNaN(ref) && !compareSigne(l.nb_free_downloads, filtreFreeDLSigne, ref)) return false
    }
    if (filtreFavVal !== '') {
      const ref = parseInt(filtreFavVal)
      if (!isNaN(ref) && !compareSigne(l.nb_favoris, filtreFavSigne, ref)) return false
    }
    if (filtrePremierVal !== '') {
      const ref = parseInt(filtrePremierVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtrePremierUnite)
        const valDays = daysAgo(l.lead_created_at)
        if (!compareSigne(valDays, filtrePremierSigne, refDays)) return false
      }
    }
    if (filtreStyle    && l.pref_style    !== filtreStyle)    return false
    if (filtreTypeBeat && l.pref_type_beat !== filtreTypeBeat) return false
    if (filtreAmbiance && l.pref_ambiance !== filtreAmbiance) return false
    return true
  }).sort((a, b) => scoreChaleur(b).score - scoreChaleur(a).score),
  [leads, filtreSearch, filtreChaleur, filtreNewsletter, filtreFreeDLVal, filtreFreeDLSigne,
   filtreFavVal, filtreFavSigne, filtrePremierVal, filtrePremierSigne, filtrePremierUnite,
   filtreStyle, filtreTypeBeat, filtreAmbiance])

  // KPI counts
  const nbFavoris    = displayed.filter(l => l.nb_favoris > 0).length
  const nbNewsletter = displayed.filter(l => l.newsletter_consent).length
  const nbVisite     = displayed.filter(l => l.source === 'visite').length
  const nbFreeDL     = displayed.filter(l => l.source === 'free_download').length
  const nbChauds     = displayed.filter(l => scoreChaleur(l).label === 'Chaud').length
  const nbTiedes     = displayed.filter(l => scoreChaleur(l).label === 'Tiède').length
  const nbFroids     = displayed.filter(l => scoreChaleur(l).label === 'Froid').length
  const topStyle     = topOf(displayed.map(l => l.pref_style))
  const topTypeBeat  = topOf(displayed.map(l => l.pref_type_beat))
  const topAmbiance  = topOf(displayed.map(l => l.pref_ambiance))

  const allSelected  = displayed.length > 0 && displayed.every(l => selected.has(l.id))
  function toggleAll() {
    if (allSelected) setSelected(prev => { const s = new Set(prev); displayed.forEach(l => s.delete(l.id)); return s })
    else             setSelected(prev => { const s = new Set(prev); displayed.forEach(l => s.add(l.id));    return s })
  }
  function toggle(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }
  async function creerListe() {
    if (!nomListe.trim()) return
    setSavingListe(true)
    setListeError(null)
    try {
      const res = await fetch('/api/business/listes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom: nomListe, description: descListe, client_ids: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) { setListeError(data.erreur ?? 'Erreur'); setSavingListe(false); return }
      setListeCreee(true)
      setTimeout(() => { setShowListeModal(false); setListeCreee(false); setNomListe(''); setDescListe(''); setSelected(new Set()); setSavingListe(false) }, 1500)
    } catch {
      setListeError('Erreur réseau')
      setSavingListe(false)
    }
  }

  async function ajouterAListe(listeId: string) {
    setSavingListe(true)
    setListeError(null)
    try {
      const res = await fetch(`/api/business/listes/${listeId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_ids: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) { setListeError(data.erreur ?? 'Erreur'); setSavingListe(false); return }
      setListeCreee(true)
      setTimeout(() => { setShowListeModal(false); setListeCreee(false); setSelected(new Set()); setSavingListe(false) }, 1500)
    } catch {
      setListeError('Erreur réseau')
      setSavingListe(false)
    }
  }

  // Style helpers
  const hBtn = (active: boolean) =>
    `flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer whitespace-nowrap ${active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`
  const popoverBase = `absolute top-full mt-1 bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-2xl z-30`
  const sel2 = `text-xs bg-gray-800 text-gray-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer border border-gray-700 focus:border-indigo-500`
  const numInput = `w-20 text-xs bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-indigo-500 outline-none [appearance:textfield]`
  const clearBtn = `text-xs text-gray-600 hover:text-white transition-colors mt-2 block`
  const dot = <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 ml-0.5" />
  const chevron = <span className="text-[9px] text-gray-700 ml-0.5">▾</span>

  const signPopover = (
    signe: string, setSigne: (v: string) => void,
    val: string, setVal: (v: string) => void,
    placeholder: string
  ) => (
    <div className="flex items-center gap-2">
      <select value={signe} onChange={e => setSigne(e.target.value)} className={sel2}>
        <option value="=">=</option>
        <option value=">">&gt;</option>
        <option value="<">&lt;</option>
        <option value=">=">&ge;</option>
        <option value="<=">&le;</option>
      </select>
      <input type="number" min="0" value={val} onChange={e => setVal(e.target.value)} placeholder={placeholder} className={numInput} />
    </div>
  )

  const datePopover = (
    signe: string, setSigne: (v: string) => void,
    val: string, setVal: (v: string) => void,
    unite: string, setUnite: (v: string) => void
  ) => (
    <>
      <p className="text-xs text-gray-500 mb-2">Il y a…</p>
      <div className="flex items-center gap-2">
        <select value={signe} onChange={e => setSigne(e.target.value)} className={sel2}>
          <option value=">">&gt;</option>
          <option value="<">&lt;</option>
          <option value="=">=</option>
          <option value=">=">&ge;</option>
          <option value="<=">&le;</option>
        </select>
        <input type="number" min="1" value={val} onChange={e => setVal(e.target.value)} placeholder="3" className={numInput} />
        <select value={unite} onChange={e => setUnite(e.target.value)} className={sel2}>
          <option value="jours">jours</option>
          <option value="semaines">sem.</option>
          <option value="mois">mois</option>
          <option value="années">ans</option>
        </select>
      </div>
    </>
  )

  return (
    <>
      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">

        {/* Bloc gauche — aperçu + signaux */}
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-end gap-3 mb-5">
            <span className="text-4xl font-black text-white">{displayed.length}</span>
            <span className="text-sm text-gray-500 mb-0.5">lead{displayed.length !== 1 ? 's' : ''}</span>
            {hasAnyFilter
              ? <span className="text-xs text-gray-600 mb-0.5">sur {leads.length} au total</span>
              : <span className="text-sm font-semibold text-red-400 mb-0.5 ml-1">{nbChauds} chaud{nbChauds !== 1 ? 's' : ''}</span>
            }
          </div>
          <div className="grid grid-cols-4 gap-6 pt-5 border-t border-gray-800">
            {[
              { label: 'Free downloads', count: nbFreeDL,    sub: 'signal fort'   },
              { label: 'Favoris',        count: nbFavoris,   sub: 'signal fort'   },
              { label: 'Newsletter',     count: nbNewsletter, sub: 'contactables' },
              { label: 'Visites',        count: nbVisite,    sub: 'compte créé'   },
            ].map(({ label, count, sub }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-black text-white">{count}</p>
                <p className="text-xs text-gray-700 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bloc droit — chaleur + préférences */}
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Chaud', count: nbChauds, cls: 'text-red-400'   },
              { label: 'Tiède', count: nbTiedes, cls: 'text-amber-400' },
              { label: 'Froid', count: nbFroids, cls: 'text-gray-500'  },
            ].map(({ label, count, cls }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-black ${cls}`}>{count}</span>
                  <span className="text-xs text-gray-600 w-8 text-right">
                    {displayed.length > 0 ? Math.round(count / displayed.length * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-800" />
          <div>
            <p className="text-xs text-gray-500 mb-2">Préférences top</p>
            <div className="flex flex-col gap-1.5">
              {[
                { top: topStyle,    label: 'style'     },
                { top: topTypeBeat, label: 'type beat' },
                { top: topAmbiance, label: 'ambiance'  },
              ].map(({ top, label }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white truncate">{top.value}</span>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                    <span className="text-lg font-black text-white">{top.count}</span>
                    <span className="text-xs text-gray-600 w-8 text-right">
                      {top.total > 0 ? Math.round(top.count / top.total * 100) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">

        {/* Barre action */}
        <div className="px-5 py-2.5 border-b border-gray-800 flex items-center gap-3 min-h-[44px]">
          <div className="relative flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">⌕</span>
            <input
              type="text"
              value={filtreSearch}
              onChange={e => setFiltreSearch(e.target.value)}
              placeholder="Rechercher…"
              className="w-48 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-white">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
                <button
                  onClick={() => setShowListeModal(true)}
                  className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
                >
                  + Ajouter à une liste
                </button>
                {hasAnyFilter && <button onClick={resetAll} className="text-xs text-gray-600 hover:text-white transition-colors">Réinitialiser</button>}
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white transition-colors">Annuler</button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-600">{displayed.length} lead{displayed.length !== 1 ? 's' : ''}</span>
                {hasAnyFilter && <button onClick={resetAll} className="text-xs text-gray-600 hover:text-white transition-colors">Réinitialiser</button>}
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-800">

                <th className="px-5 py-3 w-10">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer" />
                </th>

                {/* Contact */}
                <th className="text-left px-3 py-3">
                  <div ref={refContact} className="relative inline-block">
                    <button onClick={() => togglePopover('contact')} className={hBtn(hasFilterContact)}>
                      Contact {hasFilterContact && dot} {chevron}
                    </button>
                    {openPopover === 'contact' && (
                      <div className={`${popoverBase} left-0 min-w-[180px] flex flex-col gap-2`}>
                        <select value={filtreChaleur} onChange={e => setFiltreChaleur(e.target.value as typeof filtreChaleur)} className={`${sel2} w-full`}>
                          <option value="">Chaleur — tous</option>
                          <option value="Chaud">Chaud</option>
                          <option value="Tiède">Tiède</option>
                          <option value="Froid">Froid</option>
                        </select>
                        <select value={filtreNewsletter} onChange={e => setFiltreNewsletter(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Newsletter — tous</option>
                          <option value="inscrit">Inscrit</option>
                          <option value="non">Non inscrit</option>
                        </select>
                        {hasFilterContact && <button onClick={() => { setFiltreChaleur(''); setFiltreNewsletter('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* 1ère action */}
                <th className="text-left px-3 py-3">
                  <div ref={refPremier} className="relative inline-block">
                    <button onClick={() => togglePopover('premier')} className={hBtn(hasFilterPremier)}>
                      1ère action {hasFilterPremier && dot} {chevron}
                    </button>
                    {openPopover === 'premier' && (
                      <div className={`${popoverBase} left-0 min-w-[230px]`}>
                        {datePopover(filtrePremierSigne, setFiltrePremierSigne, filtrePremierVal, setFiltrePremierVal, filtrePremierUnite, setFiltrePremierUnite)}
                        {hasFilterPremier && <button onClick={() => setFiltrePremierVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Dernière action */}
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  Dernière action
                </th>

                {/* Free DL */}
                <th className="text-right px-3 py-3">
                  <div ref={refFreeDL} className="relative inline-flex justify-end">
                    <button onClick={() => togglePopover('freedl')} className={hBtn(hasFilterFreeDL)}>
                      Free DL {hasFilterFreeDL && dot} {chevron}
                    </button>
                    {openPopover === 'freedl' && (
                      <div className={`${popoverBase} right-0`}>
                        {signPopover(filtreFreeDLSigne, setFiltreFreeDLSigne, filtreFreeDLVal, setFiltreFreeDLVal, 'ex : 1')}
                        {hasFilterFreeDL && <button onClick={() => setFiltreFreeDLVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Favoris */}
                <th className="text-right px-3 py-3">
                  <div ref={refFavoris} className="relative inline-flex justify-end">
                    <button onClick={() => togglePopover('favoris')} className={hBtn(hasFilterFav)}>
                      Favoris {hasFilterFav && dot} {chevron}
                    </button>
                    {openPopover === 'favoris' && (
                      <div className={`${popoverBase} right-0`}>
                        {signPopover(filtreFavSigne, setFiltreFavSigne, filtreFavVal, setFiltreFavVal, 'ex : 1')}
                        {hasFilterFav && <button onClick={() => setFiltreFavVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Préférences */}
                <th className="text-left px-3 py-3">
                  <div ref={refPrefs} className="relative inline-block">
                    <button onClick={() => togglePopover('prefs')} className={hBtn(hasFilterPrefs)}>
                      Préférences {hasFilterPrefs && dot} {chevron}
                    </button>
                    {openPopover === 'prefs' && (
                      <div className={`${popoverBase} left-0 min-w-[180px] flex flex-col gap-2`}>
                        {[
                          { label: 'Style',     value: filtreStyle,    set: setFiltreStyle,    opts: styles },
                          { label: 'Type beat', value: filtreTypeBeat, set: setFiltreTypeBeat, opts: typeBeats },
                          { label: 'Ambiance',  value: filtreAmbiance, set: setFiltreAmbiance, opts: ambiances },
                        ].map(({ label, value, set, opts }) => (
                          <select key={label} value={value} onChange={e => set(e.target.value)} className={`${sel2} w-full ${value ? 'text-white ring-1 ring-indigo-500/50' : ''}`}>
                            <option value="">{label} — tous</option>
                            {opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ))}
                        {hasFilterPrefs && <button onClick={() => { setFiltreStyle(''); setFiltreTypeBeat(''); setFiltreAmbiance('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(l => {
                const chaleur = scoreChaleur(l)
                const sel     = selected.has(l.id)
                return (
                  <tr key={l.id} className={`border-b border-gray-800 last:border-0 transition-colors ${sel ? 'bg-indigo-950/30' : 'hover:bg-gray-800/40'}`}>
                    <td className="px-5 py-3 text-center">
                      <input type="checkbox" checked={sel} onChange={() => toggle(l.id)} className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/business/contacts/${l.id}`} className="flex items-center gap-3 group">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                            {l.pays
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={`https://flagcdn.com/w40/${l.pays.toLowerCase()}.png`} alt={l.pays} className="w-full h-full object-cover" />
                              : <span className="text-indigo-300 font-bold text-xs">{initiales(l.prenom, l.nom)}</span>
                            }
                          </div>
                          {l.newsletter_consent
                            ? <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-950" />
                            : <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-gray-600 border-2 border-gray-950" />
                          }
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                              {l.prenom} {l.nom}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${chaleur.cls}`}>
                              {chaleur.label}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400 leading-none">{dateRel(l.lead_created_at)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{sourceLabel(l.source)}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400 leading-none">{dateRel(l.derniere_action_at)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{l.derniere_action_type}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {l.nb_free_downloads > 0
                        ? <span className="font-semibold text-green-400">{l.nb_free_downloads}</span>
                        : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {l.nb_favoris > 0
                        ? <span className="font-semibold text-pink-400">{l.nb_favoris}</span>
                        : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400">
                      {[l.pref_style, l.pref_type_beat, l.pref_ambiance].filter(Boolean).join(' · ') || <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link href={`/dashboard/business/contacts/${l.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">→</Link>
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-600 text-sm">
                    Aucun lead ne correspond à ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal créer une liste ── */}
      {showListeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowListeModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            {listeCreee ? (
              <div className="text-center py-4">
                <p className="text-green-400 font-semibold text-sm">Contacts ajoutés ✓</p>
                <p className="text-gray-500 text-xs mt-1">{selected.size} lead{selected.size > 1 ? 's' : ''} ajouté{selected.size > 1 ? 's' : ''}</p>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-white mb-1">Ajouter à une liste</h2>
                <p className="text-xs text-gray-500 mb-4">{selected.size} lead{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</p>

                {listes.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Listes existantes</p>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-auto">
                      {listes.map(l => (
                        <button
                          key={l.id}
                          onClick={() => ajouterAListe(l.id)}
                          disabled={savingListe}
                          className="text-left text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 transition-colors flex items-center justify-between"
                        >
                          <span>{l.nom}</span>
                          <span className="text-gray-600">{l.nb} contacts</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500 mb-2">{listes.length > 0 ? 'Ou créer une nouvelle liste' : 'Créer une liste'}</p>
                <div className="space-y-3">
                  <input autoFocus type="text" value={nomListe} onChange={e => setNomListe(e.target.value)} placeholder="Nom de la liste…"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                  <input type="text" value={descListe} onChange={e => setDescListe(e.target.value)} placeholder="Description (optionnel)"
                    className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                </div>
                {listeError && <p className="text-red-400 text-xs mt-2">{listeError}</p>}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={creerListe}
                    disabled={!nomListe.trim() || savingListe}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors"
                  >
                    {savingListe ? 'Création…' : 'Créer la liste'}
                  </button>
                  <button onClick={() => { setShowListeModal(false); setNomListe(''); setDescListe(''); setListeError(null) }} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors">
                    Annuler
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
