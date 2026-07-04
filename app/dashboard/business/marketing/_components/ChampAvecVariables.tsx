'use client'

import { useRef, useEffect, useState, useCallback } from 'react'

// ── Catalogue des variables (palette + constructeur de secours) ──────────────

export type VariableInfo = { token: string; label: string }

export const GROUPES_VARIABLES: { groupe: string; vars: VariableInfo[] }[] = [
  { groupe: 'Identité', vars: [
    { token: 'prénom',      label: 'Prénom' },
    { token: 'nom',         label: 'Nom' },
    { token: 'nom_artiste', label: "Nom d'artiste" },
    { token: 'email',       label: 'Email' },
    { token: 'pays',        label: 'Pays' },
    { token: 'langue',      label: 'Langue' },
  ] },
  { groupe: 'Boutique', vars: [
    { token: 'nom_boutique',  label: 'Nom de la boutique' },
    { token: 'url_boutique',  label: 'Lien de la boutique' },
    { token: 'slug_boutique', label: 'Identifiant boutique' },
  ] },
  { groupe: 'Achats & fidélité', vars: [
    { token: 'statut_client',  label: 'Statut client' },
    { token: 'nb_achats',      label: "Nombre d'achats" },
    { token: 'ltv',            label: 'Valeur totale (LTV)' },
    { token: 'panier_moyen',   label: 'Panier moyen' },
    { token: 'dernier_achat',  label: 'Date du dernier achat' },
    { token: 'score_fidelite', label: 'Score de fidélité' },
  ] },
  { groupe: 'Abonnement', vars: [
    { token: 'mensualites_payees', label: 'Mensualités payées' },
  ] },
  { groupe: 'Préférences musicales', vars: [
    { token: 'style_préféré',      label: 'Style préféré' },
    { token: 'type_beat_préféré',  label: 'Type de beat préféré' },
    { token: 'ambiance_préférée',  label: 'Ambiance préférée' },
    { token: 'instrument_préféré', label: 'Instrument préféré' },
    { token: 'licence_préférée',   label: 'Licence préférée' },
  ] },
  { groupe: 'Réseaux sociaux', vars: [
    { token: 'instagram', label: 'Instagram' },
    { token: 'spotify',   label: 'Spotify' },
    { token: 'youtube',   label: 'YouTube' },
    { token: 'tiktok',    label: 'TikTok' },
  ] },
  { groupe: 'Engagement', vars: [
    { token: 'nb_favoris',                  label: 'Nombre de favoris' },
    { token: 'nb_telechargements_gratuits', label: 'Téléchargements gratuits' },
  ] },
  { groupe: 'Date', vars: [
    { token: 'date_du_jour', label: 'Date du jour' },
    { token: 'annee',        label: 'Année' },
  ] },
]

export const TOUTES_VARIABLES: VariableInfo[] = GROUPES_VARIABLES.flatMap(g => g.vars)
export const LABEL_PAR_TOKEN: Record<string, string> = Object.fromEntries(TOUTES_VARIABLES.map(v => [v.token, v.label]))

function estVariableConnue(nom: string): boolean {
  return LABEL_PAR_TOKEN[nom.toLowerCase()] !== undefined
}

// ── Secours en chaîne : variable -> variable -> texte fixe ────────────────────

export type EtapeSecours = { type: 'variable'; nom: string } | { type: 'texte'; valeur: string }

export function parserToken(interieur: string): { principal: string; etapes: EtapeSecours[] } {
  const segments = interieur.split('|')
  const principal = segments[0].trim().toLowerCase()
  const etapes: EtapeSecours[] = []
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i].trim()
    if (estVariableConnue(seg)) {
      etapes.push({ type: 'variable', nom: seg.toLowerCase() })
    } else {
      etapes.push({ type: 'texte', valeur: segments.slice(i).join('|').trim() })
      break
    }
  }
  return { principal, etapes }
}

export function construireToken(principal: string, etapes: EtapeSecours[]): string {
  const parts = [principal, ...etapes.map(e => e.type === 'variable' ? e.nom : e.valeur)]
  return `{{${parts.join('|')}}}`
}

// ── Champ de texte enrichi : variables sous forme de pastilles cliquables ─────

type Props = {
  value: string
  onChange: (v: string) => void
  onFocusChamp: (inserer: (token: string) => void) => void
  multiline?: boolean
  placeholder?: string
  className?: string
  // false = aperçu lecture seule (bloc non sélectionné) : pastilles affichées mais
  // ni éditables ni cliquables, le clic doit remonter pour sélectionner le bloc.
  editable?: boolean
}

function creerChip(interieur: string, onClicChip?: (span: HTMLElement) => void): HTMLElement {
  const { principal, etapes } = parserToken(interieur)
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.dataset.varToken = `{{${interieur}}}`
  span.className = `inline-flex items-center px-1.5 rounded bg-indigo-100 text-indigo-700 font-medium select-none transition-colors ${onClicChip ? 'cursor-pointer hover:bg-indigo-200' : ''}`
  span.style.fontSize = '0.9em'
  span.textContent = (LABEL_PAR_TOKEN[principal] ?? principal) + (etapes.length > 0 ? ' •' : '')
  if (onClicChip) span.addEventListener('click', e => { e.stopPropagation(); onClicChip(span) })
  return span
}

function construireDOM(texte: string, onClicChip?: (span: HTMLElement) => void): DocumentFragment {
  const frag = document.createDocumentFragment()
  const regex = /\{\{([^{}]+)\}\}/g
  let dernierIndex = 0
  let m: RegExpExecArray | null

  function ajouterTexte(morceau: string) {
    const lignes = morceau.split('\n')
    lignes.forEach((ligne, i) => {
      if (ligne) frag.appendChild(document.createTextNode(ligne))
      if (i < lignes.length - 1) frag.appendChild(document.createElement('br'))
    })
  }

  while ((m = regex.exec(texte))) {
    ajouterTexte(texte.slice(dernierIndex, m.index))
    frag.appendChild(creerChip(m[1], onClicChip))
    dernierIndex = m.index + m[0].length
  }
  ajouterTexte(texte.slice(dernierIndex))
  return frag
}

export default function ChampAvecVariables({ value, onChange, onFocusChamp, multiline, placeholder, className, editable = true }: Props) {
  const ref            = useRef<HTMLDivElement>(null)
  const lastValueRef   = useRef<string>(value)
  const savedRangeRef  = useRef<Range | null>(null)
  // Le nœud DOM de la pastille en édition vit dans un ref (mutation impérative
  // directe, hors du cycle de rendu React, jamais lue pendant le rendu) — seule
  // la config (principal + étapes), dérivée une fois à l'ouverture, est un state.
  const chipEnEditionRef = useRef<HTMLElement | null>(null)
  const [configModale, setConfigModale] = useState<{ principal: string; etapes: EtapeSecours[] } | null>(null)
  const [estVide, setEstVide]           = useState(value === '')

  function serialiser(): string {
    const el = ref.current
    if (!el) return ''
    let out = ''
    function walk(node: ChildNode) {
      if (node.nodeType === Node.TEXT_NODE) { out += node.textContent ?? ''; return }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const elt = node as HTMLElement
        if (elt.tagName === 'BR') { out += '\n'; return }
        if (elt.dataset.varToken) { out += elt.dataset.varToken; return }
        elt.childNodes.forEach(walk)
      }
    }
    el.childNodes.forEach(walk)
    return out
  }

  const ouvrirModaleChip = useCallback((span: HTMLElement) => {
    chipEnEditionRef.current = span
    const interieur = span.dataset.varToken?.replace(/^\{\{|\}\}$/g, '') ?? ''
    setConfigModale(parserToken(interieur))
  }, [])

  // Montage initial
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.appendChild(construireDOM(value, editable ? ouvrirModaleChip : undefined))
    el.dataset.editable = String(editable)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-synchronise le DOM si la valeur change depuis l'extérieur (changement de bloc
  // sélectionné, etc.) ou si on bascule entre lecture seule et édition.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value === lastValueRef.current && el.dataset.editable === String(editable)) return
    el.innerHTML = ''
    el.appendChild(construireDOM(value, editable ? ouvrirModaleChip : undefined))
    el.dataset.editable = String(editable)
    lastValueRef.current = value
    setEstVide(value === '')
  }, [value, ouvrirModaleChip, editable])

  function handleInput() {
    const v = serialiser()
    lastValueRef.current = v
    setEstVide(v === '')
    onChange(v)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter') return
    if (!multiline) { e.preventDefault(); return }
    e.preventDefault()
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const br = document.createElement('br')
    range.insertNode(br)
    range.setStartAfter(br)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    handleInput()
  }

  const insererVariable = useCallback((token: string) => {
    const el = ref.current
    if (!el) return
    el.focus()
    const sel = window.getSelection()
    let range: Range
    if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0)
    } else if (savedRangeRef.current && el.contains(savedRangeRef.current.startContainer)) {
      range = savedRangeRef.current
    } else {
      range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
    }
    const interieur = token.replace(/^\{\{|\}\}$/g, '')
    const chip = creerChip(interieur, ouvrirModaleChip)
    range.deleteContents()
    range.insertNode(chip)
    const espace = document.createTextNode(' ')
    chip.after(espace)
    const rangeApres = document.createRange()
    rangeApres.setStartAfter(espace)
    rangeApres.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(rangeApres)
    savedRangeRef.current = rangeApres.cloneRange()
    handleInput()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvrirModaleChip])

  function handleFocus() {
    onFocusChamp(insererVariable)
  }

  function handleBlur() {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }

  function handleSauvegarderChip(principal: string, etapes: EtapeSecours[]) {
    const chip = chipEnEditionRef.current
    if (!chip) return
    chip.dataset.varToken = construireToken(principal, etapes)
    chip.textContent = (LABEL_PAR_TOKEN[principal] ?? principal) + (etapes.length > 0 ? ' •' : '')
    chipEnEditionRef.current = null
    setConfigModale(null)
    handleInput()
  }

  function handleSupprimerChip() {
    const chip = chipEnEditionRef.current
    if (!chip) return
    chip.remove()
    chipEnEditionRef.current = null
    setConfigModale(null)
    handleInput()
  }

  return (
    <div className="relative" onClick={editable ? e => e.stopPropagation() : undefined}>
      {editable && estVide && placeholder && (
        <span className={`${className ?? ''} absolute inset-0 pointer-events-none opacity-40`}>
          {placeholder}
        </span>
      )}
      <div
        ref={ref}
        contentEditable={editable}
        suppressContentEditableWarning
        onInput={editable ? handleInput : undefined}
        onKeyDown={editable ? handleKeyDown : undefined}
        onFocus={editable ? handleFocus : undefined}
        onBlur={editable ? handleBlur : undefined}
        className={`${className ?? ''} outline-none`}
        style={{ whiteSpace: 'pre-wrap', minHeight: '1.2em' }}
      />
      {editable && configModale && (
        <ModaleConfigVariable
          principal={configModale.principal}
          etapesInitiales={configModale.etapes}
          onSave={handleSauvegarderChip}
          onSupprimer={handleSupprimerChip}
          onClose={() => setConfigModale(null)}
        />
      )}
    </div>
  )
}

// ── Modale : configurer la chaîne de secours d'une variable ───────────────────

function ModaleConfigVariable({ principal, etapesInitiales, onSave, onSupprimer, onClose }: {
  principal: string
  etapesInitiales: EtapeSecours[]
  onSave: (principal: string, etapes: EtapeSecours[]) => void
  onSupprimer: () => void
  onClose: () => void
}) {
  const [etapes, setEtapes] = useState<EtapeSecours[]>(etapesInitiales)

  function ajouterEtape() {
    setEtapes(prev => [...prev, { type: 'variable', nom: TOUTES_VARIABLES[0].token }])
  }
  function supprimerEtape(i: number) {
    setEtapes(prev => prev.filter((_, idx) => idx !== i))
  }
  function changerType(i: number, type: 'variable' | 'texte') {
    setEtapes(prev => prev.map((e, idx) => idx === i
      ? (type === 'variable' ? { type: 'variable' as const, nom: TOUTES_VARIABLES[0].token } : { type: 'texte' as const, valeur: '' })
      : e))
  }
  function changerValeur(i: number, valeur: string) {
    setEtapes(prev => prev.map((e, idx) => idx === i
      ? (e.type === 'variable' ? { type: 'variable' as const, nom: valeur } : { type: 'texte' as const, valeur })
      : e))
  }

  const peutAjouter = etapes.length === 0 || etapes[etapes.length - 1].type !== 'texte'

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <p className="text-sm font-bold text-white">Configurer la variable</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Variable :</span>
            <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-medium">
              {LABEL_PAR_TOKEN[principal] ?? principal}
            </span>
          </div>

          {etapes.length > 0 && (
            <p className="text-[11px] text-gray-500">Si elle est vide pour ce contact, utiliser à la place :</p>
          )}

          {etapes.map((etape, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-600 w-4 flex-shrink-0">{i + 1}.</span>
              <select
                value={etape.type}
                onChange={e => changerType(i, e.target.value as 'variable' | 'texte')}
                className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white outline-none flex-shrink-0"
              >
                <option value="variable">Une autre variable</option>
                <option value="texte">Texte fixe</option>
              </select>
              {etape.type === 'variable' ? (
                <select
                  value={etape.nom}
                  onChange={e => changerValeur(i, e.target.value)}
                  className="flex-1 min-w-0 text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white outline-none"
                >
                  {TOUTES_VARIABLES.map(v => <option key={v.token} value={v.token}>{v.label}</option>)}
                </select>
              ) : (
                <input
                  value={etape.valeur}
                  onChange={e => changerValeur(i, e.target.value)}
                  placeholder="ex: frérot"
                  className="flex-1 min-w-0 text-xs bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-2 py-1.5 text-white outline-none"
                />
              )}
              <button onClick={() => supprimerEtape(i)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 text-sm">×</button>
            </div>
          ))}

          {peutAjouter && (
            <button onClick={ajouterEtape} className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              + Ajouter un secours
            </button>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-800 flex items-center justify-between gap-3">
          <button onClick={onSupprimer} className="text-xs text-red-400 hover:text-red-300 transition-colors">
            Supprimer cette variable
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors">
              Annuler
            </button>
            <button onClick={() => onSave(principal, etapes)} className="text-xs px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors">
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
