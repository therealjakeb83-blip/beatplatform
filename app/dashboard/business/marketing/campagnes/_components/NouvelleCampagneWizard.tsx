'use client'

import { useState } from 'react'
import type { CibleOption, TemplateOption } from '../page'

type CibleMode = 'segment' | 'liste' | 'manuel'

type Props = {
  segments: CibleOption[]
  listes: CibleOption[]
  templates: TemplateOption[]
  segmentInitial?: string | null
  onClose: () => void
  onCreate: (fd: FormData) => Promise<void>
}

const CATEGORIE_LABEL: Record<string, string> = {
  newsletter:   'Newsletter',
  promotion:    'Promotion',
  reactivation: 'Réactivation',
  annonce:      'Annonce',
  abonnement:   'Abonnement',
}

const CATEGORIE_CLS: Record<string, string> = {
  newsletter:   'bg-indigo-500/15 text-indigo-400',
  promotion:    'bg-red-500/15 text-red-400',
  reactivation: 'bg-cyan-500/15 text-cyan-400',
  annonce:      'bg-gray-700 text-gray-300',
  abonnement:   'bg-green-500/15 text-green-400',
}

export default function NouvelleCampagneWizard({ segments, listes, templates, segmentInitial, onClose, onCreate }: Props) {
  const [step, setStep] = useState(1)

  const [cibleMode, setCibleMode] = useState<CibleMode>(segmentInitial ? 'segment' : 'segment')
  const [cibleId,   setCibleId]   = useState<string>(segmentInitial ?? '')
  const [emailsRaw, setEmailsRaw] = useState('')

  const [nom,   setNom]   = useState('')
  const [objet, setObjet] = useState('')

  const [templateId, setTemplateId] = useState('')
  const [pending, setPending] = useState(false)

  const nbManuel = emailsRaw.split(/[\n,]+/).map(e => e.trim()).filter(Boolean).length

  const cibleValide = cibleMode === 'manuel' ? nbManuel > 0 : !!cibleId
  const objetValide = nom.trim().length > 0 && objet.trim().length > 0
  const templateValide = !!templateId

  async function handleSubmit() {
    if (!templateValide) return
    setPending(true)
    const fd = new FormData()
    fd.append('cible_mode', cibleMode)
    if (cibleMode === 'manuel') fd.append('cible_emails', emailsRaw)
    else fd.append('cible_id', cibleId)
    fd.append('nom', nom.trim())
    fd.append('objet', objet.trim())
    fd.append('template_id', templateId)
    await onCreate(fd)
    setPending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header + étapes */}
        <div className="px-6 py-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Nouvelle campagne</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {['Destinataires', 'Objet', 'Template'].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === i + 1 ? 'bg-indigo-600 text-white' : step > i + 1 ? 'bg-indigo-600/40 text-indigo-300' : 'bg-gray-800 text-gray-500'
                }`}>
                  {i + 1}
                </span>
                <span className={step === i + 1 ? 'text-white font-medium' : 'text-gray-500'}>{label}</span>
                {i < 2 && <span className="text-gray-700 mx-1">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Contenu de l'étape */}
        <div className="flex-1 overflow-auto px-6 py-5">
          {step === 1 && (
            <div>
              <div className="flex gap-2 mb-4">
                {(['segment', 'liste', 'manuel'] as CibleMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setCibleMode(mode); setCibleId('') }}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                      cibleMode === mode ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {mode === 'segment' ? 'Segments' : mode === 'liste' ? 'Listes' : 'Manuel'}
                  </button>
                ))}
              </div>

              {cibleMode === 'segment' && (
                <div className="flex flex-col gap-1.5">
                  {segments.length === 0 && <p className="text-xs text-gray-600">Aucun segment créé pour l&apos;instant.</p>}
                  {segments.map(s => (
                    <label key={s.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      cibleId === s.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-700'
                    }`}>
                      <span className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="segment" checked={cibleId === s.id} onChange={() => setCibleId(s.id)} className="accent-indigo-500" />
                        {s.nom}
                      </span>
                      <span className="text-xs text-gray-500">{s.count} inscrit{s.count > 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              )}

              {cibleMode === 'liste' && (
                <div className="flex flex-col gap-1.5">
                  {listes.length === 0 && <p className="text-xs text-gray-600">Aucune liste créée pour l&apos;instant.</p>}
                  {listes.map(l => (
                    <label key={l.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      cibleId === l.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-700'
                    }`}>
                      <span className="flex items-center gap-2 text-sm text-white">
                        <input type="radio" name="liste" checked={cibleId === l.id} onChange={() => setCibleId(l.id)} className="accent-indigo-500" />
                        {l.nom}
                      </span>
                      <span className="text-xs text-gray-500">{l.count} inscrit{l.count > 1 ? 's' : ''}</span>
                    </label>
                  ))}
                </div>
              )}

              {cibleMode === 'manuel' && (
                <div>
                  <textarea
                    value={emailsRaw}
                    onChange={e => setEmailsRaw(e.target.value)}
                    placeholder="un email par ligne, ou séparés par des virgules"
                    rows={6}
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm"
                  />
                  <p className="text-[11px] text-gray-600 mt-2">
                    {nbManuel} email{nbManuel > 1 ? 's' : ''} saisi{nbManuel > 1 ? 's' : ''} — seuls ceux inscrits à la newsletter recevront la campagne.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Nom de la campagne (usage interne)</label>
                <input
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Newsletter Juillet 2026"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Objet de l&apos;email</label>
                <input
                  value={objet}
                  onChange={e => setObjet(e.target.value)}
                  placeholder="🎵 Nouveaux sons ce mois-ci"
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm"
                />
                <p className="text-[11px] text-gray-600 mt-1.5">
                  Tokens disponibles : {'{{prénom}}'}, {'{{style_préféré}}'}, {'{{type_beat_préféré}}'}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3">
              {templates.map(t => (
                <label key={t.id} className={`block px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                  templateId === t.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-800 hover:border-gray-700'
                }`}>
                  <input type="radio" name="template" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} className="sr-only" />
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORIE_CLS[t.categorie] ?? 'bg-gray-700 text-gray-300'}`}>
                      {CATEGORIE_LABEL[t.categorie] ?? t.categorie}
                    </span>
                    {t.source === 'plateforme' && <span className="text-[10px] text-gray-600">Officiel</span>}
                  </div>
                  <p className="text-sm font-semibold text-white">{t.nom}</p>
                  {t.objet_defaut && <p className="text-xs text-gray-500 mt-0.5 truncate">{t.objet_defaut}</p>}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-6 py-4 border-t border-gray-800 flex-shrink-0 flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(1, s - 1))}
            disabled={step === 1}
            className="text-xs px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-gray-300 transition-colors"
          >
            ← Précédent
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !cibleValide : !objetValide}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-colors"
            >
              Suivant →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!templateValide || pending}
              className="text-xs px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-colors"
            >
              {pending ? 'Création…' : 'Créer le brouillon'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
