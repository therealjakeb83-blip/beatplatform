'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CodePromoRow, LicenceOption, BeatOption } from '../page'

/* ─── types ─────────────────────────────────────────────────────── */

type UIStatut = 'actif' | 'inactif' | 'expire'

type FormData = {
  code: string
  description: string
  typeRemise: 'panier' | 'produit' | 'abonnement'
  typeValeur: 'pourcentage' | 'montant'
  valeur: string
  mensualitesMode: 'illimite' | 'defini'
  mensualites: string
  dateDebut: string
  heureDebut: string
  dateExpiration: string
  heureExpiration: string
  licencesMode: 'toutes' | 'specifiques'
  licencesSelectionnees: string[]
  depenseMin: string
  depenseMax: string
  premiereCommande: boolean
  utilisationIndividuelle: boolean
  modeBeats: 'tous' | 'inclure' | 'exclure'
  beatsSelectionnes: string[]
  emailsAutorises: string
  emailsExclus: string
  limiteParCode: string
  limiteParArticle: string
  limiteParUtilisateur: string
}

/* ─── constants ──────────────────────────────────────────────────── */

const STATUT_BADGE: Record<UIStatut, string> = {
  actif:   'bg-green-500/15 text-green-400 border border-green-500/20',
  inactif: 'bg-gray-500/15  text-gray-400  border border-gray-500/20',
  expire:  'bg-red-500/15   text-red-400   border border-red-500/20',
}
const STATUT_LABEL: Record<UIStatut, string> = {
  actif: 'Actif', inactif: 'Inactif', expire: 'Expiré',
}

const SECTIONS = [
  { key: 'general',      label: 'Général',        required: true  },
  { key: 'type',         label: 'Type de remise', required: false },
  { key: 'valeur',       label: 'Valeur',         required: true  },
  { key: 'dates',        label: 'Dates',          required: false },
  { key: 'licences',     label: 'Licences',       required: false },
  { key: 'restrictions', label: 'Restrictions',   required: false },
  { key: 'limites',      label: 'Limites',        required: false },
]

const INITIAL_FORM: FormData = {
  code: '', description: '',
  typeRemise: 'panier', typeValeur: 'pourcentage', valeur: '',
  mensualitesMode: 'illimite', mensualites: '',
  dateDebut: '', heureDebut: '', dateExpiration: '', heureExpiration: '',
  licencesMode: 'toutes', licencesSelectionnees: [],
  depenseMin: '', depenseMax: '',
  premiereCommande: false, utilisationIndividuelle: false,
  modeBeats: 'tous', beatsSelectionnes: [],
  emailsAutorises: '', emailsExclus: '',
  limiteParCode: '', limiteParArticle: '', limiteParUtilisateur: '',
}

/* ─── helpers ────────────────────────────────────────────────────── */

function computeStatut(c: CodePromoRow): UIStatut {
  if (c.date_expiration && new Date(c.date_expiration) < new Date()) return 'expire'
  return c.statut === 'inactif' ? 'inactif' : 'actif'
}

function formatRemise(c: CodePromoRow): string {
  if (c.type_valeur === 'pourcentage') return `−${c.valeur}%`
  return `−${c.valeur.toFixed(2)}€`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function genererCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = 'PROMO-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function formFromCode(c: CodePromoRow): FormData {
  const parseDatePart = (iso: string | null, part: 'date' | 'time') => {
    if (!iso) return ''
    const d = new Date(iso)
    if (part === 'date') return d.toISOString().substring(0, 10)
    return d.toTimeString().substring(0, 5)
  }
  return {
    code:                   c.code,
    description:            c.description ?? '',
    typeRemise:             c.type_remise,
    typeValeur:             c.type_valeur,
    valeur:                 String(c.valeur),
    mensualitesMode:        c.mensualites == null ? 'illimite' : 'defini',
    mensualites:            c.mensualites != null ? String(c.mensualites) : '',
    dateDebut:              parseDatePart(c.date_debut, 'date'),
    heureDebut:             parseDatePart(c.date_debut, 'time'),
    dateExpiration:         parseDatePart(c.date_expiration, 'date'),
    heureExpiration:        parseDatePart(c.date_expiration, 'time'),
    licencesMode:           c.licences_eligibles?.length ? 'specifiques' : 'toutes',
    licencesSelectionnees:  c.licences_eligibles ?? [],
    depenseMin:             c.depense_min != null ? String(c.depense_min) : '',
    depenseMax:             c.depense_max != null ? String(c.depense_max) : '',
    premiereCommande:       c.premiere_commande,
    utilisationIndividuelle: c.utilisation_individuelle,
    modeBeats:              c.beats_inclus?.length ? 'inclure' : c.beats_exclus?.length ? 'exclure' : 'tous',
    beatsSelectionnes:      c.beats_inclus ?? c.beats_exclus ?? [],
    emailsAutorises:        c.emails_autorises.join('\n'),
    emailsExclus:           c.emails_exclus.join('\n'),
    limiteParCode:          c.limite_par_code != null ? String(c.limite_par_code) : '',
    limiteParArticle:       c.limite_par_article != null ? String(c.limite_par_article) : '',
    limiteParUtilisateur:   c.limite_par_utilisateur != null ? String(c.limite_par_utilisateur) : '',
  }
}

function sectionHasDonnees(key: string, f: FormData): boolean {
  switch (key) {
    case 'general':      return !!f.description
    case 'type':         return false
    case 'valeur':       return !!f.valeur
    case 'dates':        return !!f.dateDebut || !!f.dateExpiration
    case 'licences':     return f.licencesMode === 'specifiques' && f.licencesSelectionnees.length > 0
    case 'restrictions': return !!f.depenseMin || !!f.depenseMax || f.premiereCommande || f.utilisationIndividuelle || f.modeBeats !== 'tous' || !!f.emailsAutorises || !!f.emailsExclus
    case 'limites':      return !!f.limiteParCode || !!f.limiteParArticle || !!f.limiteParUtilisateur
    default: return false
  }
}

/* ─── composant principal ────────────────────────────────────────── */

export default function CodesPromoClient({
  codes: initialCodes,
  licences,
  beats,
}: {
  codes: CodePromoRow[]
  licences: LicenceOption[]
  beats: BeatOption[]
}) {
  const router = useRouter()

  /* liste */
  const [codes, setCodes]     = useState(initialCodes)
  const [tab, setTab]         = useState<UIStatut | ''>('')
  const [search, setSearch]   = useState('')

  /* modal */
  const [modalOpen, setModalOpen]   = useState(false)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [activeSection, setSection] = useState('general')
  const [form, setForm]             = useState<FormData>(INITIAL_FORM)
  const [loading, setLoading]       = useState(false)
  const [erreur, setErreur]         = useState<string | null>(null)

  /* filtres */
  const filtered = useMemo(() => {
    let list = codes
    if (tab) list = list.filter(c => computeStatut(c) === tab)
    if (search) {
      const q = search.trim().toUpperCase()
      list = list.filter(c => c.code.includes(q) || c.description?.toUpperCase().includes(q))
    }
    return list
  }, [codes, tab, search])

  const counts = useMemo(() => ({
    actif:   codes.filter(c => computeStatut(c) === 'actif').length,
    inactif: codes.filter(c => computeStatut(c) === 'inactif').length,
    expire:  codes.filter(c => computeStatut(c) === 'expire').length,
  }), [codes])

  /* handlers */
  function ouvrirCreer() {
    setForm(INITIAL_FORM)
    setEditingId(null)
    setSection('general')
    setErreur(null)
    setModalOpen(true)
  }

  function ouvrirEditer(c: CodePromoRow) {
    setForm(formFromCode(c))
    setEditingId(c.id)
    setSection('general')
    setErreur(null)
    setModalOpen(true)
  }

  function fermerModal() {
    setModalOpen(false)
    setEditingId(null)
    setErreur(null)
  }

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function toggleStatut(c: CodePromoRow) {
    const stat = computeStatut(c)
    if (stat === 'expire') return
    const next = stat === 'actif' ? 'inactif' : 'actif'
    setCodes(prev => prev.map(p => p.id === c.id ? { ...p, statut: next } : p))
    const res = await fetch(`/api/business/codes-promo/${c.id}/statut`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: next }),
    })
    if (!res.ok) {
      setCodes(prev => prev.map(p => p.id === c.id ? { ...p, statut: c.statut } : p))
    }
  }

  async function dupliquer(c: CodePromoRow) {
    const res = await fetch(`/api/business/codes-promo/${c.id}/dupliquer`, { method: 'POST' })
    if (res.ok) router.refresh()
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.valeur) return
    setLoading(true)
    setErreur(null)

    const payload = {
      code:                    form.code.trim().toUpperCase(),
      description:             form.description || null,
      type_remise:             form.typeRemise,
      type_valeur:             form.typeValeur,
      valeur:                  parseFloat(form.valeur),
      mensualites:             form.typeRemise === 'abonnement'
        ? (form.mensualitesMode === 'illimite' ? null : parseInt(form.mensualites) || null)
        : null,
      date_debut:              form.dateDebut ? `${form.dateDebut}T${form.heureDebut || '00:00'}:00` : null,
      date_expiration:         form.dateExpiration ? `${form.dateExpiration}T${form.heureExpiration || '23:59'}:00` : null,
      depense_min:             form.depenseMin ? parseFloat(form.depenseMin) : null,
      depense_max:             form.depenseMax ? parseFloat(form.depenseMax) : null,
      premiere_commande:       form.premiereCommande,
      utilisation_individuelle: form.utilisationIndividuelle,
      beats_inclus:            form.modeBeats === 'inclure' ? form.beatsSelectionnes : null,
      beats_exclus:            form.modeBeats === 'exclure' ? form.beatsSelectionnes : [],
      licences_eligibles:      form.licencesMode === 'specifiques' ? form.licencesSelectionnees : null,
      emails_autorises:        form.emailsAutorises.split('\n').map(e => e.trim()).filter(Boolean),
      emails_exclus:           form.emailsExclus.split('\n').map(e => e.trim()).filter(Boolean),
      limite_par_code:         form.limiteParCode ? parseInt(form.limiteParCode) : null,
      limite_par_article:      form.limiteParArticle ? parseInt(form.limiteParArticle) : null,
      limite_par_utilisateur:  form.limiteParUtilisateur ? parseInt(form.limiteParUtilisateur) : null,
    }

    const url    = editingId ? `/api/business/codes-promo/${editingId}` : '/api/business/codes-promo'
    const method = editingId ? 'PATCH' : 'POST'
    const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data   = await res.json()

    if (!res.ok) {
      setErreur(data.erreur ?? 'Erreur inconnue')
      setLoading(false)
      return
    }

    setLoading(false)
    fermerModal()
    router.refresh()
  }

  /* ── rendu liste ─────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Codes promo</h1>
          <p className="text-sm text-gray-500 mt-0.5">Remises et offres spéciales</p>
        </div>
        <button
          onClick={ouvrirCreer}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Créer un code
        </button>
      </div>

      {/* tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {([['', 'Tous', codes.length], ['actif', 'Actif', counts.actif], ['inactif', 'Inactif', counts.inactif], ['expire', 'Expiré', counts.expire]] as [UIStatut | '', string, number][]).map(([v, l, n]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === v
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {l}
            <span className="ml-1.5 text-xs text-gray-600">{n}</span>
          </button>
        ))}
      </div>

      {/* search */}
      <div className="mb-4">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un code…"
          className="w-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Code', 'Type', 'Remise', 'État', 'Applicable sur', 'Utilisations', 'Expiration', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-600 text-sm">
                  Aucun code promo trouvé
                </td>
              </tr>
            )}
            {filtered.map(c => {
              const statut = computeStatut(c)
              return (
                <tr key={c.id} className="group hover:bg-gray-800/30 transition-colors">
                  {/* code */}
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/business/codes-promo/${c.id}`} className="font-mono font-bold text-white hover:text-indigo-400 transition-colors">
                      {c.code}
                    </Link>
                    {c.description && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[180px] truncate">{c.description}</p>
                    )}
                    {c.emails_autorises.length > 0 && (
                      <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                        Restreint ({c.emails_autorises.length} email{c.emails_autorises.length > 1 ? 's' : ''})
                      </span>
                    )}
                    {c.emails_exclus.length > 0 && (
                      <span className="inline-block mt-1 ml-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        {c.emails_exclus.length} exclu{c.emails_exclus.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>

                  {/* type */}
                  <td className="px-4 py-3 text-gray-400">
                    <span className="capitalize">{c.type_remise}</span>
                    {c.type_remise === 'abonnement' && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {c.mensualites == null ? 'Illimité' : `${c.mensualites} mensualité${c.mensualites > 1 ? 's' : ''}`}
                      </p>
                    )}
                  </td>

                  {/* remise */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-white">{formatRemise(c)}</span>
                    {c.depense_min != null && (
                      <p className="text-xs text-gray-600 mt-0.5">Min {c.depense_min}€</p>
                    )}
                  </td>

                  {/* état */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatut(c)}
                      disabled={statut === 'expire'}
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[statut]} ${statut !== 'expire' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      {STATUT_LABEL[statut]}
                    </button>
                  </td>

                  {/* applicable sur */}
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {c.beats_inclus?.length
                      ? `${c.beats_inclus.length} beat${c.beats_inclus.length > 1 ? 's' : ''}`
                      : c.beats_exclus?.length
                      ? `Catalogue −${c.beats_exclus.length} exclu${c.beats_exclus.length > 1 ? 's' : ''}`
                      : c.licences_eligibles?.length
                      ? c.licences_eligibles.join(', ')
                      : 'Tout le catalogue'}
                  </td>

                  {/* utilisations */}
                  <td className="px-4 py-3 text-right text-gray-400">
                    {c.utilisations}{c.limite_par_code != null ? ` / ${c.limite_par_code}` : ''}
                  </td>

                  {/* expiration */}
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(c.date_expiration)}
                  </td>

                  {/* actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => ouvrirEditer(c)} className="text-xs text-gray-500 hover:text-white transition-colors">
                        Éditer
                      </button>
                      <button onClick={() => dupliquer(c)} className="text-xs text-gray-500 hover:text-indigo-400 transition-colors">
                        Dupliquer
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── modal ────────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && fermerModal()}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">

            {/* header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="font-semibold text-white">{editingId ? 'Modifier le code' : 'Créer un code promo'}</h2>
              <button onClick={fermerModal} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>

            {/* body */}
            <div className="flex flex-1 overflow-hidden">

              {/* sidebar sections */}
              <nav className="w-44 border-r border-gray-800 p-3 flex flex-col gap-0.5 flex-shrink-0 overflow-y-auto">
                {SECTIONS.map(s => {
                  const hasDonnees = sectionHasDonnees(s.key, form)
                  const isActive   = activeSection === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSection(s.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${
                        isActive ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        s.required && !form.code && s.key === 'general' ? 'bg-red-500' :
                        s.required && !form.valeur && s.key === 'valeur' ? 'bg-red-500' :
                        hasDonnees ? 'bg-indigo-500' :
                        'bg-gray-700'
                      }`} />
                      {s.label}
                      {s.required && <span className="ml-auto text-red-500 text-[10px]">*</span>}
                    </button>
                  )
                })}
              </nav>

              {/* section content */}
              <div className="flex-1 overflow-y-auto p-6">
                <SectionContent
                  activeSection={activeSection}
                  form={form}
                  setF={setF}
                  licences={licences}
                  beats={beats}
                />
              </div>
            </div>

            {/* footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0">
              {erreur && <p className="text-xs text-red-400">{erreur}</p>}
              {!erreur && <span />}
              <div className="flex gap-3">
                <button onClick={fermerModal} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.code.trim() || !form.valeur || loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Enregistrement…' : editingId ? 'Enregistrer' : 'Créer le code'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── contenu des sections ───────────────────────────────────────── */

function SectionContent({
  activeSection, form, setF, licences, beats,
}: {
  activeSection: string
  form: FormData
  setF: <K extends keyof FormData>(key: K, val: FormData[K]) => void
  licences: LicenceOption[]
  beats: BeatOption[]
}) {
  const inputCls = 'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500'
  const labelCls = 'block text-xs font-medium text-gray-400 mb-1.5'
  const helpCls  = 'text-[11px] text-gray-600 mt-1'

  /* Général */
  if (activeSection === 'general') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Code <span className="text-red-500">*</span></label>
        <div className="flex gap-2">
          <input
            value={form.code}
            onChange={e => setF('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-_]/g, ''))}
            placeholder="ex : PROMO20"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => setF('code', genererCode())}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 hover:border-gray-600 transition-colors whitespace-nowrap"
          >
            Générer
          </button>
        </div>
      </div>
      <div>
        <label className={labelCls}>Description <span className="text-gray-600 font-normal">(usage interne)</span></label>
        <input
          value={form.description}
          onChange={e => setF('description', e.target.value)}
          placeholder="Note interne…"
          className={inputCls}
        />
      </div>
    </div>
  )

  /* Type de remise */
  if (activeSection === 'type') return (
    <div className="space-y-3">
      <p className={labelCls}>Choisissez le type de remise</p>
      {([
        ['panier',      'Panier',      'Remise sur le total du panier (% ou €)'],
        ['produit',     'Produit',     'Remise sur un ou plusieurs beats spécifiques'],
        ['abonnement',  'Abonnement',  'Remise sur les mensualités de l\'abonnement'],
      ] as [FormData['typeRemise'], string, string][]).map(([v, l, desc]) => (
        <button
          key={v}
          type="button"
          onClick={() => setF('typeRemise', v)}
          className={`w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-colors ${
            form.typeRemise === v
              ? 'bg-indigo-600/15 border-indigo-500/40 text-white'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <span className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
            form.typeRemise === v ? 'border-indigo-400' : 'border-gray-600'
          }`}>
            {form.typeRemise === v && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
          </span>
          <div>
            <p className="font-medium text-sm">{l}</p>
            <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
          </div>
        </button>
      ))}
    </div>
  )

  /* Valeur */
  if (activeSection === 'valeur') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Type de valeur</label>
        <select value={form.typeValeur} onChange={e => setF('typeValeur', e.target.value as FormData['typeValeur'])} className={inputCls}>
          <option value="pourcentage">Pourcentage (%)</option>
          <option value="montant">Montant fixe (€)</option>
        </select>
      </div>
      <div>
        <label className={labelCls}>Valeur <span className="text-red-500">*</span></label>
        <div className="relative">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.valeur}
            onChange={e => setF('valeur', e.target.value)}
            placeholder={form.typeValeur === 'pourcentage' ? '20' : '9.99'}
            className={inputCls + ' pr-8'}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            {form.typeValeur === 'pourcentage' ? '%' : '€'}
          </span>
        </div>
      </div>
      {form.typeRemise === 'abonnement' && (
        <div>
          <label className={labelCls}>Durée de la remise</label>
          <div className="flex gap-2 mb-3">
            {(['illimite', 'defini'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setF('mensualitesMode', v)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  form.mensualitesMode === v
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
                }`}
              >
                {v === 'illimite' ? 'Illimité' : 'Nombre défini'}
              </button>
            ))}
          </div>
          {form.mensualitesMode === 'defini' && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={form.mensualites}
                onChange={e => setF('mensualites', e.target.value)}
                placeholder="ex : 3"
                className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              />
              <span className="text-sm text-gray-500">mensualité{parseInt(form.mensualites) > 1 ? 's' : ''}</span>
            </div>
          )}
          <p className={helpCls}>La durée n'est applicable que pour les remises sur abonnement récurrent.</p>
        </div>
      )}
    </div>
  )

  /* Dates */
  if (activeSection === 'dates') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Date de début</label>
        <input type="date" value={form.dateDebut} onChange={e => setF('dateDebut', e.target.value)} className={inputCls} />
        {form.dateDebut && (
          <input type="time" value={form.heureDebut} onChange={e => setF('heureDebut', e.target.value)} className={inputCls + ' mt-2'} />
        )}
        <p className={helpCls}>Laisser vide pour une validité immédiate.</p>
      </div>
      <div>
        <label className={labelCls}>Date d'expiration</label>
        <input type="date" value={form.dateExpiration} onChange={e => setF('dateExpiration', e.target.value)} className={inputCls} />
        {form.dateExpiration && (
          <input type="time" value={form.heureExpiration} onChange={e => setF('heureExpiration', e.target.value)} className={inputCls + ' mt-2'} />
        )}
        <p className={helpCls}>Laisser vide pour qu'il n'expire jamais.</p>
      </div>
    </div>
  )

  /* Licences */
  if (activeSection === 'licences') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={labelCls + ' mb-0'}>Licences éligibles</p>
        <button
          type="button"
          onClick={() => setF('licencesMode', form.licencesMode === 'toutes' ? 'specifiques' : 'toutes')}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {form.licencesMode === 'toutes' ? 'Sélectionner des licences spécifiques' : 'Toutes les licences'}
        </button>
      </div>

      {form.licencesMode === 'toutes' ? (
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400">
          Applicable sur toutes les licences
          {licences.length > 0 && (
            <span className="text-gray-600"> ({licences.map(l => l.nom).join(', ')})</span>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {licences.length === 0 ? (
            <p className="text-sm text-gray-600">Aucune licence active trouvée.</p>
          ) : licences.map(l => {
            const selected = form.licencesSelectionnees.includes(l.nom)
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  const next = selected
                    ? form.licencesSelectionnees.filter(n => n !== l.nom)
                    : [...form.licencesSelectionnees, l.nom]
                  setF('licencesSelectionnees', next)
                }}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                  selected
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}
              >
                {l.nom}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )

  /* Restrictions */
  if (activeSection === 'restrictions') return (
    <div className="space-y-6">
      {/* panier */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Panier</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dépense minimale (€)</label>
            <input type="number" min="0" step="0.01" value={form.depenseMin} onChange={e => setF('depenseMin', e.target.value)} placeholder="Aucun minimum" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Dépense maximale (€)</label>
            <input type="number" min="0" step="0.01" value={form.depenseMax} onChange={e => setF('depenseMax', e.target.value)} placeholder="Aucun maximum" className={inputCls} />
          </div>
        </div>
      </div>

      {/* comportement */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Comportement</p>
        <div className="space-y-3">
          {([
            ['premiereCommande',       'Première commande uniquement (nouveaux clients)'],
            ['utilisationIndividuelle','Non combinable avec d\'autres codes promo'],
          ] as [keyof FormData, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setF(key as 'premiereCommande' | 'utilisationIndividuelle', !form[key] as boolean)}
                className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ${form[key] ? 'bg-indigo-600' : 'bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* beats */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Produits</p>
        <div className="flex gap-2 mb-3">
          {(['tous', 'inclure', 'exclure'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => { setF('modeBeats', v); if (v === 'tous') setF('beatsSelectionnes', []) }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                form.modeBeats === v
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'
              }`}
            >
              {v === 'tous' ? 'Tous les beats' : v === 'inclure' ? 'Inclure des beats' : 'Exclure des beats'}
            </button>
          ))}
        </div>
        {form.modeBeats !== 'tous' && (
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
            {beats.map(b => {
              const selected = form.beatsSelectionnes.includes(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    const next = selected
                      ? form.beatsSelectionnes.filter(id => id !== b.id)
                      : [...form.beatsSelectionnes, b.id]
                    setF('beatsSelectionnes', next)
                  }}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border text-left transition-colors ${
                    selected
                      ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: b.couleur ?? '#4f46e5' }}
                  />
                  <span className="truncate">{b.titre}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* clients */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Clients</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Emails autorisés</label>
            <textarea
              rows={3}
              value={form.emailsAutorises}
              onChange={e => setF('emailsAutorises', e.target.value)}
              placeholder={'exemple@gmail.com\nautre@hotmail.fr'}
              className={inputCls + ' resize-none font-mono text-xs'}
            />
            <p className={helpCls}>Un email par ligne. Laisser vide = ouvert à tous.</p>
          </div>
          <div>
            <label className={labelCls}>Emails exclus</label>
            <textarea
              rows={3}
              value={form.emailsExclus}
              onChange={e => setF('emailsExclus', e.target.value)}
              placeholder="exemple@gmail.com"
              className={inputCls + ' resize-none font-mono text-xs'}
            />
          </div>
        </div>
      </div>
    </div>
  )

  /* Limites */
  if (activeSection === 'limites') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Limite par code</label>
        <input type="number" min="1" value={form.limiteParCode} onChange={e => setF('limiteParCode', e.target.value)} placeholder="Illimitée" className={inputCls} />
        <p className={helpCls}>Nombre total d'utilisations avant que le code ne soit invalide.</p>
      </div>
      <div>
        <label className={labelCls}>Limite par article</label>
        <input type="number" min="1" value={form.limiteParArticle} onChange={e => setF('limiteParArticle', e.target.value)} placeholder="Tous les articles éligibles" className={inputCls} />
        <p className={helpCls}>Nombre max d'articles du panier sur lesquels la remise s'applique.</p>
      </div>
      <div>
        <label className={labelCls}>Limite par utilisateur</label>
        <input type="number" min="1" value={form.limiteParUtilisateur} onChange={e => setF('limiteParUtilisateur', e.target.value)} placeholder="Illimitée" className={inputCls} />
        <p className={helpCls}>Nombre de fois qu'un même utilisateur peut utiliser ce code (identifié par e-mail).</p>
      </div>
    </div>
  )

  return null
}
