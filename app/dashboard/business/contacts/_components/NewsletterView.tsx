'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { joursDepuis } from '../../_lib/utils'

export type NewsletterRow = {
  id: string
  prenom: string | null
  nom: string
  nom_artiste: string | null
  pays: string | null
  newsletter_consent: boolean
  premier_nwt_iso: string
  premier_nwt_type: string
  dernier_nwt_iso: string
  dernier_nwt_type: string
  envoyes: number
  ouverts: number
  clics: number
  conversions: number
}

function initiales(prenom: string | null, nom: string | null) {
  return `${prenom?.[0] ?? ''}${nom?.[0] ?? ''}`.toUpperCase() || '?'
}

function dateRel(iso: string): string {
  const j = joursDepuis(iso)
  if (j === 0) return 'Auj.'
  if (j === 1) return 'Hier'
  if (j < 7)   return `${j}j`
  if (j < 30)  return `${Math.floor(j / 7)} sem`
  if (j < 365) return `${Math.floor(j / 30)} mois`
  const a = Math.floor(j / 365)
  return `${a} an${a > 1 ? 's' : ''}`
}

function toDays(val: number, unite: string): number {
  if (unite === 'jours')    return val
  if (unite === 'semaines') return val * 7
  if (unite === 'mois')     return val * 30
  return val * 365
}

function compareSigne(val: number, signe: string, ref: number): boolean {
  if (signe === '=')  return val === ref
  if (signe === '>')  return val > ref
  if (signe === '<')  return val < ref
  if (signe === '>=') return val >= ref
  if (signe === '<=') return val <= ref
  return true
}

// Adapté du score crm-proto — sans le poids "réponses" (aucun suivi de réponse email dans l'app)
function scoreNwt(r: NewsletterRow): { pct: number; label: string; cls: string; dot: string } {
  const open  = r.envoyes > 0 ? r.ouverts     / r.envoyes : 0
  const click = r.ouverts > 0 ? r.clics       / r.ouverts : 0
  const conv  = r.clics   > 0 ? r.conversions / r.clics   : 0
  const pct = Math.round((open * 0.15 + click * 0.35 + conv * 0.50) * 100)
  if (pct >= 70) return { pct, label: 'Très engagé', cls: 'bg-green-500/20 text-green-400',   dot: 'bg-green-400'  }
  if (pct >= 45) return { pct, label: 'Engagé',      cls: 'bg-indigo-500/20 text-indigo-400', dot: 'bg-indigo-400' }
  if (pct >= 20) return { pct, label: 'Passif',      cls: 'bg-orange-500/20 text-orange-400', dot: 'bg-orange-400' }
  return               { pct, label: 'Inactif',     cls: 'bg-gray-700 text-gray-400',         dot: 'bg-gray-500'  }
}

const engLabels = ['Très engagé', 'Engagé', 'Passif', 'Inactif'] as const
const engBorder: Record<string, string> = {
  'Très engagé': 'border-green-500/20',
  'Engagé':      'border-indigo-500/20',
  'Passif':      'border-orange-500/20',
  'Inactif':     'border-gray-800',
}

export default function NewsletterView({
  contacts,
  listes,
}: {
  contacts: NewsletterRow[]
  listes: { id: string; nom: string; nb: number }[]
}) {
  const inscrits = useMemo(() => contacts.filter(c => c.newsletter_consent), [contacts])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filtreSearch,       setFiltreSearch]       = useState('')
  const [filtreInscription,  setFiltreInscription]  = useState('')
  const [filtreEngagement,   setFiltreEngagement]   = useState('')
  const [filtrePremierSigne, setFiltrePremierSigne] = useState('>')
  const [filtrePremierVal,   setFiltrePremierVal]   = useState('')
  const [filtrePremierUnite, setFiltrePremierUnite] = useState('mois')
  const [filtreDernierSigne, setFiltreDernierSigne] = useState('>')
  const [filtreDernierVal,   setFiltreDernierVal]   = useState('')
  const [filtreDernierUnite, setFiltreDernierUnite] = useState('mois')
  const [openPopover,        setOpenPopover]        = useState<string | null>(null)
  const [showListeModal,     setShowListeModal]     = useState(false)
  const [nomListe,           setNomListe]           = useState('')
  const [descListe,          setDescListe]          = useState('')
  const [listeCreee,         setListeCreee]         = useState(false)
  const [savingListe,        setSavingListe]        = useState(false)
  const [listeError,         setListeError]         = useState<string | null>(null)

  const refContact = useRef<HTMLDivElement>(null)
  const refPremier  = useRef<HTMLDivElement>(null)
  const refDernier  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openPopover) return
    function handleClick(e: MouseEvent) {
      const zones = [refContact, refPremier, refDernier]
      if (!zones.some(r => r.current?.contains(e.target as Node))) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openPopover])

  const hasFilterContact = filtreEngagement !== '' || filtreInscription !== ''
  const hasFilterPremier = filtrePremierVal !== ''
  const hasFilterDernier = filtreDernierVal !== ''
  const hasAnyFilter     = filtreSearch !== '' || hasFilterContact || hasFilterPremier || hasFilterDernier

  function resetAll() {
    setFiltreSearch(''); setFiltreEngagement(''); setFiltreInscription('')
    setFiltrePremierVal(''); setFiltrePremierSigne('>'); setFiltrePremierUnite('mois')
    setFiltreDernierVal(''); setFiltreDernierSigne('>'); setFiltreDernierUnite('mois')
  }

  const displayed = useMemo(() => contacts.filter(c => {
    if (filtreInscription === 'inscrit'     && !c.newsletter_consent) return false
    if (filtreInscription === 'desinscrit'  &&  c.newsletter_consent) return false
    if (filtreSearch && !`${c.prenom ?? ''} ${c.nom} ${c.nom_artiste ?? ''}`.toLowerCase().includes(filtreSearch.toLowerCase())) return false
    if (filtreEngagement && scoreNwt(c).label !== filtreEngagement) return false
    if (filtrePremierVal !== '') {
      const ref = parseInt(filtrePremierVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtrePremierUnite)
        const valDays = joursDepuis(c.premier_nwt_iso)
        if (!compareSigne(valDays, filtrePremierSigne, refDays)) return false
      }
    }
    if (filtreDernierVal !== '') {
      const ref = parseInt(filtreDernierVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtreDernierUnite)
        const valDays = joursDepuis(c.dernier_nwt_iso)
        if (!compareSigne(valDays, filtreDernierSigne, refDays)) return false
      }
    }
    return true
  }).sort((a, b) => joursDepuis(a.dernier_nwt_iso) - joursDepuis(b.dernier_nwt_iso)),
  [contacts, filtreInscription, filtreSearch, filtreEngagement, filtrePremierVal, filtrePremierSigne, filtrePremierUnite, filtreDernierVal, filtreDernierSigne, filtreDernierUnite])

  // KPIs réactifs
  const total        = displayed.length
  const totalEnvoyes = displayed.reduce((s, c) => s + c.envoyes,     0)
  const totalOuverts = displayed.reduce((s, c) => s + c.ouverts,     0)
  const totalClics   = displayed.reduce((s, c) => s + c.clics,       0)
  const totalConv    = displayed.reduce((s, c) => s + c.conversions, 0)
  const tauxOuv  = totalEnvoyes > 0 ? Math.round(totalOuverts / totalEnvoyes * 100) : 0
  const tauxClic = totalOuverts > 0 ? Math.round(totalClics   / totalOuverts * 100) : 0

  const engCounts = inscrits.reduce((acc, c) => {
    const label = scoreNwt(c).label
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

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
  const sel2     = `text-xs bg-gray-800 text-gray-300 rounded-lg px-2 py-1.5 outline-none cursor-pointer border border-gray-700 focus:border-indigo-500`
  const numInput = `w-20 text-xs bg-gray-800 text-white rounded-lg px-2 py-1.5 border border-gray-700 focus:border-indigo-500 outline-none [appearance:textfield]`
  const clearBtn = `text-xs text-gray-600 hover:text-white transition-colors mt-2 block`
  const dot      = <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 ml-0.5" />
  const chevron  = <span className="text-[9px] text-gray-700 ml-0.5">▾</span>

  function datePopover(signe: string, setSigne: (v: string) => void, val: string, setVal: (v: string) => void, unite: string, setUnite: (v: string) => void, onClear: () => void, hasFilter: boolean) {
    return (
      <>
        <p className="text-xs text-gray-500 mb-2">Il y a…</p>
        <div className="flex items-center gap-2">
          <select value={signe} onChange={e => setSigne(e.target.value)} className={sel2}>
            <option value=">">&gt;</option><option value="<">&lt;</option><option value="=">=</option>
            <option value=">=">&ge;</option><option value="<=">&le;</option>
          </select>
          <input type="number" min="1" value={val} onChange={e => setVal(e.target.value)} placeholder="3" className={numInput} />
          <select value={unite} onChange={e => setUnite(e.target.value)} className={sel2}>
            <option value="jours">jours</option><option value="semaines">sem.</option>
            <option value="mois">mois</option><option value="années">ans</option>
          </select>
        </div>
        {hasFilter && <button onClick={onClear} className={clearBtn}>Effacer</button>}
      </>
    )
  }

  return (
    <>
      {/* ── KPIs ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-end gap-3 mb-5">
            <span className="text-4xl font-black text-white">{total}</span>
            <span className="text-sm text-gray-500 mb-0.5">contact{total !== 1 ? 's' : ''} newsletter</span>
            {hasAnyFilter && <span className="text-xs text-gray-600 mb-0.5">sur {contacts.length} au total</span>}
          </div>
          <div className="grid grid-cols-4 gap-4 pt-5 border-t border-gray-800">
            {[
              { label: 'Envoyés',          value: String(totalEnvoyes), sub: 'emails au total' },
              { label: "Taux d'ouverture", value: `${tauxOuv}%`,        sub: `${totalOuverts} / ${totalEnvoyes} emails` },
              { label: 'Taux de clic',     value: `${tauxClic}%`,       sub: `${totalClics} clics sur ouvertures` },
              { label: 'Conversions',      value: String(totalConv),   sub: 'achats via newsletter' },
            ].map(kpi => (
              <div key={kpi.label}>
                <p className="text-xs text-gray-500 mb-1">{kpi.label}</p>
                <p className="text-2xl font-black text-white">{kpi.value}</p>
                <p className="text-xs text-gray-700 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-2">
          {engLabels.map(label => {
            const count = engCounts[label] ?? 0
            const pct   = inscrits.length > 0 ? Math.round(count / inscrits.length * 100) : 0
            return (
              <div key={label} className={`flex items-center justify-between rounded-xl px-3 py-2 border ${engBorder[label]}`}>
                <span className="text-xs text-gray-500">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-white">{count}</span>
                  <span className="text-xs text-gray-600 w-8 text-right">{pct}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-2.5 border-b border-gray-800 flex items-center gap-3 min-h-[44px]">
          <div className="relative flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none select-none">⌕</span>
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
                <button onClick={() => setShowListeModal(true)} className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
                  + Ajouter à une liste
                </button>
                {hasAnyFilter && <button onClick={resetAll} className="text-xs text-gray-600 hover:text-white transition-colors">Réinitialiser</button>}
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-white transition-colors">Annuler</button>
              </>
            ) : (
              <>
                <span className="text-xs text-gray-600">{displayed.length} contact{displayed.length !== 1 ? 's' : ''}</span>
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

                <th className="text-left px-3 py-3">
                  <div ref={refContact} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'contact' ? null : 'contact')} className={hBtn(hasFilterContact)}>
                      Contact {hasFilterContact && dot} {chevron}
                    </button>
                    {openPopover === 'contact' && (
                      <div className={`${popoverBase} left-0 min-w-[180px] flex flex-col gap-2`}>
                        <select value={filtreEngagement} onChange={e => setFiltreEngagement(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Engagement — tous</option>
                          {engLabels.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                        <select value={filtreInscription} onChange={e => setFiltreInscription(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Newsletter — tous</option>
                          <option value="inscrit">Inscrit</option>
                          <option value="desinscrit">Non inscrit</option>
                        </select>
                        {hasFilterContact && <button onClick={() => { setFiltreInscription(''); setFiltreEngagement('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>

                <th className="text-left px-3 py-3">
                  <div ref={refPremier} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'premier' ? null : 'premier')} className={hBtn(hasFilterPremier)}>
                      1er contact {hasFilterPremier && dot} {chevron}
                    </button>
                    {openPopover === 'premier' && (
                      <div className={`${popoverBase} left-0 min-w-[230px]`}>
                        {datePopover(filtrePremierSigne, setFiltrePremierSigne, filtrePremierVal, setFiltrePremierVal, filtrePremierUnite, setFiltrePremierUnite, () => setFiltrePremierVal(''), hasFilterPremier)}
                      </div>
                    )}
                  </div>
                </th>

                <th className="text-left px-3 py-3">
                  <div ref={refDernier} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'dernier' ? null : 'dernier')} className={hBtn(hasFilterDernier)}>
                      Dernier contact {hasFilterDernier && dot} {chevron}
                    </button>
                    {openPopover === 'dernier' && (
                      <div className={`${popoverBase} left-0 min-w-[230px]`}>
                        {datePopover(filtreDernierSigne, setFiltreDernierSigne, filtreDernierVal, setFiltreDernierVal, filtreDernierUnite, setFiltreDernierUnite, () => setFiltreDernierVal(''), hasFilterDernier)}
                      </div>
                    )}
                  </div>
                </th>

                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Envoyés</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Ouv. %</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Clic %</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Conv.</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((c, i) => {
                const eng = scoreNwt(c)
                const ouv = c.envoyes > 0 ? Math.round(c.ouverts / c.envoyes * 100) : 0
                const cli = c.ouverts > 0 ? Math.round(c.clics   / c.ouverts * 100) : 0
                return (
                  <tr key={c.id} className={`${i < displayed.length - 1 ? 'border-b border-gray-800' : ''} hover:bg-gray-800/40 transition-colors ${selected.has(c.id) ? 'bg-indigo-500/5' : ''}`}>
                    <td className="px-5 py-3">
                      <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="w-3.5 h-3.5 rounded accent-indigo-500 cursor-pointer" />
                    </td>

                    <td className="px-3 py-3">
                      <Link href={`/dashboard/business/contacts/${c.id}`} className="flex items-center gap-3 group">
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-800 flex items-center justify-center">
                            {c.pays
                              ? <img src={`https://flagcdn.com/w40/${c.pays.toLowerCase()}.png`} alt={c.pays} className="w-full h-full object-cover" />
                              : <span className="text-indigo-300 font-bold text-xs">{initiales(c.prenom, c.nom)}</span>}
                          </div>
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-gray-950 ${c.newsletter_consent ? 'bg-green-400' : 'bg-red-500'}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">{c.prenom} {c.nom}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${eng.cls}`}>{eng.label}</span>
                          </div>
                          {c.nom_artiste && <p className="text-xs text-gray-500 truncate">{c.nom_artiste}</p>}
                        </div>
                      </Link>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400 leading-none">{dateRel(c.premier_nwt_iso)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{c.premier_nwt_type}</p>
                    </td>

                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400 leading-none">{dateRel(c.dernier_nwt_iso)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{c.dernier_nwt_type}</p>
                    </td>

                    <td className="px-3 py-3 text-right text-xs text-gray-400">
                      {c.envoyes > 0 ? c.envoyes : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-400">
                      {c.envoyes > 0 ? `${ouv}%` : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-400">
                      {c.ouverts > 0 ? `${cli}%` : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-xs text-gray-400">
                      {c.envoyes > 0 ? c.conversions : <span className="text-gray-700">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/dashboard/business/contacts/${c.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">→</Link>
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-600 text-sm">Aucun contact ne correspond à ces filtres.</td></tr>
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
                <p className="text-gray-500 text-xs mt-1">{selected.size} contact{selected.size > 1 ? 's' : ''} ajouté{selected.size > 1 ? 's' : ''}</p>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-white mb-1">Ajouter à une liste</h2>
                <p className="text-xs text-gray-500 mb-4">{selected.size} contact{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</p>

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
