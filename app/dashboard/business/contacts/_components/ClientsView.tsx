'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ContactRow } from './ContactsClient'
import { joursDepuis } from '../../_lib/utils'

function initiales(prenom: string | null, nom: string | null) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?'
}

function scoreRF(nb_achats: number, dernier_achat_iso: string | null): { label: string; cls: string } {
  const frequent = nb_achats >= 3
  const recent   = dernier_achat_iso ? joursDepuis(dernier_achat_iso) <= 180 : false
  if (frequent && recent)  return { label: 'Régulier',    cls: 'bg-green-500/20 text-green-400'  }
  if (frequent && !recent) return { label: 'Fidèle',      cls: 'bg-indigo-500/20 text-indigo-400' }
  if (!frequent && recent) return { label: 'Occasionnel', cls: 'bg-amber-500/20 text-amber-400'  }
  return                          { label: 'Dormant',     cls: 'bg-gray-700/60 text-gray-500'    }
}

function fmt(euros: number | null): string {
  if (euros === null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(euros)
}

function topOf(vals: (string | null)[]): { value: string; count: number; total: number } {
  const nonNull = vals.filter(Boolean) as string[]
  const counts: Record<string, number> = {}
  for (const v of nonNull) counts[v] = (counts[v] ?? 0) + 1
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? { value: top[0], count: top[1], total: nonNull.length } : { value: '—', count: 0, total: 0 }
}

function dateRel(iso: string | null): string {
  if (!iso) return '—'
  const j = joursDepuis(iso)
  if (j === 0) return 'Auj.'
  if (j === 1) return 'Hier'
  if (j < 7)   return `${j}j`
  if (j < 30)  return `${Math.floor(j / 7)} sem`
  if (j < 365) return `${Math.floor(j / 30)} mois`
  const a = Math.floor(j / 365)
  return `${a} an${a > 1 ? 's' : ''}`
}

function compareSigne(val: number, signe: string, ref: number): boolean {
  if (signe === '=')  return val === ref
  if (signe === '>')  return val > ref
  if (signe === '<')  return val < ref
  if (signe === '>=') return val >= ref
  if (signe === '<=') return val <= ref
  return true
}

function toDays(val: number, unite: string): number {
  if (unite === 'jours')    return val
  if (unite === 'semaines') return val * 7
  if (unite === 'mois')     return val * 30
  return val * 365
}

export default function ClientsView({
  clients,
  listes,
}: {
  clients: ContactRow[]
  listes: { id: string; nom: string; nb: number }[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [filtreSearch,         setFiltreSearch]         = useState('')
  const [filtreFidelite,       setFiltreFidelite]       = useState('')
  const [filtreNewsletter,     setFiltreNewsletter]     = useState('')
  const [filtreAbo,            setFiltreAbo]            = useState('')
  const [filtreStyle,          setFiltreStyle]          = useState('')
  const [filtreTypeBeat,       setFiltreTypeBeat]       = useState('')
  const [filtreLicence,        setFiltreLicence]        = useState('')
  const [filtreCommandesSigne, setFiltreCommandesSigne] = useState('=')
  const [filtreCommandesVal,   setFiltreCommandesVal]   = useState('')
  const [filtrePanierSigne,    setFiltrePanierSigne]    = useState('=')
  const [filtrePanierVal,      setFiltrePanierVal]      = useState('')
  const [filtreLtvSigne,       setFiltreLtvSigne]       = useState('=')
  const [filtreLtvVal,         setFiltreLtvVal]         = useState('')
  const [filtreLastSigne,      setFiltreLastSigne]      = useState('>')
  const [filtreLastVal,        setFiltreLastVal]         = useState('')
  const [filtreLastUnite,      setFiltreLastUnite]      = useState('mois')

  const [openPopover,   setOpenPopover]   = useState<string | null>(null)
  const [showListeModal, setShowListeModal] = useState(false)
  const [nomListe,      setNomListe]      = useState('')
  const [descListe,     setDescListe]     = useState('')
  const [listeCreee,    setListeCreee]    = useState(false)
  const [savingListe,   setSavingListe]   = useState(false)
  const [listeError,    setListeError]    = useState<string | null>(null)

  const refContact   = useRef<HTMLDivElement>(null)
  const refAbo       = useRef<HTMLDivElement>(null)
  const refPrefs     = useRef<HTMLDivElement>(null)
  const refCommandes = useRef<HTMLDivElement>(null)
  const refPanier    = useRef<HTMLDivElement>(null)
  const refLtv       = useRef<HTMLDivElement>(null)
  const refLast      = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openPopover) return
    function handler(e: MouseEvent) {
      const refs = [refContact, refAbo, refPrefs, refCommandes, refPanier, refLtv, refLast]
      if (!refs.some(r => r.current?.contains(e.target as Node))) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPopover])

  const styles    = useMemo(() => [...new Set(clients.map(c => c.pref_style).filter(Boolean) as string[])].sort(), [clients])
  const typeBeats = useMemo(() => [...new Set(clients.map(c => c.pref_type_beat).filter(Boolean) as string[])].sort(), [clients])
  const licences  = useMemo(() => [...new Set(clients.map(c => c.pref_licence).filter(Boolean) as string[])].sort(), [clients])

  const hasFilterContact   = filtreFidelite !== '' || filtreNewsletter !== ''
  const hasFilterAbo       = filtreAbo !== ''
  const hasFilterPrefs     = filtreStyle !== '' || filtreTypeBeat !== '' || filtreLicence !== ''
  const hasFilterCommandes = filtreCommandesVal !== ''
  const hasFilterPanier    = filtrePanierVal !== ''
  const hasFilterLtv       = filtreLtvVal !== ''
  const hasFilterLast      = filtreLastVal !== ''
  const hasAnyFilter = hasFilterContact || hasFilterAbo || hasFilterPrefs || hasFilterCommandes || hasFilterPanier || hasFilterLtv || hasFilterLast || filtreSearch !== ''

  function resetAll() {
    setFiltreSearch(''); setFiltreFidelite(''); setFiltreNewsletter('')
    setFiltreAbo(''); setFiltreStyle(''); setFiltreTypeBeat(''); setFiltreLicence('')
    setFiltreCommandesVal(''); setFiltreCommandesSigne('=')
    setFiltrePanierVal(''); setFiltrePanierSigne('=')
    setFiltreLtvVal(''); setFiltreLtvSigne('=')
    setFiltreLastVal(''); setFiltreLastSigne('>'); setFiltreLastUnite('mois')
  }

  const displayed = useMemo(() => clients.filter(c => {
    const rf = scoreRF(c.nb_achats, c.dernier_achat_iso)
    if (filtreSearch && !`${c.prenom} ${c.nom} ${c.email}`.toLowerCase().includes(filtreSearch.toLowerCase())) return false
    if (filtreFidelite && rf.label !== filtreFidelite) return false
    if (filtreNewsletter === 'inscrit' && !c.newsletter_consent) return false
    if (filtreNewsletter === 'non'     &&  c.newsletter_consent) return false
    if (filtreAbo === 'actif'   && c.statut !== 'abonne') return false
    if (filtreAbo === 'inactif' && c.statut !== 'ancien') return false
    if (filtreAbo === 'jamais'  && (c.statut === 'abonne' || c.statut === 'ancien')) return false
    if (filtreStyle    && c.pref_style    !== filtreStyle)    return false
    if (filtreTypeBeat && c.pref_type_beat !== filtreTypeBeat) return false
    if (filtreLicence  && c.pref_licence  !== filtreLicence)  return false
    if (filtreCommandesVal !== '') {
      const ref = parseInt(filtreCommandesVal)
      if (!isNaN(ref) && !compareSigne(c.nb_achats, filtreCommandesSigne, ref)) return false
    }
    if (filtrePanierVal !== '') {
      const ref = parseFloat(filtrePanierVal)
      const val = c.panier_moyen
      if (!isNaN(ref)) {
        if (val === null) return false
        if (!compareSigne(val, filtrePanierSigne, ref)) return false
      }
    }
    if (filtreLtvVal !== '') {
      const ref = parseFloat(filtreLtvVal)
      if (!isNaN(ref) && !compareSigne(c.ltv, filtreLtvSigne, ref)) return false
    }
    if (filtreLastVal !== '') {
      const ref = parseInt(filtreLastVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtreLastUnite)
        if (!c.dernier_achat_iso) return false
        const valDays = joursDepuis(c.dernier_achat_iso)
        if (valDays === Infinity || !compareSigne(valDays, filtreLastSigne, refDays)) return false
      }
    }
    return true
  }).sort((a, b) => b.ltv - a.ltv),
  [clients, filtreSearch, filtreFidelite, filtreNewsletter, filtreAbo, filtreStyle, filtreTypeBeat, filtreLicence, filtreCommandesVal, filtreCommandesSigne, filtrePanierVal, filtrePanierSigne, filtreLtvVal, filtreLtvSigne, filtreLastVal, filtreLastSigne, filtreLastUnite])

  // KPIs
  const totalLtv      = displayed.reduce((s, c) => s + c.ltv, 0)
  const totalOrders   = displayed.reduce((s, c) => s + c.nb_achats, 0)
  const ltvMoy        = displayed.length ? totalLtv / displayed.length : 0
  const commandesMoy  = displayed.length ? totalOrders / displayed.length : 0
  const panierMoy     = totalOrders > 0  ? displayed.reduce((s, c) => s + (c.panier_moyen ?? 0) * c.nb_achats, 0) / totalOrders : 0
  const nbRegulier    = displayed.filter(c => scoreRF(c.nb_achats, c.dernier_achat_iso).label === 'Régulier').length
  const nbFidele      = displayed.filter(c => scoreRF(c.nb_achats, c.dernier_achat_iso).label === 'Fidèle').length
  const nbOccasionnel = displayed.filter(c => scoreRF(c.nb_achats, c.dernier_achat_iso).label === 'Occasionnel').length
  const nbDormant     = displayed.filter(c => scoreRF(c.nb_achats, c.dernier_achat_iso).label === 'Dormant').length
  const topStyle    = topOf(displayed.map(c => c.pref_style))
  const topTypeBeat = topOf(displayed.map(c => c.pref_type_beat))
  const topLicence  = topOf(displayed.map(c => c.pref_licence))

  const allSelected = displayed.length > 0 && displayed.every(c => selected.has(c.id))
  function toggleAll() {
    setSelected(prev => {
      const s = new Set(prev)
      allSelected ? displayed.forEach(c => s.delete(c.id)) : displayed.forEach(c => s.add(c.id))
      return s
    })
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

  const hBtn = (active: boolean) =>
    `flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors cursor-pointer whitespace-nowrap ${active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'}`
  const popoverBase = `absolute top-full mt-1 bg-gray-900 border border-gray-800 rounded-xl p-3 shadow-2xl z-30`
  const sel2        = `text-xs bg-gray-800 text-gray-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer border border-gray-700 focus:border-indigo-500`
  const numInput    = `w-20 text-xs bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-indigo-500 outline-none [appearance:textfield]`
  const clearBtn    = `text-xs text-gray-600 hover:text-white transition-colors mt-2 block`
  const dot         = <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 ml-0.5" />
  const chevron     = <span className="text-[9px] text-gray-700 ml-0.5">▾</span>

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-end gap-3 mb-5">
            <span className="text-4xl font-black text-white">{displayed.length}</span>
            <span className="text-sm text-gray-500 mb-0.5">client{displayed.length !== 1 ? 's' : ''}</span>
            {hasAnyFilter && <span className="text-xs text-gray-600 mb-0.5">sur {clients.length} au total</span>}
          </div>
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-gray-800">
            {[
              { label: 'LTV moyenne',    value: fmt(Math.round(ltvMoy)),    sub: 'par client'   },
              { label: 'Licences moy.',  value: commandesMoy.toFixed(1),    sub: 'par client'   },
              { label: 'Panier moyen',   value: fmt(Math.round(panierMoy)), sub: 'par commande' },
            ].map(({ label, value, sub }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-gray-700 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Régulier',    count: nbRegulier,    cls: 'text-green-400'  },
              { label: 'Fidèle',      count: nbFidele,      cls: 'text-indigo-400' },
              { label: 'Occasionnel', count: nbOccasionnel, cls: 'text-amber-400'  },
              { label: 'Dormant',     count: nbDormant,     cls: 'text-gray-500'   },
            ].map(({ label, count, cls }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{label}</span>
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-black ${cls}`}>{count}</span>
                  <span className="text-xs text-gray-600 w-8 text-right">{displayed.length > 0 ? Math.round(count / displayed.length * 100) : 0}%</span>
                </div>
              </div>
            ))}
          </div>
          {(topStyle.total > 0 || topTypeBeat.total > 0 || topLicence.total > 0) && (
            <>
              <div className="border-t border-gray-800" />
              <div>
                <p className="text-xs text-gray-500 mb-2">Préférences top</p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { top: topStyle,    label: 'style'     },
                    { top: topTypeBeat, label: 'type beat' },
                    { top: topLicence,  label: 'licence'   },
                  ].map(({ top, label }) => top.total > 0 && (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white truncate">{top.value}</span>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                        <span className="text-lg font-black text-white">{top.count}</span>
                        <span className="text-xs text-gray-600 w-8 text-right">{top.total > 0 ? Math.round(top.count / top.total * 100) : 0}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-gray-800 flex items-center gap-3 min-h-[44px]">
          <div className="relative flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none">⌕</span>
            <input type="text" value={filtreSearch} onChange={e => setFiltreSearch(e.target.value)} placeholder="Rechercher…"
              className="w-48 bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none transition-colors" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            {selected.size > 0 ? (
              <>
                <span className="text-sm font-semibold text-white">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
                <button onClick={() => setShowListeModal(true)} className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
                  + Ajouter à une liste
                </button>
                {hasAnyFilter && <button onClick={resetAll} className="text-xs text-gray-600 hover:text-white transition-colors">Réinitialiser</button>}
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white transition-colors">Annuler</button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-600">{displayed.length} client{displayed.length !== 1 ? 's' : ''}</span>
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
                    <button onClick={() => setOpenPopover(p => p === 'contact' ? null : 'contact')} className={hBtn(hasFilterContact)}>
                      Contact {hasFilterContact && dot} {chevron}
                    </button>
                    {openPopover === 'contact' && (
                      <div className={`${popoverBase} left-0 min-w-[180px] flex flex-col gap-2`}>
                        <select value={filtreFidelite} onChange={e => setFiltreFidelite(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Fidélité — tous</option>
                          <option value="Régulier">Régulier</option>
                          <option value="Fidèle">Fidèle</option>
                          <option value="Occasionnel">Occasionnel</option>
                          <option value="Dormant">Dormant</option>
                        </select>
                        <select value={filtreNewsletter} onChange={e => setFiltreNewsletter(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Newsletter — tous</option>
                          <option value="inscrit">Inscrit</option>
                          <option value="non">Non inscrit</option>
                        </select>
                        {hasFilterContact && <button onClick={() => { setFiltreFidelite(''); setFiltreNewsletter('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Abonnement */}
                <th className="text-left px-3 py-3">
                  <div ref={refAbo} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'abo' ? null : 'abo')} className={hBtn(hasFilterAbo)}>
                      Abonnement {hasFilterAbo && dot} {chevron}
                    </button>
                    {openPopover === 'abo' && (
                      <div className={`${popoverBase} left-0 min-w-[160px] flex flex-col gap-1`}>
                        {[['', 'Tous'], ['actif', 'Actif'], ['inactif', 'Inactif'], ['jamais', 'Jamais abonné']].map(([v, label]) => (
                          <button key={v} onClick={() => { setFiltreAbo(v); setOpenPopover(null) }}
                            className={`text-left text-xs px-3 py-1.5 rounded-lg transition-colors ${filtreAbo === v ? 'bg-indigo-600/30 text-indigo-300' : 'hover:bg-gray-800 text-gray-400 hover:text-white'}`}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </th>

                {/* Préférences */}
                <th className="text-left px-3 py-3">
                  <div ref={refPrefs} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'prefs' ? null : 'prefs')} className={hBtn(hasFilterPrefs)}>
                      Préférences {hasFilterPrefs && dot} {chevron}
                    </button>
                    {openPopover === 'prefs' && (
                      <div className={`${popoverBase} left-0 min-w-[180px] flex flex-col gap-2`}>
                        {[
                          { label: 'Style',     value: filtreStyle,    set: setFiltreStyle,    opts: styles },
                          { label: 'Type beat', value: filtreTypeBeat, set: setFiltreTypeBeat, opts: typeBeats },
                          { label: 'Licence',   value: filtreLicence,  set: setFiltreLicence,  opts: licences },
                        ].map(({ label, value, set, opts }) => (
                          <select key={label} value={value} onChange={e => set(e.target.value)} className={`${sel2} w-full`}>
                            <option value="">{label} — tous</option>
                            {opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ))}
                        {hasFilterPrefs && <button onClick={() => { setFiltreStyle(''); setFiltreTypeBeat(''); setFiltreLicence('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Licences */}
                <th className="text-right px-3 py-3">
                  <div ref={refCommandes} className="relative inline-flex justify-end">
                    <button onClick={() => setOpenPopover(p => p === 'commandes' ? null : 'commandes')} className={hBtn(hasFilterCommandes)}>
                      Licences {hasFilterCommandes && dot} {chevron}
                    </button>
                    {openPopover === 'commandes' && (
                      <div className={`${popoverBase} right-0`}>
                        <div className="flex items-center gap-2">
                          <select value={filtreCommandesSigne} onChange={e => setFiltreCommandesSigne(e.target.value)} className={sel2}>
                            <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option>
                            <option value=">=">&ge;</option><option value="<=">&le;</option>
                          </select>
                          <input type="number" min="0" value={filtreCommandesVal} onChange={e => setFiltreCommandesVal(e.target.value)} placeholder="3" className={numInput} />
                        </div>
                        {hasFilterCommandes && <button onClick={() => setFiltreCommandesVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Panier moy. */}
                <th className="text-right px-3 py-3">
                  <div ref={refPanier} className="relative inline-flex justify-end">
                    <button onClick={() => setOpenPopover(p => p === 'panier' ? null : 'panier')} className={hBtn(hasFilterPanier)}>
                      Panier moy. {hasFilterPanier && dot} {chevron}
                    </button>
                    {openPopover === 'panier' && (
                      <div className={`${popoverBase} right-0`}>
                        <div className="flex items-center gap-2">
                          <select value={filtrePanierSigne} onChange={e => setFiltrePanierSigne(e.target.value)} className={sel2}>
                            <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option>
                            <option value=">=">&ge;</option><option value="<=">&le;</option>
                          </select>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">€</span>
                            <input type="number" min="0" value={filtrePanierVal} onChange={e => setFiltrePanierVal(e.target.value)} placeholder="50" className={`${numInput} pl-5`} />
                          </div>
                        </div>
                        {hasFilterPanier && <button onClick={() => setFiltrePanierVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* Dernier achat */}
                <th className="text-right px-3 py-3">
                  <div ref={refLast} className="relative inline-flex justify-end">
                    <button onClick={() => setOpenPopover(p => p === 'last' ? null : 'last')} className={hBtn(hasFilterLast)}>
                      Dernier achat {hasFilterLast && dot} {chevron}
                    </button>
                    {openPopover === 'last' && (
                      <div className={`${popoverBase} right-0 min-w-[230px]`}>
                        <p className="text-xs text-gray-500 mb-2">Il y a…</p>
                        <div className="flex items-center gap-2">
                          <select value={filtreLastSigne} onChange={e => setFiltreLastSigne(e.target.value)} className={sel2}>
                            <option value=">">&gt;</option><option value="<">&lt;</option><option value="=">=</option>
                            <option value=">=">&ge;</option><option value="<=">&le;</option>
                          </select>
                          <input type="number" min="1" value={filtreLastVal} onChange={e => setFiltreLastVal(e.target.value)} placeholder="3" className={numInput} />
                          <select value={filtreLastUnite} onChange={e => setFiltreLastUnite(e.target.value)} className={sel2}>
                            <option value="jours">jours</option><option value="semaines">sem.</option>
                            <option value="mois">mois</option><option value="années">ans</option>
                          </select>
                        </div>
                        {hasFilterLast && <button onClick={() => setFiltreLastVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                {/* LTV */}
                <th className="text-right px-3 py-3">
                  <div ref={refLtv} className="relative inline-flex justify-end">
                    <button onClick={() => setOpenPopover(p => p === 'ltv' ? null : 'ltv')} className={hBtn(hasFilterLtv)}>
                      LTV {hasFilterLtv && dot} {chevron}
                    </button>
                    {openPopover === 'ltv' && (
                      <div className={`${popoverBase} right-0`}>
                        <div className="flex items-center gap-2">
                          <select value={filtreLtvSigne} onChange={e => setFiltreLtvSigne(e.target.value)} className={sel2}>
                            <option value="=">=</option><option value=">">&gt;</option><option value="<">&lt;</option>
                            <option value=">=">&ge;</option><option value="<=">&le;</option>
                          </select>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">€</span>
                            <input type="number" min="0" value={filtreLtvVal} onChange={e => setFiltreLtvVal(e.target.value)} placeholder="100" className={`${numInput} pl-5`} />
                          </div>
                        </div>
                        {hasFilterLtv && <button onClick={() => setFiltreLtvVal('')} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(c => {
                const rf  = scoreRF(c.nb_achats, c.dernier_achat_iso)
                const sel = selected.has(c.id)
                return (
                  <tr key={c.id} className={`border-b border-gray-800 last:border-0 transition-colors ${sel ? 'bg-indigo-950/30' : 'hover:bg-gray-800/40'}`}>
                    <td className="px-5 py-3 text-center">
                      <input type="checkbox" checked={sel} onChange={() => toggle(c.id)} className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer" />
                    </td>
                    <td className="px-3 py-3">
                      <Link href={`/dashboard/business/contacts/${c.id}`} className="flex items-center gap-3 group">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                            {c.pays
                              ? <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                              : <span className="text-indigo-300 font-bold text-xs">{initiales(c.prenom, c.nom)}</span>
                            }
                          </div>
                          {c.newsletter_consent && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-950" />}
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">{c.prenom} {c.nom}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${rf.cls}`}>
                            {rf.label === 'Occasionnel' ? 'Occas.' : rf.label}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {c.statut === 'abonne' ? <span className="text-gray-300">Actif</span>
                       : c.statut === 'ancien' ? <span className="text-gray-500">Inactif</span>
                       : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {c.pref_style || c.pref_type_beat || c.pref_ambiance || c.pref_licence ? (
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
                          <span className="text-gray-300 truncate">{c.pref_style     ?? <span className="text-gray-700">—</span>}</span>
                          <span className="text-gray-300 truncate">{c.pref_type_beat ?? <span className="text-gray-700">—</span>}</span>
                          <span className="text-gray-500 truncate">{c.pref_ambiance  ?? <span className="text-gray-700">—</span>}</span>
                          <span className="text-gray-500 truncate">{c.pref_licence   ?? <span className="text-gray-700">—</span>}</span>
                        </div>
                      ) : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-white">{c.nb_achats}</td>
                    <td className="px-3 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                      {c.panier_moyen !== null ? fmt(c.panier_moyen) : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                      {c.dernier_achat_iso ? dateRel(c.dernier_achat_iso) : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-white whitespace-nowrap">{fmt(c.ltv)}</td>
                    <td className="px-3 py-3 text-center">
                      <Link href={`/dashboard/business/contacts/${c.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">→</Link>
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-600 text-sm">Aucun client ne correspond à ces filtres.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal liste */}
      {showListeModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowListeModal(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            {listeCreee ? (
              <div className="text-center py-4">
                <p className="text-green-400 font-semibold text-sm">Contacts ajoutés ✓</p>
                <p className="text-gray-500 text-xs mt-1">{selected.size} client{selected.size > 1 ? 's' : ''} ajouté{selected.size > 1 ? 's' : ''}</p>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-white mb-1">Ajouter à une liste</h2>
                <p className="text-xs text-gray-500 mb-4">{selected.size} client{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</p>

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
                  <div>
                    <input autoFocus type="text" value={nomListe} onChange={e => setNomListe(e.target.value)} placeholder="Nom de la liste…"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                  </div>
                  <div>
                    <input type="text" value={descListe} onChange={e => setDescListe(e.target.value)} placeholder="Description (optionnel)"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                  </div>
                </div>
                {listeError && <p className="text-red-400 text-xs mt-2">{listeError}</p>}
                <div className="flex gap-2 mt-5">
                  <button onClick={creerListe} disabled={!nomListe.trim() || savingListe} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors">
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
