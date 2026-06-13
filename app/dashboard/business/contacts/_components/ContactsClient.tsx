'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import SocialIcon from '../../_components/SocialIcon'
import { joursDepuis } from '../../_lib/utils'
import ClientsView from './ClientsView'
import LeadsView, { type LeadRow } from './LeadsView'

export type ContactRow = {
  id: string
  prenom: string
  nom: string
  nom_artiste: string | null
  email: string
  pays: string | null
  telephone: string | null
  instagram: string | null
  spotify: string | null
  youtube: string | null
  tiktok: string | null
  newsletter_consent: boolean
  statut: 'abonne' | 'ancien' | 'client' | 'lead'
  statut_abo_detail: 'actif' | 'impaye' | 'annulation_en_cours' | 'ancien' | null
  nb_achats: number
  mensualites_payees: number
  premierContactISO: string
  dernierContactISO: string
  type1ereAction: string
  typeDerniereAction: string
  // Clients view extras
  ltv: number              // en euros
  dernier_achat_iso: string | null
  panier_moyen: number | null  // en euros
  pref_style: string | null
  pref_type_beat: string | null
  pref_ambiance: string | null
  pref_licence: string | null
}

function dateRel(iso: string): string {
  const j = joursDepuis(iso)
  if (j === 0) return "Auj."
  if (j === 1) return 'Hier'
  if (j < 7)   return `${j}j`
  if (j < 30)  return `${Math.floor(j / 7)} sem`
  if (j < 365) return `${Math.floor(j / 30)} mois`
  const a = Math.floor(j / 365)
  return `${a} an${a > 1 ? 's' : ''}`
}

function initiales(prenom: string, nom: string) {
  return `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase() || '?'
}

function statutBadge(statut: ContactRow['statut']): { label: string; cls: string } | null {
  if (statut === 'abonne') return { label: 'Abonné',     cls: 'bg-green-500/20 text-green-400' }
  if (statut === 'ancien') return { label: 'Ancien abo', cls: 'bg-gray-700/60 text-gray-500' }
  if (statut === 'client') return { label: 'Client',     cls: 'bg-indigo-500/20 text-indigo-400' }
  if (statut === 'lead')   return { label: 'Lead',       cls: 'bg-amber-500/20 text-amber-400' }
  return null
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

const PAYS_FR = new Set(['FR', 'BE', 'CH', 'RE', 'GP', 'MQ', 'GF', 'QC'])
const PAYS = [
  { code: 'fr', label: 'France' }, { code: 'be', label: 'Belgique' },
  { code: 'ch', label: 'Suisse' }, { code: 'ca', label: 'Canada' },
  { code: 'us', label: 'États-Unis' }, { code: 'gb', label: 'Royaume-Uni' },
  { code: 'de', label: 'Allemagne' }, { code: 'es', label: 'Espagne' },
  { code: 'it', label: 'Italie' }, { code: 'nl', label: 'Pays-Bas' },
  { code: 'sn', label: 'Sénégal' }, { code: 'ci', label: "Côte d'Ivoire" },
  { code: 'ma', label: 'Maroc' }, { code: 'dz', label: 'Algérie' },
  { code: 'tn', label: 'Tunisie' },
]

const field = `w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none transition-colors`
const sel   = `w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-sm text-white outline-none transition-colors cursor-pointer`
const labelCls = `text-xs text-gray-500 mb-1 block`

// ── Modale ajout contact ──────────────────────────────────────────────────────
function ContactsHeader() {
  const [open, setOpen] = useState(false)
  const [openImport, setOpenImport] = useState(false)
  const [saved, setSaved] = useState(false)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [pays, setPays] = useState('')
  const [nomArtiste, setNomArtiste] = useState('')
  const [instagram, setInstagram] = useState('')
  const [spotify, setSpotify] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')
  const [newsletter, setNewsletter] = useState('')
  const [notes, setNotes] = useState('')

  function reset() {
    setPrenom(''); setNom(''); setEmail(''); setTelephone('')
    setPays(''); setNomArtiste(''); setInstagram(''); setSpotify('')
    setYoutube(''); setTiktok(''); setNewsletter(''); setNotes('')
  }
  function handleClose() { setOpen(false); reset() }
  function handleSave() {
    if (!prenom || !nom || !email) return
    setSaved(true)
    setTimeout(() => { setSaved(false); handleClose() }, 1500)
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)} className="text-xs px-4 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white transition-colors">
          + Ajouter un contact
        </button>
        <button onClick={() => setOpenImport(true)} className="text-xs px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
          Importer
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={handleClose}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
              <h2 className="text-white font-bold text-lg">Nouveau contact</h2>
              <button onClick={handleClose} className="text-gray-600 hover:text-white transition-colors text-xl leading-none">×</button>
            </div>
            {saved ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <p className="text-green-400 font-semibold text-lg">✓ Contact ajouté</p>
                  <p className="text-gray-500 text-sm mt-1">{prenom} {nom} a été créé</p>
                </div>
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Identité</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className={labelCls}>Prénom <span className="text-indigo-400">*</span></label><input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Kaaris" className={field} /></div>
                  <div><label className={labelCls}>Nom <span className="text-indigo-400">*</span></label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Zeriouh" className={field} /></div>
                </div>
                <div className="mb-3"><label className={labelCls}>Email <span className="text-indigo-400">*</span></label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@example.com" className={field} /></div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div><label className={labelCls}>Nom artiste</label><input value={nomArtiste} onChange={e => setNomArtiste(e.target.value)} placeholder="Kaaris" className={field} /></div>
                  <div><label className={labelCls}>Téléphone</label><input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+33 6 12 34 56 78" className={field} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div><label className={labelCls}>Pays</label><select value={pays} onChange={e => setPays(e.target.value)} className={sel}><option value="">— Sélectionner</option>{PAYS.map(p => <option key={p.code} value={p.code}>{p.label}</option>)}</select></div>
                  <div><label className={labelCls}>Langue</label><select value={pays && PAYS_FR.has(pays.toUpperCase()) ? 'FR' : 'US'} className={sel} disabled><option value="FR">Français (FR)</option><option value="US">Anglais (US)</option></select></div>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Réseaux sociaux</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { label: 'Instagram', val: instagram, set: setInstagram, ph: '@artiste' },
                    { label: 'TikTok',    val: tiktok,    set: setTiktok,    ph: '@artiste' },
                    { label: 'Spotify',   val: spotify,   set: setSpotify,   ph: 'artiste.music' },
                    { label: 'YouTube',   val: youtube,   set: setYoutube,   ph: 'ChaineArtiste' },
                  ].map(({ label: l, val, set, ph }) => (
                    <div key={l}><label className={labelCls}>{l}</label><input value={val} onChange={e => set(e.target.value)} placeholder={ph} className={field} /></div>
                  ))}
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Divers</p>
                <div className="mb-3"><label className={labelCls}>Newsletter</label><select value={newsletter} onChange={e => setNewsletter(e.target.value)} className={sel}><option value="">Non inscrit</option><option value="inscrit">Inscrit</option></select></div>
                <div><label className={labelCls}>Notes</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contexte, rappels…" rows={3} className={`${field} resize-none`} /></div>
              </div>
            )}
            {!saved && (
              <div className="px-6 py-4 border-t border-gray-800 flex gap-3 flex-shrink-0">
                <button onClick={handleSave} disabled={!prenom.trim() || !nom.trim() || !email.trim()} className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors">Ajouter le contact</button>
                <button onClick={handleClose} className="px-4 py-2 rounded-xl border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white text-sm transition-colors">Annuler</button>
              </div>
            )}
          </div>
        </div>
      )}

      {openImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setOpenImport(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4 border-b border-gray-800 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Importer</h2>
              <button onClick={() => setOpenImport(false)} className="text-gray-600 hover:text-white transition-colors text-xl leading-none">×</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <button className="text-left p-4 rounded-xl border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                <p className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors mb-1">Importer des contacts</p>
                <p className="text-gray-500 text-xs leading-relaxed">Ajoute de nouveaux contacts à ton CRM depuis un fichier CSV — noms, emails, réseaux sociaux, préférences.</p>
              </button>
              <button className="text-left p-4 rounded-xl border border-gray-800 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group">
                <p className="text-white font-semibold text-sm group-hover:text-indigo-300 transition-colors mb-1">Importer des commandes</p>
                <p className="text-gray-500 text-xs leading-relaxed">Importe l'historique de commandes depuis BeatStars. Les contacts associés seront créés automatiquement.</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Table principale ──────────────────────────────────────────────────────────
function ContactsTable({ contacts, listes }: { contacts: ContactRow[]; listes: { id: string; nom: string; nb: number }[] }) {
  const [selected, setSelected]                   = useState<Set<string>>(new Set())
  const [filtreSearch, setFiltreSearch]           = useState('')
  const [filtreStatut, setFiltreStatut]           = useState('')
  const [filtreNewsletter, setFiltreNewsletter]   = useState('')
  const [filtrePremSign, setFiltrePremSign]       = useState('>')
  const [filtrePremVal, setFiltrePremVal]         = useState('')
  const [filtrePremUnite, setFiltrePremUnite]     = useState('mois')
  const [filtreDernSign, setFiltreDernSign]       = useState('>')
  const [filtreDernVal, setFiltreDernVal]         = useState('')
  const [filtreDernUnite, setFiltreDernUnite]     = useState('mois')
  const [openPopover, setOpenPopover]             = useState<string | null>(null)
  const [showListeModal, setShowListeModal]       = useState(false)
  const [nomListe, setNomListe]                   = useState('')
  const [descListe, setDescListe]                 = useState('')
  const [listeCreee, setListeCreee]               = useState(false)

  const refContact  = useRef<HTMLDivElement>(null)
  const refPremiere = useRef<HTMLDivElement>(null)
  const refDerniere = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openPopover) return
    function handler(e: MouseEvent) {
      const refs = [refContact, refPremiere, refDerniere]
      if (!refs.some(r => r.current?.contains(e.target as Node))) setOpenPopover(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openPopover])

  const hasFilterContact  = filtreStatut !== '' || filtreNewsletter !== ''
  const hasFilterPremiere = filtrePremVal !== ''
  const hasFilterDerniere = filtreDernVal !== ''
  const hasAnyFilter = filtreSearch !== '' || hasFilterContact || hasFilterPremiere || hasFilterDerniere

  function resetAll() {
    setFiltreSearch(''); setFiltreStatut(''); setFiltreNewsletter('')
    setFiltrePremVal(''); setFiltrePremSign('>'); setFiltrePremUnite('mois')
    setFiltreDernVal(''); setFiltreDernSign('>'); setFiltreDernUnite('mois')
  }

  const displayed = useMemo(() => contacts.filter(c => {
    if (filtreSearch && !`${c.prenom} ${c.nom} ${c.email}`.toLowerCase().includes(filtreSearch.toLowerCase())) return false
    if (filtreStatut) {
      const badge = statutBadge(c.statut)
      if (!badge || badge.label !== filtreStatut) return false
    }
    if (filtreNewsletter === 'inscrit' && !c.newsletter_consent) return false
    if (filtreNewsletter === 'non'     &&  c.newsletter_consent) return false
    if (filtrePremVal !== '') {
      const ref = parseInt(filtrePremVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtrePremUnite)
        const valDays = joursDepuis(c.premierContactISO)
        if (valDays === Infinity || !compareSigne(valDays, filtrePremSign, refDays)) return false
      }
    }
    if (filtreDernVal !== '') {
      const ref = parseInt(filtreDernVal)
      if (!isNaN(ref) && ref > 0) {
        const refDays = toDays(ref, filtreDernUnite)
        const valDays = joursDepuis(c.dernierContactISO)
        if (valDays === Infinity || !compareSigne(valDays, filtreDernSign, refDays)) return false
      }
    }
    return true
  }).sort((a, b) => new Date(b.dernierContactISO).getTime() - new Date(a.dernierContactISO).getTime()),
  [contacts, filtreSearch, filtreStatut, filtreNewsletter, filtrePremVal, filtrePremSign, filtrePremUnite, filtreDernVal, filtreDernSign, filtreDernUnite])

  const total    = displayed.length
  const nbAbonne = displayed.filter(c => c.statut === 'abonne').length
  const nbAncien = displayed.filter(c => c.statut === 'ancien').length
  const nbClient = displayed.filter(c => c.statut === 'client').length
  const nbLead   = displayed.filter(c => c.statut === 'lead').length
  const nbNwt    = displayed.filter(c => c.newsletter_consent).length
  const nbInsta  = displayed.filter(c => c.instagram).length
  const nbTel    = displayed.filter(c => c.telephone).length
  const nbSpot   = displayed.filter(c => c.spotify).length
  const nbYT     = displayed.filter(c => c.youtube).length
  const nbTT     = displayed.filter(c => c.tiktok).length

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

  function creerListe() {
    setListeCreee(true)
    setTimeout(() => { setShowListeModal(false); setListeCreee(false); setNomListe(''); setDescListe(''); setSelected(new Set()) }, 1500)
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
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-end gap-3 mb-5">
            <span className="text-4xl font-black text-white">{total}</span>
            <span className="text-sm text-gray-500 mb-0.5">contact{total !== 1 ? 's' : ''}</span>
            {hasAnyFilter && <span className="text-xs text-gray-600 mb-0.5">sur {contacts.length} au total</span>}
          </div>
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-gray-800">
            {[
              { label: 'Newsletter', value: nbNwt,   sub: 'inscrits'  },
              { label: 'Instagram',  value: nbInsta,  sub: 'renseigné' },
              { label: 'Téléphone',  value: nbTel,    sub: 'renseigné' },
              { label: 'Spotify',    value: nbSpot,   sub: 'renseigné' },
              { label: 'YouTube',    value: nbYT,     sub: 'renseigné' },
              { label: 'TikTok',     value: nbTT,     sub: 'renseigné' },
            ].map(({ label, value, sub }) => (
              <div key={label}>
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-black text-white">{value}</p>
                <p className="text-xs text-gray-700 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="col-span-1 bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-2.5">
          {[
            { label: 'Abonné',     count: nbAbonne, cls: 'text-green-400'  },
            { label: 'Ancien abo', count: nbAncien, cls: 'text-gray-500'   },
            { label: 'Client',     count: nbClient, cls: 'text-indigo-400' },
            { label: 'Lead',       count: nbLead,   cls: 'text-amber-400'  },
          ].map(({ label, count, cls }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{label}</span>
              <div className="flex items-center gap-3">
                <span className={`text-lg font-black ${cls}`}>{count}</span>
                <span className="text-xs text-gray-600 w-8 text-right">{total > 0 ? Math.round(count / total * 100) : 0}%</span>
              </div>
            </div>
          ))}
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
                        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Statut — tous</option>
                          <option value="Abonné">Abonné</option>
                          <option value="Ancien abo">Ancien abo</option>
                          <option value="Client">Client</option>
                          <option value="Lead">Lead</option>
                        </select>
                        <select value={filtreNewsletter} onChange={e => setFiltreNewsletter(e.target.value)} className={`${sel2} w-full`}>
                          <option value="">Newsletter — tous</option>
                          <option value="inscrit">Inscrit</option>
                          <option value="non">Non inscrit</option>
                        </select>
                        {hasFilterContact && <button onClick={() => { setFiltreStatut(''); setFiltreNewsletter('') }} className={clearBtn}>Effacer</button>}
                      </div>
                    )}
                  </div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-3 py-3">
                  <div ref={refPremiere} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'premiere' ? null : 'premiere')} className={hBtn(hasFilterPremiere)}>
                      1ère action {hasFilterPremiere && dot} {chevron}
                    </button>
                    {openPopover === 'premiere' && (
                      <div className={`${popoverBase} left-0 min-w-[230px]`}>
                        {datePopover(filtrePremSign, setFiltrePremSign, filtrePremVal, setFiltrePremVal, filtrePremUnite, setFiltrePremUnite, () => setFiltrePremVal(''), hasFilterPremiere)}
                      </div>
                    )}
                  </div>
                </th>
                <th className="text-left px-3 py-3">
                  <div ref={refDerniere} className="relative inline-block">
                    <button onClick={() => setOpenPopover(p => p === 'derniere' ? null : 'derniere')} className={hBtn(hasFilterDerniere)}>
                      Dernière action {hasFilterDerniere && dot} {chevron}
                    </button>
                    {openPopover === 'derniere' && (
                      <div className={`${popoverBase} left-0 min-w-[230px]`}>
                        {datePopover(filtreDernSign, setFiltreDernSign, filtreDernVal, setFiltreDernVal, filtreDernUnite, setFiltreDernUnite, () => setFiltreDernVal(''), hasFilterDerniere)}
                      </div>
                    )}
                  </div>
                </th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Socials</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(c => {
                const badge = statutBadge(c.statut)
                const sel   = selected.has(c.id)
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
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">{c.prenom} {c.nom}</p>
                            {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${badge.cls}`}>{badge.label}</span>}
                          </div>
                          {c.nom_artiste && <p className="text-xs text-gray-500 truncate">{c.nom_artiste}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 max-w-[180px]">
                      <span className="truncate block">{c.email}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400">{dateRel(c.premierContactISO)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{c.type1ereAction}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <p className="text-xs text-gray-400">{dateRel(c.dernierContactISO)}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{c.typeDerniereAction}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <SocialIcon platform="instagram" value={c.instagram} />
                        <SocialIcon platform="spotify"   value={c.spotify} />
                        <SocialIcon platform="youtube"   value={c.youtube} />
                        <SocialIcon platform="tiktok"    value={c.tiktok} />
                        <SocialIcon platform="whatsapp"  value={c.telephone} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link href={`/dashboard/business/contacts/${c.id}`} className="text-gray-600 hover:text-indigo-400 transition-colors">→</Link>
                    </td>
                  </tr>
                )
              })}
              {displayed.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-600 text-sm">Aucun contact ne correspond à ces filtres.</td></tr>
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
                <p className="text-green-400 font-semibold text-sm">Liste créée ✓</p>
                <p className="text-gray-500 text-xs mt-1">{selected.size} contacts ajoutés</p>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-white mb-1">Créer une liste</h2>
                <p className="text-xs text-gray-500 mb-4">{selected.size} contact{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}</p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Nom de la liste</label>
                    <input autoFocus type="text" value={nomListe} onChange={e => setNomListe(e.target.value)} placeholder="Ex : Relance juin"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Description <span className="text-gray-600">(optionnel)</span></label>
                    <input type="text" value={descListe} onChange={e => setDescListe(e.target.value)} placeholder="Contexte de cette liste…"
                      className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors" />
                  </div>
                  {listes.length > 0 && (
                    <>
                      <p className="text-xs text-gray-600">Ou ajouter à une liste existante :</p>
                      <div className="flex flex-col gap-1.5 max-h-32 overflow-auto">
                        {listes.map(l => (
                          <button key={l.id} className="text-left text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
                            {l.nom} <span className="text-gray-600">· {l.nb} contacts</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={creerListe} disabled={!nomListe.trim()} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-bold text-white transition-colors">
                    Créer la liste
                  </button>
                  <button onClick={() => setShowListeModal(false)} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-400 transition-colors">
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

// ── Export principal ──────────────────────────────────────────────────────────
export default function ContactsClient({
  contacts,
  listes,
  leadsData,
  vue,
}: {
  contacts: ContactRow[]
  listes: { id: string; nom: string; nb: number }[]
  leadsData: LeadRow[]
  vue: string
}) {
  const clients    = contacts.filter(c => c.nb_achats > 0)
  const newsletter = contacts.filter(c => c.newsletter_consent)

  const tabs = [
    { key: '',           label: 'Tous'       },
    { key: 'clients',    label: 'Clients'    },
    { key: 'leads',      label: 'Leads'      },
    { key: 'newsletter', label: 'Newsletter' },
  ]

  const currentList = vue === 'newsletter' ? newsletter : contacts

  const tabNav = (
    <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit">
      {tabs.map(t => (
        <a
          key={t.key}
          href={t.key ? `?vue=${t.key}` : '?'}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${vue === t.key || (!vue && t.key === '') ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          {t.label}
        </a>
      ))}
    </div>
  )

  if (vue === 'clients') {
    return (
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Contacts</h1>
            <ContactsHeader />
          </div>
          {tabNav}
        </div>
        <ClientsView clients={clients} listes={listes} />
      </div>
    )
  }

  if (vue === 'leads') {
    return (
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Contacts</h1>
            <ContactsHeader />
          </div>
          {tabNav}
        </div>
        <p className="text-xs text-yellow-400 mb-2">DEBUG: {leadsData.length} leads — {listes[0]?.nom}</p>
        <LeadsView leads={leadsData} listes={listes} />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Contacts</h1>
          <ContactsHeader />
        </div>
        {tabNav}
      </div>

      <ContactsTable contacts={currentList} listes={listes} />
    </div>
  )
}
