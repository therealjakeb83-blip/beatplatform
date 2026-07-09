'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { CodePromoRow, LicenceOption, BeatOption } from '../../page'

/* ─── types ─────────────────────────────────────────────────────── */

type CommandeDetail = {
  id: string
  created_at: string
  prix_paye: number
  reduction_montant: number | null
  statut: 'en_attente' | 'payee' | 'remboursee' | 'litige'
  clients: { id: string; prenom: string | null; nom: string; nom_artiste: string | null } | null
  beats: { titre: string } | null
  licences: { nom: string } | null
  nbArticles: number
}

type FormData = {
  code: string; description: string
  typeRemise: 'panier' | 'produit' | 'abonnement'
  typeValeur: 'pourcentage' | 'montant'; valeur: string
  mensualitesMode: 'illimite' | 'defini'; mensualites: string
  dateDebut: string; heureDebut: string
  dateExpiration: string; heureExpiration: string
  licencesMode: 'toutes' | 'specifiques'; licencesSelectionnees: string[]
  depenseMin: string; depenseMax: string
  premiereCommande: boolean; utilisationIndividuelle: boolean
  modeBeats: 'tous' | 'inclure' | 'exclure'; beatsSelectionnes: string[]
  emailsAutorises: string; emailsExclus: string
  limiteParCode: string; limiteParArticle: string; limiteParUtilisateur: string
}

/* ─── constants ──────────────────────────────────────────────────── */

const STATUT_BADGE: Record<string, string> = {
  actif:       'bg-green-500/15 text-green-400 border border-green-500/20',
  inactif:     'bg-gray-500/15  text-gray-400  border border-gray-500/20',
  expire:      'bg-red-500/15   text-red-400   border border-red-500/20',
  en_attente:  'text-amber-400',
  payee:       'text-green-400',
  remboursee:  'text-orange-400',
  litige:      'text-red-400',
}

const STATUT_LABEL: Record<string, string> = {
  actif: 'Actif', inactif: 'Inactif', expire: 'Expiré',
  en_attente: 'En attente', payee: 'Payée', remboursee: 'Remboursée', litige: 'Litige',
}

const SECTIONS = [
  { key: 'general', label: 'Général', required: true },
  { key: 'type', label: 'Type de remise', required: false },
  { key: 'valeur', label: 'Valeur', required: true },
  { key: 'dates', label: 'Dates', required: false },
  { key: 'licences', label: 'Licences', required: false },
  { key: 'restrictions', label: 'Restrictions', required: false },
  { key: 'limites', label: 'Limites', required: false },
]

/* ─── helpers ────────────────────────────────────────────────────── */

function computeStatut(c: CodePromoRow): string {
  if (c.date_expiration && new Date(c.date_expiration) < new Date()) return 'expire'
  return c.statut
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nomClient(c: CommandeDetail): string {
  if (c.clients) {
    const nom = c.clients.nom_artiste || [c.clients.prenom, c.clients.nom].filter(Boolean).join(' ')
    return nom || '—'
  }
  return '—'
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
    code: c.code, description: c.description ?? '',
    typeRemise: c.type_remise, typeValeur: c.type_valeur, valeur: String(c.valeur),
    mensualitesMode: c.mensualites == null ? 'illimite' : 'defini',
    mensualites: c.mensualites != null ? String(c.mensualites) : '',
    dateDebut: parseDatePart(c.date_debut, 'date'), heureDebut: parseDatePart(c.date_debut, 'time'),
    dateExpiration: parseDatePart(c.date_expiration, 'date'), heureExpiration: parseDatePart(c.date_expiration, 'time'),
    licencesMode: c.licences_eligibles?.length ? 'specifiques' : 'toutes',
    licencesSelectionnees: c.licences_eligibles ?? [],
    depenseMin: c.depense_min != null ? String(c.depense_min) : '',
    depenseMax: c.depense_max != null ? String(c.depense_max) : '',
    premiereCommande: c.premiere_commande, utilisationIndividuelle: c.utilisation_individuelle,
    modeBeats: c.beats_inclus?.length ? 'inclure' : c.beats_exclus?.length ? 'exclure' : 'tous',
    beatsSelectionnes: c.beats_inclus ?? c.beats_exclus ?? [],
    emailsAutorises: c.emails_autorises.join('\n'), emailsExclus: c.emails_exclus.join('\n'),
    limiteParCode: c.limite_par_code != null ? String(c.limite_par_code) : '',
    limiteParArticle: c.limite_par_article != null ? String(c.limite_par_article) : '',
    limiteParUtilisateur: c.limite_par_utilisateur != null ? String(c.limite_par_utilisateur) : '',
  }
}

function sectionHasDonnees(key: string, f: FormData): boolean {
  switch (key) {
    case 'general': return !!f.description
    case 'valeur': return !!f.valeur
    case 'dates': return !!f.dateDebut || !!f.dateExpiration
    case 'licences': return f.licencesMode === 'specifiques' && f.licencesSelectionnees.length > 0
    case 'restrictions': return !!f.depenseMin || !!f.depenseMax || f.premiereCommande || f.utilisationIndividuelle || f.modeBeats !== 'tous' || !!f.emailsAutorises || !!f.emailsExclus
    case 'limites': return !!f.limiteParCode || !!f.limiteParArticle || !!f.limiteParUtilisateur
    default: return false
  }
}

/* ─── composant ──────────────────────────────────────────────────── */

export default function CodePromoDetailClient({
  code: initialCode, commandes, slug, caGenere, remiseAccordee, licences, beats,
}: {
  code: CodePromoRow
  commandes: CommandeDetail[]
  slug: string
  caGenere: number
  remiseAccordee: number
  licences: LicenceOption[]
  beats: BeatOption[]
}) {
  const router = useRouter()
  const [code, setCode]           = useState(initialCode)
  const [copied, setCopied]       = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [activeSection, setSection] = useState('general')
  const [form, setForm]           = useState<FormData>(formFromCode(initialCode))
  const [loading, setLoading]     = useState(false)
  const [erreur, setErreur]       = useState<string | null>(null)

  const statut    = computeStatut(code)
  const shareUrl  = typeof window !== 'undefined'
    ? `${window.location.origin}/${slug}?code=${code.code}`
    : `/${slug}?code=${code.code}`

  function setF<K extends keyof FormData>(key: K, val: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.valeur) return
    setLoading(true)
    setErreur(null)

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description || null,
      type_remise: form.typeRemise, type_valeur: form.typeValeur, valeur: parseFloat(form.valeur),
      mensualites: form.typeRemise === 'abonnement'
        ? (form.mensualitesMode === 'illimite' ? null : parseInt(form.mensualites) || null) : null,
      date_debut: form.dateDebut ? `${form.dateDebut}T${form.heureDebut || '00:00'}:00` : null,
      date_expiration: form.dateExpiration ? `${form.dateExpiration}T${form.heureExpiration || '23:59'}:00` : null,
      depense_min: form.depenseMin ? parseFloat(form.depenseMin) : null,
      depense_max: form.depenseMax ? parseFloat(form.depenseMax) : null,
      premiere_commande: form.premiereCommande, utilisation_individuelle: form.utilisationIndividuelle,
      beats_inclus: form.modeBeats === 'inclure' ? form.beatsSelectionnes : null,
      beats_exclus: form.modeBeats === 'exclure' ? form.beatsSelectionnes : [],
      licences_eligibles: form.licencesMode === 'specifiques' ? form.licencesSelectionnees : null,
      emails_autorises: form.emailsAutorises.split('\n').map(e => e.trim()).filter(Boolean),
      emails_exclus: form.emailsExclus.split('\n').map(e => e.trim()).filter(Boolean),
      limite_par_code: form.limiteParCode ? parseInt(form.limiteParCode) : null,
      limite_par_article: form.limiteParArticle ? parseInt(form.limiteParArticle) : null,
      limite_par_utilisateur: form.limiteParUtilisateur ? parseInt(form.limiteParUtilisateur) : null,
    }

    const res  = await fetch(`/api/business/codes-promo/${code.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()

    if (!res.ok) { setErreur(data.erreur ?? 'Erreur inconnue'); setLoading(false); return }

    setCode(data.code)
    setForm(formFromCode(data.code))
    setModalOpen(false)
    setLoading(false)
    router.refresh()
  }

  /* ── rendu ───────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
        <Link href="/dashboard/business/codes-promo" className="hover:text-gray-400 transition-colors">Codes promo</Link>
        <span>›</span>
        <span className="font-mono font-bold text-white">{code.code}</span>
      </div>

      {/* header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-mono text-2xl font-bold text-white">{code.code}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUT_BADGE[statut] ?? ''}`}>
              {STATUT_LABEL[statut] ?? statut}
            </span>
          </div>
          {code.description && <p className="text-sm text-gray-500">{code.description}</p>}
          <p className="text-xs text-gray-700 mt-1">
            Créé le {formatDateShort(code.created_at)}
          </p>
        </div>
        <button
          onClick={() => { setForm(formFromCode(code)); setSection('general'); setErreur(null); setModalOpen(true) }}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          Éditer
        </button>
      </div>

      {/* share URL */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl mb-6">
        <p className="text-xs font-mono text-gray-400 flex-1 truncate">{shareUrl}</p>
        <button onClick={copier} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0">
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Utilisations', value: code.limite_par_code != null ? `${code.utilisations} / ${code.limite_par_code}` : String(code.utilisations), cls: 'text-white' },
          { label: 'CA généré', value: `${caGenere.toFixed(2)}€`, cls: 'text-white' },
          { label: 'Remise accordée', value: `−${remiseAccordee.toFixed(2)}€`, cls: 'text-red-400' },
        ].map(k => (
          <div key={k.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.cls}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* configuration */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Configuration</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Type de remise" value={<span className="capitalize">{code.type_remise}</span>} />
          <Row label="Valeur" value={code.type_valeur === 'pourcentage' ? `${code.valeur}%` : `${code.valeur}€`} />
          {code.type_remise === 'abonnement' && (
            <Row label="Durée" value={code.mensualites == null ? 'Illimitée' : `${code.mensualites} mensualité${code.mensualites > 1 ? 's' : ''}`} />
          )}
          <Row label="Date de début" value={formatDate(code.date_debut)} />
          <Row label="Expiration" value={formatDate(code.date_expiration)} />
          {code.depense_min != null && <Row label="Panier minimum" value={`${code.depense_min}€`} />}
          {code.depense_max != null && <Row label="Panier maximum" value={`${code.depense_max}€`} />}
          {code.limite_par_code != null && <Row label="Limite par code" value={String(code.limite_par_code)} />}
          {code.limite_par_article != null && <Row label="Limite par article" value={String(code.limite_par_article)} />}
          {code.limite_par_utilisateur != null && <Row label="Limite par utilisateur" value={String(code.limite_par_utilisateur)} />}

          {/* restrictions */}
          <div className="col-span-2 flex flex-wrap gap-2 pt-1">
            {code.premiere_commande && <Pill label="Première commande uniquement" cls="bg-gray-800 text-gray-400 border-gray-700" />}
            {code.utilisation_individuelle && <Pill label="Non combinable" cls="bg-gray-800 text-gray-400 border-gray-700" />}
          </div>

          {/* beats */}
          {code.beats_inclus?.length ? (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1.5">Beats inclus</p>
              <div className="flex flex-wrap gap-1.5">
                {code.beats_inclus.map(id => <Pill key={id} label={id.slice(0, 8)} cls="bg-indigo-600/15 text-indigo-400 border-indigo-500/30" />)}
              </div>
            </div>
          ) : code.beats_exclus?.length ? (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1.5">Beats exclus</p>
              <div className="flex flex-wrap gap-1.5">
                {code.beats_exclus.map(id => <Pill key={id} label={id.slice(0, 8)} cls="bg-red-500/15 text-red-400 border-red-500/30" />)}
              </div>
            </div>
          ) : null}

          {/* licences */}
          {code.licences_eligibles?.length ? (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1.5">Licences éligibles</p>
              <div className="flex flex-wrap gap-1.5">
                {code.licences_eligibles.map(n => <Pill key={n} label={n} cls="bg-gray-800 text-gray-400 border-gray-700 font-mono" />)}
              </div>
            </div>
          ) : null}

          {/* emails */}
          {code.emails_autorises.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1.5">Emails autorisés</p>
              <div className="flex flex-wrap gap-1.5">
                {code.emails_autorises.map(e => <Pill key={e} label={e} cls="bg-indigo-600/15 text-indigo-400 border-indigo-500/30 font-mono" />)}
              </div>
            </div>
          )}
          {code.emails_exclus.length > 0 && (
            <div className="col-span-2">
              <p className="text-xs text-gray-600 mb-1.5">Emails exclus</p>
              <div className="flex flex-wrap gap-1.5">
                {code.emails_exclus.map(e => <Pill key={e} label={e} cls="bg-red-500/15 text-red-400 border-red-500/30 font-mono" />)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* commandes */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Commandes ({commandes.length})</h2>
        </div>
        {commandes.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-600">
            Aucune commande n'a encore utilisé ce code
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['N°', 'Client', 'Beat · Licence', 'Montant', 'Date', 'Statut'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {commandes.map(c => (
                <tr key={c.id} className="hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {c.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-white">
                    {c.clients
                      ? <Link href={`/dashboard/business/contacts/${c.clients.id}`} className="hover:text-indigo-400 transition-colors">{nomClient(c)}</Link>
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {c.beats?.titre ?? '—'}{c.licences?.nom ? ` · ${c.licences.nom}` : ''}
                    {c.nbArticles > 1 && ` +${c.nbArticles - 1}`}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-white">{c.prix_paye.toFixed(2)}€</p>
                    {c.reduction_montant != null && c.reduction_montant > 0 && (
                      <p className="text-xs text-green-400">−{c.reduction_montant.toFixed(2)}€</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDateShort(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${STATUT_BADGE[c.statut] ?? 'text-gray-400'}`}>
                      {STATUT_LABEL[c.statut] ?? c.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* modal édition */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 flex-shrink-0">
              <h2 className="font-semibold text-white">Modifier le code</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="flex flex-1 overflow-hidden">
              <nav className="w-44 border-r border-gray-800 p-3 flex flex-col gap-0.5 flex-shrink-0 overflow-y-auto">
                {SECTIONS.map(s => {
                  const hasDonnees = sectionHasDonnees(s.key, form)
                  const isActive   = activeSection === s.key
                  return (
                    <button key={s.key} onClick={() => setSection(s.key)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors ${isActive ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/40'}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasDonnees ? 'bg-indigo-500' : 'bg-gray-700'}`} />
                      {s.label}
                      {s.required && <span className="ml-auto text-red-500 text-[10px]">*</span>}
                    </button>
                  )
                })}
              </nav>
              <div className="flex-1 overflow-y-auto p-6">
                <EditSectionContent activeSection={activeSection} form={form} setF={setF} licences={licences} beats={beats} />
              </div>
            </div>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 flex-shrink-0">
              {erreur ? <p className="text-xs text-red-400">{erreur}</p> : <span />}
              <div className="flex gap-3">
                <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors">Annuler</button>
                <button onClick={handleSubmit} disabled={!form.code.trim() || !form.valeur || loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── sous-composants ────────────────────────────────────────────── */

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <p className="text-gray-600 text-xs">{label}</p>
      <p className="text-gray-300 text-xs">{value}</p>
    </>
  )
}

function Pill({ label, cls }: { label: string; cls: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] border ${cls}`}>{label}</span>
  )
}

/* Réutilisation du contenu des sections de la modale */
function EditSectionContent({
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

  if (activeSection === 'general') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Code <span className="text-red-500">*</span></label>
        <div className="flex gap-2">
          <input value={form.code} onChange={e => setF('code', e.target.value.toUpperCase().replace(/[^A-Z0-9-_]/g, ''))} placeholder="ex : PROMO20" className={inputCls} />
          <button type="button" onClick={() => setF('code', genererCode())} className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-indigo-400 hover:text-indigo-300 transition-colors whitespace-nowrap">Générer</button>
        </div>
      </div>
      <div>
        <label className={labelCls}>Description <span className="text-gray-600 font-normal">(usage interne)</span></label>
        <input value={form.description} onChange={e => setF('description', e.target.value)} placeholder="Note interne…" className={inputCls} />
      </div>
    </div>
  )

  if (activeSection === 'type') return (
    <div className="space-y-3">
      {(['panier', 'produit', 'abonnement'] as const).map(v => (
        <button key={v} type="button" onClick={() => setF('typeRemise', v)}
          className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-colors capitalize ${form.typeRemise === v ? 'bg-indigo-600/15 border-indigo-500/40 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
        >
          <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${form.typeRemise === v ? 'border-indigo-400' : 'border-gray-600'}`}>
            {form.typeRemise === v && <span className="w-2 h-2 rounded-full bg-indigo-400" />}
          </span>
          {v}
        </button>
      ))}
    </div>
  )

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
          <input type="number" min="0" step="0.01" value={form.valeur} onChange={e => setF('valeur', e.target.value)} placeholder={form.typeValeur === 'pourcentage' ? '20' : '9.99'} className={inputCls + ' pr-8'} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{form.typeValeur === 'pourcentage' ? '%' : '€'}</span>
        </div>
      </div>
      {form.typeRemise === 'abonnement' && (
        <div>
          <label className={labelCls}>Durée</label>
          <div className="flex gap-2 mb-3">
            {(['illimite', 'defini'] as const).map(v => (
              <button key={v} type="button" onClick={() => setF('mensualitesMode', v)}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${form.mensualitesMode === v ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'}`}
              >{v === 'illimite' ? 'Illimité' : 'Nombre défini'}</button>
            ))}
          </div>
          {form.mensualitesMode === 'defini' && (
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={form.mensualites} onChange={e => setF('mensualites', e.target.value)} placeholder="ex : 3" className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500" />
              <span className="text-sm text-gray-500">mensualité{parseInt(form.mensualites) > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )

  if (activeSection === 'dates') return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Date de début</label>
        <input type="date" value={form.dateDebut} onChange={e => setF('dateDebut', e.target.value)} className={inputCls} />
        {form.dateDebut && <input type="time" value={form.heureDebut} onChange={e => setF('heureDebut', e.target.value)} className={inputCls + ' mt-2'} />}
        <p className={helpCls}>Laisser vide pour une validité immédiate.</p>
      </div>
      <div>
        <label className={labelCls}>Date d'expiration</label>
        <input type="date" value={form.dateExpiration} onChange={e => setF('dateExpiration', e.target.value)} className={inputCls} />
        {form.dateExpiration && <input type="time" value={form.heureExpiration} onChange={e => setF('heureExpiration', e.target.value)} className={inputCls + ' mt-2'} />}
        <p className={helpCls}>Laisser vide pour qu'il n'expire jamais.</p>
      </div>
    </div>
  )

  if (activeSection === 'licences') return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className={labelCls + ' mb-0'}>Licences éligibles</p>
        <button type="button" onClick={() => setF('licencesMode', form.licencesMode === 'toutes' ? 'specifiques' : 'toutes')} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
          {form.licencesMode === 'toutes' ? 'Sélectionner des licences spécifiques' : 'Toutes les licences'}
        </button>
      </div>
      {form.licencesMode === 'toutes' ? (
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl text-sm text-gray-400">
          Applicable sur toutes les licences{licences.length > 0 && <span className="text-gray-600"> ({licences.map(l => l.nom).join(', ')})</span>}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {licences.map(l => {
            const selected = form.licencesSelectionnees.includes(l.nom)
            return (
              <button key={l.id} type="button" onClick={() => setF('licencesSelectionnees', selected ? form.licencesSelectionnees.filter(n => n !== l.nom) : [...form.licencesSelectionnees, l.nom])}
                className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${selected ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
              >{l.nom}</button>
            )
          })}
        </div>
      )}
    </div>
  )

  if (activeSection === 'restrictions') return (
    <div className="space-y-6">
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
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Comportement</p>
        <div className="space-y-3">
          {(['premiereCommande', 'utilisationIndividuelle'] as const).map(key => (
            <label key={key} className="flex items-center gap-3 cursor-pointer">
              <div onClick={() => setF(key, !form[key])} className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative cursor-pointer ${form[key] ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm text-gray-400">{key === 'premiereCommande' ? 'Première commande uniquement' : 'Non combinable avec d\'autres codes'}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Produits</p>
        <div className="flex gap-2 mb-3">
          {(['tous', 'inclure', 'exclure'] as const).map(v => (
            <button key={v} type="button" onClick={() => { setF('modeBeats', v); if (v === 'tous') setF('beatsSelectionnes', []) }}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${form.modeBeats === v ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-300'}`}
            >{v === 'tous' ? 'Tous les beats' : v === 'inclure' ? 'Inclure des beats' : 'Exclure des beats'}</button>
          ))}
        </div>
        {form.modeBeats !== 'tous' && (
          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {beats.map(b => {
              const selected = form.beatsSelectionnes.includes(b.id)
              return (
                <button key={b.id} type="button" onClick={() => setF('beatsSelectionnes', selected ? form.beatsSelectionnes.filter(id => id !== b.id) : [...form.beatsSelectionnes, b.id])}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs border text-left transition-colors ${selected ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'}`}
                >
                  <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: b.couleur ?? '#4f46e5' }} />
                  <span className="truncate">{b.titre}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Clients</p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Emails autorisés</label>
            <textarea rows={3} value={form.emailsAutorises} onChange={e => setF('emailsAutorises', e.target.value)} placeholder={'exemple@gmail.com\nautre@hotmail.fr'} className={inputCls + ' resize-none font-mono text-xs'} />
            <p className={helpCls}>Un email par ligne. Vide = ouvert à tous.</p>
          </div>
          <div>
            <label className={labelCls}>Emails exclus</label>
            <textarea rows={3} value={form.emailsExclus} onChange={e => setF('emailsExclus', e.target.value)} placeholder="exemple@gmail.com" className={inputCls + ' resize-none font-mono text-xs'} />
          </div>
        </div>
      </div>
    </div>
  )

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
