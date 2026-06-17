'use client'

import { useState } from 'react'
import { CHAMPS, OPS_PAR_TYPE, COULEURS, type Condition, type CatalogOptions } from '../../_lib/segments'

// Scores qui proposent "TOUS" (= n'importe quel badge)
const SCORES_AVEC_TOUS = ['score_rf', 'score_chaleur']

// Badges RF/chaleur selon le statut sélectionné (suggestion contextuelle)
const BADGE_HINT: Record<string, string> = {
  abonne: 'score_rf',
  ancien: 'score_rf',
  client: 'score_rf',
  lead:   'score_chaleur',
}

type Props = {
  catalog: CatalogOptions
  segmentId?: string
  onClose: () => void
  onSave: (data: FormData) => Promise<void>
  initial?: {
    nom: string
    description: string
    couleur: string
    filtres: Condition[]
  }
}

function valeurDefaut(champ: string, catalog: CatalogOptions): string {
  const def = CHAMPS.find(c => c.champ === champ)
  if (def?.options?.length)                 return def.options[0].val
  if (def?.catalogKey && catalog[def.catalogKey].length) return catalog[def.catalogKey][0]
  if (def?.type === 'number')               return '0'
  return ''
}

function opsForChamp(champ: string) {
  const def = CHAMPS.find(c => c.champ === champ)
  return OPS_PAR_TYPE[def?.type ?? 'text']
}

export default function SegmentModal({ catalog, segmentId, onClose, onSave, initial }: Props) {
  const [nom,         setNom]         = useState(initial?.nom         ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [couleur,     setCouleur]     = useState(initial?.couleur     ?? 'indigo')
  const [filtres,     setFiltres]     = useState<Condition[]>(
    initial?.filtres?.length ? initial.filtres : [{ champ: 'statut', op: 'eq', val: 'abonne' }]
  )
  const [pending, setPending] = useState(false)

  function addCondition() {
    setFiltres(f => [...f, { lien: 'ET', champ: 'statut', op: 'eq', val: 'abonne' }])
  }

  function removeCondition(i: number) {
    setFiltres(f => {
      const next = f.filter((_, idx) => idx !== i)
      if (next.length > 0) delete next[0].lien
      return next
    })
  }

  function updateCondition(i: number, patch: Partial<Condition>) {
    setFiltres(f => f.map((c, idx) => {
      if (idx !== i) return c
      const updated = { ...c, ...patch }
      if (patch.champ && patch.champ !== c.champ) {
        const ops = opsForChamp(patch.champ)
        updated.op  = ops[0].val
        updated.val = valeurDefaut(patch.champ, catalog)
      }
      return updated
    }))
  }

  function toggleLien(i: number) {
    setFiltres(f => f.map((c, idx) =>
      idx !== i ? c : { ...c, lien: c.lien === 'OU' ? 'ET' : 'OU' }
    ))
  }

  // Suggestion badge quand on change la valeur d'un statut
  function handleStatutChange(i: number, newVal: string) {
    updateCondition(i, { val: newVal })
    const badgeChamp = BADGE_HINT[newVal]
    if (!badgeChamp) return
    const alreadyHas = filtres.some(f => f.champ === badgeChamp)
    if (!alreadyHas) {
      // On suggère d'ajouter le badge en l'insérant juste après la condition statut
      const inserted: Condition = {
        lien:  'ET',
        champ: badgeChamp,
        op:    'eq',
        val:   'TOUS',
      }
      setFiltres(prev => {
        const next = [...prev]
        next.splice(i + 1, 0, inserted)
        return next
      })
    }
  }

  async function handleSubmit() {
    if (!nom.trim()) return
    setPending(true)
    const fd = new FormData()
    if (segmentId) fd.append('id', segmentId)
    fd.append('nom',         nom.trim())
    fd.append('description', description.trim())
    fd.append('couleur',     couleur)
    // "TOUS" = pas de filtre sur ce champ → on ne l'envoie pas
    const filtresEffectifs = filtres.filter(f => !(SCORES_AVEC_TOUS.includes(f.champ) && String(f.val) === 'TOUS'))
    fd.append('filtres', JSON.stringify(filtresEffectifs))
    await onSave(fd)
    setPending(false)
  }

  function renderValeurInput(cond: Condition, i: number) {
    if (cond.op === 'existe') return null

    const def = CHAMPS.find(c => c.champ === cond.champ)

    // Champ statut — gestion spéciale avec suggestion badge
    if (cond.champ === 'statut') {
      return (
        <select
          value={String(cond.val)}
          onChange={e => handleStatutChange(i, e.target.value)}
          className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
        >
          {def?.options?.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      )
    }

    // Scores avec option TOUS
    if (SCORES_AVEC_TOUS.includes(cond.champ)) {
      return (
        <select
          value={String(cond.val)}
          onChange={e => updateCondition(i, { val: e.target.value })}
          className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
        >
          <option value="TOUS">TOUS les badges</option>
          {def?.options?.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      )
    }

    // Champs avec options statiques
    if (def?.options) {
      return (
        <select
          value={String(cond.val)}
          onChange={e => updateCondition(i, { val: e.target.value })}
          className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
        >
          {def.options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      )
    }

    // Champs avec options dynamiques (catalogue)
    if (def?.catalogKey) {
      const opts = catalog[def.catalogKey]
      if (opts.length > 0) {
        return (
          <select
            value={String(cond.val)}
            onChange={e => updateCondition(i, { val: e.target.value })}
            className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
          >
            {opts.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )
      }
    }

    // Champ texte ou nombre libre
    return (
      <div className="flex items-center gap-1">
        <input
          type={def?.type === 'number' ? 'number' : 'text'}
          value={String(cond.val)}
          onChange={e => updateCondition(i, {
            val: def?.type === 'number' ? Number(e.target.value) : e.target.value,
          })}
          className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none w-28"
          placeholder="valeur…"
        />
        {def?.unite && <span className="text-xs text-gray-500">{def.unite}</span>}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl my-6 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-bold text-white">
            {segmentId ? 'Modifier le segment' : 'Nouveau segment'}
          </h2>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Nom + description */}
          <div className="space-y-3">
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Nom du segment…"
              className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors"
            />
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description (optionnelle)…"
              className="w-full bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none transition-colors"
            />
          </div>

          {/* Couleur */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">Couleur</span>
            {COULEURS.map(c => (
              <button
                key={c.val}
                type="button"
                onClick={() => setCouleur(c.val)}
                className={`w-5 h-5 rounded-full ${c.dot} transition-all ${
                  couleur === c.val
                    ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white scale-110'
                    : 'opacity-50 hover:opacity-80'
                }`}
              />
            ))}
          </div>

          {/* Filter builder */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Critères</p>

            {filtres.map((cond, i) => {
              const ops = opsForChamp(cond.champ)
              const showOp = cond.op !== 'existe'

              return (
                <div key={i} className="space-y-1.5">
                  {/* Connecteur ET / OU */}
                  {i > 0 && (
                    <div className="flex items-center gap-2 pl-2">
                      <button
                        type="button"
                        onClick={() => toggleLien(i)}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-gray-800 border border-gray-700 hover:border-indigo-500 text-indigo-400 transition-colors min-w-[32px]"
                      >
                        {cond.lien ?? 'ET'}
                      </button>
                      <div className="flex-1 h-px bg-gray-800" />
                    </div>
                  )}

                  {/* Badge hint */}
                  {SCORES_AVEC_TOUS.includes(cond.champ) && String(cond.val) === 'TOUS' && (
                    <p className="text-[10px] text-gray-600 italic pl-2">
                      "TOUS" = pas de filtre sur ce badge — tu peux choisir un badge spécifique
                    </p>
                  )}

                  {/* Ligne condition */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Champ */}
                    <select
                      value={cond.champ}
                      onChange={e => updateCondition(i, { champ: e.target.value })}
                      className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer flex-1 min-w-[140px]"
                    >
                      {CHAMPS.map(c => (
                        <option key={c.champ} value={c.champ}>{c.label}</option>
                      ))}
                    </select>

                    {/* Opérateur */}
                    <select
                      value={cond.op}
                      onChange={e => updateCondition(i, { op: e.target.value as Condition['op'] })}
                      className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                    >
                      {ops.map(o => (
                        <option key={o.val} value={o.val}>{o.label}</option>
                      ))}
                    </select>

                    {/* Valeur */}
                    {renderValeurInput(cond, i)}

                    {/* Supprimer */}
                    {filtres.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(i)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0 ml-auto"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <button
              type="button"
              onClick={addCondition}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 pt-1"
            >
              <span className="text-base leading-none">+</span> Ajouter un critère
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!nom.trim() || pending}
            className="text-xs px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>
    </div>
  )
}
