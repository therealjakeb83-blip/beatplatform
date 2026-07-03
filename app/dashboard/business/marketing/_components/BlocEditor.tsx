'use client'

import { useState } from 'react'
import type { BlocEmail } from '@/lib/email-blocs'

export type BeatOption = { id: string; titre: string; image_url: string | null }
export type ContactOption = { id: string; label: string }

type BlocAvecCle = { cle: string; bloc: BlocEmail }

type Props = {
  blocsInitiaux: BlocEmail[]
  beats: BeatOption[]
  contacts: ContactOption[]
  entete: React.ReactNode
  parametresSupplementaires?: React.ReactNode
  labelEnregistrer?: string
  onEnregistrer: (blocs: BlocEmail[]) => Promise<void>
  genererApercu: (blocs: BlocEmail[], clientId?: string) => Promise<string>
}

let compteurCle = 0
function nouvelleCle(): string {
  compteurCle += 1
  return `bloc_${compteurCle}_${Math.random().toString(36).slice(2, 7)}`
}

function blocParDefaut(type: BlocEmail['type']): BlocEmail {
  switch (type) {
    case 'header':        return { type, titre: 'Titre de la section', couleur_fond: '#4f46e5' }
    case 'texte':         return { type, contenu: 'Ton texte ici…' }
    case 'section_beats': return { type, titre: 'Nouveaux sons', sous_titre: '', colonnes: 2, source: 'nouveautes' }
    case 'code_promo':    return { type, description: '-10% sur ta prochaine commande', code: 'PROMO10' }
    case 'cta':           return { type, texte: 'Voir le catalogue', couleur: '#4f46e5', lien: '{{url_boutique}}' }
    case 'espace':        return { type, hauteur: 24 }
  }
}

const LABEL_TYPE: Record<BlocEmail['type'], string> = {
  header:        'En-tête',
  texte:         'Texte',
  section_beats: 'Section beats',
  code_promo:    'Code promo',
  cta:           'Bouton CTA',
  espace:        'Espace',
}

const PALETTE: { type: BlocEmail['type']; label: string; desc: string; icone: React.ReactNode }[] = [
  { type: 'header', label: 'En-tête', desc: 'Titre + fond coloré', icone: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="1" y="4" width="14" height="4" rx="1" /><rect x="1" y="10.5" width="9" height="1.5" rx="0.75" /></svg>
  ) },
  { type: 'texte', label: 'Texte', desc: 'Paragraphe libre', icone: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect y="2" width="14" height="1.5" rx="0.75" /><rect y="6" width="14" height="1.5" rx="0.75" /><rect y="10" width="9" height="1.5" rx="0.75" /></svg>
  ) },
  { type: 'section_beats', label: 'Section beats', desc: 'Grille 1 ou 2 col', icone: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
  ) },
  { type: 'code_promo', label: 'Code promo', desc: 'Code mis en avant', icone: (
    <svg viewBox="0 0 16 16" fill="currentColor"><path fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h4.086a1.5 1.5 0 0 1 1.06.44l5 5a1.5 1.5 0 0 1 0 2.12l-4.086 4.086a1.5 1.5 0 0 1-2.12 0l-5-5A1.5 1.5 0 0 1 2 7.586V3.5ZM5 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" /></svg>
  ) },
  { type: 'cta', label: 'Bouton CTA', desc: "Appel à l'action", icone: (
    <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="5" width="14" height="6" rx="3" /></svg>
  ) },
  { type: 'espace', label: 'Espace', desc: 'Séparateur vide', icone: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4"><rect y="7" width="16" height="1.5" rx="0.75" opacity="0.5" /></svg>
  ) },
]

const VARIABLES: { groupe: string; vars: string[] }[] = [
  { groupe: 'Contact',  vars: ['{{prénom}}', '{{nom}}', '{{email}}'] },
  { groupe: 'Boutique', vars: ['{{nom_boutique}}', '{{url_boutique}}'] },
  { groupe: 'Préférences', vars: ['{{style_préféré}}', '{{type_beat_préféré}}'] },
]

const champ = 'w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none transition-colors'
const label = 'text-[11px] text-gray-500 mb-1 block'

export default function BlocEditor({ blocsInitiaux, beats, contacts, entete, parametresSupplementaires, labelEnregistrer = 'Enregistrer', onEnregistrer, genererApercu }: Props) {
  const [blocs, setBlocs] = useState<BlocAvecCle[]>(() => blocsInitiaux.map(bloc => ({ cle: nouvelleCle(), bloc })))
  const [selectedCle, setSelectedCle] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copieVar, setCopieVar] = useState<string | null>(null)
  const [apercuOuvert, setApercuOuvert] = useState(false)
  const [apercuHtml, setApercuHtml] = useState('')
  const [chargementApercu, setChargementApercu] = useState(false)
  const [clientApercu, setClientApercu] = useState('')

  const selectedIndex = blocs.findIndex(b => b.cle === selectedCle)
  const selected = selectedIndex === -1 ? null : blocs[selectedIndex]

  function ajouterBloc(type: BlocEmail['type']) {
    const cle = nouvelleCle()
    setBlocs(prev => {
      const idx = selectedCle ? prev.findIndex(b => b.cle === selectedCle) : -1
      const insertAt = idx === -1 ? prev.length : idx + 1
      const copie = [...prev]
      copie.splice(insertAt, 0, { cle, bloc: blocParDefaut(type) })
      return copie
    })
    setSelectedCle(cle)
  }

  function updateBloc(cle: string, patch: Partial<BlocEmail>) {
    setBlocs(prev => prev.map(b => b.cle === cle ? { cle, bloc: { ...b.bloc, ...patch } as BlocEmail } : b))
  }

  function supprimerBloc(cle: string) {
    setBlocs(prev => prev.filter(b => b.cle !== cle))
    setSelectedCle(null)
  }

  function deplacerBloc(cle: string, direction: -1 | 1) {
    setBlocs(prev => {
      const idx = prev.findIndex(b => b.cle === cle)
      const cible = idx + direction
      if (idx === -1 || cible < 0 || cible >= prev.length) return prev
      const copie = [...prev]
      ;[copie[idx], copie[cible]] = [copie[cible], copie[idx]]
      return copie
    })
  }

  function copierVariable(v: string) {
    navigator.clipboard.writeText(v).catch(() => {})
    setCopieVar(v)
    setTimeout(() => setCopieVar(null), 1200)
  }

  async function handleEnregistrer() {
    setPending(true)
    await onEnregistrer(blocs.map(b => b.bloc))
    setPending(false)
  }

  async function chargerApercu(clientId: string) {
    setChargementApercu(true)
    try {
      const html = await genererApercu(blocs.map(b => b.bloc), clientId || undefined)
      setApercuHtml(html)
    } finally {
      setChargementApercu(false)
    }
  }

  async function handleOuvrirApercu() {
    setApercuOuvert(true)
    setClientApercu('')
    await chargerApercu('')
  }

  async function handleChangerClientApercu(clientId: string) {
    setClientApercu(clientId)
    await chargerApercu(clientId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Barre du haut */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0 gap-4">
        <div className="flex items-center gap-3 min-w-0">{entete}</div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleOuvrirApercu}
            disabled={chargementApercu}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-gray-300 font-medium transition-colors"
          >
            {chargementApercu ? 'Génération…' : 'Aperçu'}
          </button>
          <button
            onClick={handleEnregistrer}
            disabled={pending}
            className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold transition-colors"
          >
            {pending ? 'Enregistrement…' : labelEnregistrer}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Colonne gauche — bascule palette / réglages du bloc sélectionné */}
        <div className="w-72 border-r border-gray-800 overflow-y-auto flex-shrink-0">
          {selected ? (
            <PanneauReglages
              blocAvecCle={selected}
              index={selectedIndex}
              total={blocs.length}
              beats={beats}
              onRetour={() => setSelectedCle(null)}
              onUpdate={patch => updateBloc(selected.cle, patch)}
              onSupprimer={() => supprimerBloc(selected.cle)}
              onDeplacer={dir => deplacerBloc(selected.cle, dir)}
            />
          ) : (
            <PanneauPalette
              onAjouter={ajouterBloc}
              copieVar={copieVar}
              onCopierVar={copierVariable}
              parametresSupplementaires={parametresSupplementaires}
            />
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-[#0a0a0a] py-8 px-6" onClick={() => setSelectedCle(null)}>
          <div className="max-w-[560px] mx-auto rounded-xl overflow-hidden shadow-2xl">
            {blocs.length === 0 ? (
              <div className="bg-gray-900 border border-dashed border-gray-800 rounded-xl py-16 text-center">
                <p className="text-gray-400 text-sm font-medium mb-1">Aucun bloc pour l&apos;instant</p>
                <p className="text-gray-600 text-xs">Choisis un bloc à gauche pour commencer</p>
              </div>
            ) : (
              <div className="bg-white">
                {blocs.map((b, idx) => (
                  <BlocCanvas
                    key={b.cle}
                    blocAvecCle={b}
                    selected={selectedCle === b.cle}
                    onSelect={() => setSelectedCle(b.cle)}
                    onUpdate={patch => updateBloc(b.cle, patch)}
                    onSupprimer={() => supprimerBloc(b.cle)}
                    onDeplacer={dir => deplacerBloc(b.cle, dir)}
                    isFirst={idx === 0}
                    isLast={idx === blocs.length - 1}
                  />
                ))}
              </div>
            )}
            <div className="bg-gray-100 border-t border-gray-200 px-6 py-4 text-center">
              <p className="text-[11px] text-gray-400">
                Pied de page automatique — logo, lien boutique, lien de désinscription (non modifiable ici)
              </p>
            </div>
          </div>
        </div>
      </div>

      {apercuOuvert && (
        <ModaleApercu
          html={apercuHtml}
          chargement={chargementApercu}
          contacts={contacts}
          clientSelectionne={clientApercu}
          onChangerClient={handleChangerClientApercu}
          onClose={() => setApercuOuvert(false)}
        />
      )}
    </div>
  )
}

// ── Colonne gauche : palette (état par défaut) ────────────────────────────

function PanneauPalette({ onAjouter, copieVar, onCopierVar, parametresSupplementaires }: {
  onAjouter: (t: BlocEmail['type']) => void
  copieVar: string | null
  onCopierVar: (v: string) => void
  parametresSupplementaires?: React.ReactNode
}) {
  return (
    <div className="p-4">
      {parametresSupplementaires && (
        <div className="mb-6 pb-5 border-b border-gray-800">{parametresSupplementaires}</div>
      )}

      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Ajouter un bloc</p>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {PALETTE.map(p => (
          <button
            key={p.type}
            onClick={() => onAjouter(p.type)}
            className="flex flex-col items-start gap-1.5 px-3 py-2.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-transparent hover:border-gray-700 transition-colors text-left"
          >
            <span className="w-7 h-7 rounded-md bg-gray-900 flex items-center justify-center text-gray-400">{p.icone}</span>
            <span className="text-xs text-gray-300 font-medium leading-none">{p.label}</span>
            <span className="text-[10px] text-gray-600 leading-none">{p.desc}</span>
          </button>
        ))}
      </div>

      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Variables</p>
      <p className="text-[10px] text-gray-700 mb-3">Clique pour copier, colle dans un bloc.</p>
      {VARIABLES.map(g => (
        <div key={g.groupe} className="mb-3">
          <p className="text-[10px] text-gray-500 mb-1.5">{g.groupe}</p>
          <div className="flex flex-wrap gap-1">
            {g.vars.map(v => (
              <button
                key={v}
                onClick={() => onCopierVar(v)}
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all ${
                  copieVar === v ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 hover:bg-indigo-600/20 text-gray-400 hover:text-indigo-400'
                }`}
              >
                {copieVar === v ? '✓ copié' : v}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Colonne gauche : réglages du bloc sélectionné ─────────────────────────

function PanneauReglages({ blocAvecCle, index, total, beats, onRetour, onUpdate, onSupprimer, onDeplacer }: {
  blocAvecCle: BlocAvecCle
  index: number
  total: number
  beats: BeatOption[]
  onRetour: () => void
  onUpdate: (patch: Partial<BlocEmail>) => void
  onSupprimer: () => void
  onDeplacer: (dir: -1 | 1) => void
}) {
  const { bloc } = blocAvecCle

  return (
    <div className="p-4">
      <button onClick={onRetour} className="text-[11px] text-gray-500 hover:text-white transition-colors mb-3 flex items-center gap-1">
        ← Tous les blocs
      </button>

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-white">{LABEL_TYPE[bloc.type]}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => onDeplacer(-1)} disabled={index === 0}
            className="w-6 h-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[11px] text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">↑</button>
          <button onClick={() => onDeplacer(1)} disabled={index === total - 1}
            className="w-6 h-6 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-[11px] text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">↓</button>
          <button onClick={onSupprimer}
            className="w-6 h-6 bg-red-900/40 hover:bg-red-900/70 border border-red-800/60 rounded text-[11px] text-red-300 transition-colors">×</button>
        </div>
      </div>

      {bloc.type === 'header' && (
        <div>
          <label className={label}>Couleur de fond</label>
          <div className="flex items-center gap-2">
            <input type="color" value={bloc.couleur_fond} onChange={e => onUpdate({ couleur_fond: e.target.value })}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
            <span className="text-xs text-gray-500 font-mono">{bloc.couleur_fond}</span>
          </div>
          <p className="text-[10px] text-gray-700 mt-3">Le titre s&apos;édite directement sur le canvas.</p>
        </div>
      )}

      {bloc.type === 'texte' && (
        <p className="text-[11px] text-gray-600">Ce bloc s&apos;édite directement sur le canvas — aucun réglage supplémentaire.</p>
      )}

      {bloc.type === 'section_beats' && (
        <div className="space-y-4">
          <div>
            <label className={label}>Mise en page</label>
            <div className="flex gap-2">
              {([1, 2] as const).map(c => (
                <button key={c} onClick={() => onUpdate({ colonnes: c })}
                  className={`flex-1 py-1.5 rounded-lg text-xs border transition-colors ${
                    bloc.colonnes === c ? 'bg-indigo-600/20 border-indigo-500/40 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                  }`}>
                  {c === 1 ? '1 colonne' : '2 colonnes'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Source des beats</label>
            <select value={bloc.source} onChange={e => onUpdate({ source: e.target.value as typeof bloc.source })} className={champ}>
              <option value="nouveautes">Dernières publiées</option>
              <option value="membres">Réservés aux membres</option>
              <option value="manuel">Sélection manuelle</option>
            </select>
          </div>
          {bloc.source === 'manuel' && (
            <div>
              <label className={label}>Beats ({bloc.beat_ids?.length ?? 0} sélectionné{(bloc.beat_ids?.length ?? 0) > 1 ? 's' : ''})</label>
              {beats.length === 0 ? (
                <p className="text-[11px] text-gray-600">Aucun beat disponible.</p>
              ) : (
                <div className="grid grid-cols-1 gap-1 max-h-52 overflow-y-auto">
                  {beats.map(b => {
                    const isSelected = (bloc.beat_ids ?? []).includes(b.id)
                    return (
                      <button key={b.id}
                        onClick={() => {
                          const beatIds = isSelected ? (bloc.beat_ids ?? []).filter(id => id !== b.id) : [...(bloc.beat_ids ?? []), b.id]
                          onUpdate({ beat_ids: beatIds })
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left border transition-colors ${
                          isSelected ? 'bg-indigo-600/20 border-indigo-500/40 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                        }`}>
                        {b.image_url
                          ? <img src={b.image_url} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
                          : <span className="w-6 h-6 rounded bg-gray-700 flex-shrink-0" />}
                        <span className="truncate">{b.titre}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <p className="text-[10px] text-gray-700">Titre et sous-titre s&apos;éditent directement sur le canvas.</p>
        </div>
      )}

      {bloc.type === 'code_promo' && (
        <p className="text-[11px] text-gray-600">Ce bloc s&apos;édite directement sur le canvas — aucun réglage supplémentaire.</p>
      )}

      {bloc.type === 'cta' && (
        <div className="space-y-3">
          <div>
            <label className={label}>Lien du bouton</label>
            <input value={bloc.lien} onChange={e => onUpdate({ lien: e.target.value })} placeholder="{{url_boutique}}" className={champ} />
          </div>
          <div>
            <label className={label}>Couleur du bouton</label>
            <div className="flex items-center gap-2">
              <input type="color" value={bloc.couleur} onChange={e => onUpdate({ couleur: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
              <span className="text-xs text-gray-500 font-mono">{bloc.couleur}</span>
            </div>
          </div>
          <p className="text-[10px] text-gray-700">Le texte du bouton s&apos;édite directement sur le canvas.</p>
        </div>
      )}

      {bloc.type === 'espace' && (
        <div>
          <label className={label}>Hauteur (px)</label>
          <input type="number" min={8} max={120} value={bloc.hauteur}
            onChange={e => onUpdate({ hauteur: parseInt(e.target.value) || 24 })} className={champ} />
        </div>
      )}
    </div>
  )
}

// ── Canvas : rendu de chaque bloc, fidèle au rendu email final (lib/email-blocs.ts) ──

function BlocCanvas({ blocAvecCle, selected, onSelect, onUpdate, onSupprimer, onDeplacer, isFirst, isLast }: {
  blocAvecCle: BlocAvecCle
  selected: boolean
  onSelect: () => void
  onUpdate: (patch: Partial<BlocEmail>) => void
  onSupprimer: () => void
  onDeplacer: (dir: -1 | 1) => void
  isFirst: boolean
  isLast: boolean
}) {
  const { bloc } = blocAvecCle
  const inlineInput = 'bg-transparent outline-none w-full border-b border-transparent focus:border-gray-300 transition-colors'

  return (
    <div
      onClick={e => { e.stopPropagation(); onSelect() }}
      className={`relative cursor-pointer transition-all ${
        selected ? 'outline outline-2 outline-indigo-500 outline-offset-[-2px]' : 'hover:outline hover:outline-1 hover:outline-gray-300 hover:outline-offset-[-1px]'
      }`}
    >
      {selected && (
        <div className="absolute top-2 right-2 z-20 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onDeplacer(-1)} disabled={isFirst}
            className="w-6 h-6 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed">↑</button>
          <button onClick={() => onDeplacer(1)} disabled={isLast}
            className="w-6 h-6 bg-gray-900/90 hover:bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed">↓</button>
          <button onClick={onSupprimer}
            className="w-6 h-6 bg-red-900/80 hover:bg-red-800 border border-red-700 rounded text-xs text-red-300">×</button>
        </div>
      )}

      {bloc.type === 'header' && (
        <div className="text-center py-8 px-6" style={{ backgroundColor: bloc.couleur_fond }}>
          {selected ? (
            <input value={bloc.titre} onChange={e => onUpdate({ titre: e.target.value })} onClick={e => e.stopPropagation()}
              placeholder="Titre de l'email…" className={`${inlineInput} text-white font-black text-xl text-center placeholder-white/30`} />
          ) : (
            <h1 className="text-white font-black text-xl">{bloc.titre || 'Titre'}</h1>
          )}
        </div>
      )}

      {bloc.type === 'texte' && (
        <div className="px-6 py-4">
          {selected ? (
            <textarea value={bloc.contenu} onChange={e => onUpdate({ contenu: e.target.value })} onClick={e => e.stopPropagation()}
              rows={Math.max(3, bloc.contenu.split('\n').length + 1)}
              className="w-full bg-transparent text-[#1f2937] text-sm leading-relaxed resize-none outline-none border border-transparent focus:border-gray-200 rounded px-1 -mx-1 transition-colors"
              placeholder="Ton texte ici…" />
          ) : (
            bloc.contenu.split('\n').map((line, i) => (
              <p key={i} className="text-[#1f2937] text-sm leading-relaxed min-h-[1.4rem]">{line || ' '}</p>
            ))
          )}
        </div>
      )}

      {bloc.type === 'section_beats' && (
        <div className="px-6 py-4">
          {selected ? (
            <>
              <input value={bloc.titre} onChange={e => onUpdate({ titre: e.target.value })} onClick={e => e.stopPropagation()}
                placeholder="Titre de section…" className={`${inlineInput} text-[#111827] font-bold text-base mb-1 placeholder-gray-300`} />
              <input value={bloc.sous_titre ?? ''} onChange={e => onUpdate({ sous_titre: e.target.value })} onClick={e => e.stopPropagation()}
                placeholder="Sous-titre (optionnel)…" className={`${inlineInput} text-[#6b7280] text-xs mb-3 placeholder-gray-300`} />
            </>
          ) : (
            <>
              {bloc.titre && <h2 className="text-[#111827] font-bold text-base mb-0.5">{bloc.titre}</h2>}
              {bloc.sous_titre && <p className="text-[#6b7280] text-xs mb-3">{bloc.sous_titre}</p>}
            </>
          )}
          <div className={`grid gap-2 ${bloc.colonnes === 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-[180px]'}`}>
            {Array.from({ length: bloc.colonnes === 2 ? 2 : 1 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-lg bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400 text-[10px]">
                  {bloc.source === 'manuel' ? `${bloc.beat_ids?.length ?? 0} beat(s)` : bloc.source === 'membres' ? 'Membres' : 'Nouveautés'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bloc.type === 'code_promo' && (
        <div className="px-6 py-4 text-center">
          {selected ? (
            <input value={bloc.description} onChange={e => onUpdate({ description: e.target.value })} onClick={e => e.stopPropagation()}
              placeholder="Description…" className={`${inlineInput} text-[#4b5563] text-xs text-center mb-2 placeholder-gray-300`} />
          ) : (
            bloc.description && <p className="text-[#4b5563] text-xs mb-2">{bloc.description}</p>
          )}
          <div className="inline-block bg-gray-100 border-2 border-dashed border-gray-400 rounded-lg px-6 py-3">
            {selected ? (
              <input value={bloc.code} onChange={e => onUpdate({ code: e.target.value.toUpperCase() })} onClick={e => e.stopPropagation()}
                className="bg-transparent text-[#111827] font-black text-lg font-mono tracking-widest text-center outline-none w-full min-w-[100px]" />
            ) : (
              <p className="text-[#111827] font-black text-lg font-mono tracking-widest">{bloc.code}</p>
            )}
          </div>
        </div>
      )}

      {bloc.type === 'cta' && (
        <div className="px-6 py-4 text-center">
          {selected ? (
            <input value={bloc.texte} onChange={e => onUpdate({ texte: e.target.value })} onClick={e => e.stopPropagation()}
              className="px-8 py-2.5 rounded-lg text-white text-sm font-semibold text-center outline-none" style={{ backgroundColor: bloc.couleur }} />
          ) : (
            <button className="px-8 py-2.5 rounded-lg text-white text-sm font-semibold" style={{ backgroundColor: bloc.couleur }}>{bloc.texte}</button>
          )}
        </div>
      )}

      {bloc.type === 'espace' && (
        <div style={{ height: bloc.hauteur }}>
          {selected && (
            <div className="h-full border-y border-dashed border-indigo-300 flex items-center justify-center">
              <span className="text-[10px] text-indigo-400 font-mono">{bloc.hauteur}px</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modale aperçu HTML final (rendu réel via lib/email-blocs.ts) ──────────

function ModaleApercu({ html, chargement, contacts, clientSelectionne, onChangerClient, onClose }: {
  html: string
  chargement: boolean
  contacts: ContactOption[]
  clientSelectionne: string
  onChangerClient: (clientId: string) => void
  onClose: () => void
}) {
  const [vue, setVue] = useState<'bureau' | 'mobile'>('bureau')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0 gap-3">
          <p className="text-sm font-bold text-white flex-shrink-0">Aperçu</p>
          <div className="flex items-center gap-2 min-w-0">
            <SelecteurClientApercu contacts={contacts} clientSelectionne={clientSelectionne} onChangerClient={onChangerClient} />
            <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-0.5 flex-shrink-0">
              {(['bureau', 'mobile'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setVue(v)}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                    vue === v ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {v === 'bureau' ? 'Bureau' : 'Mobile'}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none flex-shrink-0">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-gray-950 flex justify-center py-4">
          {chargement ? (
            <p className="text-xs text-gray-500 self-center">Génération…</p>
          ) : (
            <iframe
              srcDoc={html}
              title="Aperçu de l'email"
              className="bg-white transition-all"
              style={{ width: vue === 'mobile' ? 375 : 640, height: '100%', minHeight: '65vh' }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sélecteur de client avec recherche (nom ou email), pour l'aperçu personnalisé ──

function SelecteurClientApercu({ contacts, clientSelectionne, onChangerClient }: {
  contacts: ContactOption[]
  clientSelectionne: string
  onChangerClient: (clientId: string) => void
}) {
  const [recherche, setRecherche] = useState('')
  const [ouvert, setOuvert] = useState(false)

  const labelSelectionne = contacts.find(c => c.id === clientSelectionne)?.label ?? ''
  const filtres = recherche.trim() === ''
    ? contacts.slice(0, 50)
    : contacts.filter(c => c.label.toLowerCase().includes(recherche.trim().toLowerCase())).slice(0, 50)

  function selectionner(clientId: string) {
    onChangerClient(clientId)
    setRecherche('')
    setOuvert(false)
  }

  return (
    <div className="relative min-w-0 w-56">
      <input
        value={ouvert ? recherche : labelSelectionne}
        onChange={e => { setRecherche(e.target.value); setOuvert(true) }}
        onFocus={() => { setRecherche(''); setOuvert(true) }}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        placeholder="Aperçu générique — rechercher un client…"
        className="w-full text-xs px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 focus:border-indigo-500 text-gray-200 placeholder-gray-500 outline-none transition-colors"
      />
      {ouvert && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-56 overflow-y-auto z-30">
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => selectionner('')}
            className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition-colors ${clientSelectionne === '' ? 'text-indigo-400 font-medium' : 'text-gray-300'}`}
          >
            Aperçu générique (tokens visibles)
          </button>
          {filtres.length === 0 ? (
            <p className="text-xs text-gray-600 px-3 py-2">Aucun client trouvé.</p>
          ) : (
            filtres.map(c => (
              <button
                key={c.id}
                onMouseDown={e => e.preventDefault()}
                onClick={() => selectionner(c.id)}
                className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-800 transition-colors truncate ${clientSelectionne === c.id ? 'text-indigo-400 font-medium' : 'text-gray-300'}`}
              >
                {c.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
