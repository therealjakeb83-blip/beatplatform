'use client'

import { useState } from 'react'
import { CHAMPS, OPS_PAR_TYPE, COULEURS, type Condition, type BadgeCondition, type CatalogOptions } from '../../_lib/segments'

// Badge champ selon le statut sélectionné
const BADGE_CHAMP: Record<string, 'score_rf' | 'score_chaleur'> = {
  a_achete: 'score_rf',
  abonne:   'score_rf',
  ancien:   'score_rf',
  client:   'score_rf',
  lead:     'score_chaleur',
}

const BADGE_OPTIONS: Record<string, { val: string; label: string }[]> = {
  score_rf: [
    { val: 'Régulier',    label: 'Régulier' },
    { val: 'Fidèle',      label: 'Fidèle' },
    { val: 'Occasionnel', label: 'Occasionnel' },
    { val: 'Dormant',     label: 'Dormant' },
  ],
  score_chaleur: [
    { val: 'Chaud', label: 'Chaud' },
    { val: 'Tiède', label: 'Tiède' },
    { val: 'Froid', label: 'Froid' },
  ],
}

const BADGE_OPS = [
  { val: 'eq',  label: 'est' },
  { val: 'neq', label: "n'est pas" },
  { val: 'any', label: 'est parmi' },
]

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
  if (def?.options?.length)                                  return def.options[0].val
  if (def?.catalogKey && catalog[def.catalogKey].length)     return catalog[def.catalogKey][0]
  if (def?.type === 'number')                                return '0'
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
    initial?.filtres?.length ? initial.filtres : [{ champ: 'statut', op: 'eq', val: 'a_achete' }]
  )
  const [pending, setPending] = useState(false)

  function addCondition() {
    setFiltres(f => [...f, { lien: 'ET', champ: 'statut', op: 'eq', val: 'a_achete' }])
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
        updated.op    = ops[0].val
        updated.val   = valeurDefaut(patch.champ, catalog)
        updated.badge = undefined
      }
      return updated
    }))
  }

  function handleStatutValChange(i: number, newStatut: string) {
    const newBadgeChamp = BADGE_CHAMP[newStatut]
    setFiltres(f => f.map((c, idx) => {
      if (idx !== i) return c
      const updated = { ...c, val: newStatut }
      // Si le badge champ change (client→lead ou inverse), on réinitialise le badge
      if (c.badge && newBadgeChamp && c.badge.champ !== newBadgeChamp) {
        updated.badge = undefined
      }
      return updated
    }))
  }

  function updateBadge(i: number, patch: Partial<BadgeCondition> | null) {
    setFiltres(f => f.map((c, idx) => {
      if (idx !== i) return c
      if (patch === null) return { ...c, badge: undefined }
      const badgeChamp = BADGE_CHAMP[String(c.val)] ?? 'score_rf'
      const defaultOpts = BADGE_OPTIONS[badgeChamp]
      const current: BadgeCondition = c.badge ?? { champ: badgeChamp, op: 'eq', vals: [defaultOpts[0].val] }
      return { ...c, badge: { ...current, ...patch, champ: badgeChamp } }
    }))
  }

  function toggleLien(i: number) {
    setFiltres(f => f.map((c, idx) =>
      idx !== i ? c : { ...c, lien: c.lien === 'OU' ? 'ET' : 'OU' }
    ))
  }

  async function handleSubmit() {
    if (!nom.trim()) return
    setPending(true)
    const fd = new FormData()
    if (segmentId) fd.append('id', segmentId)
    fd.append('nom',         nom.trim())
    fd.append('description', description.trim())
    fd.append('couleur',     couleur)
    // Nettoyage : "Tous les badges" ou 'any' sans sélection = pas de filtre badge
    const filtresEffectifs = filtres.map(f => {
      if (!f.badge) return f
      if (f.badge.op === 'any' && f.badge.vals.length === 0) return { ...f, badge: undefined }
      if ((f.badge.op === 'eq' || f.badge.op === 'neq') && f.badge.vals[0] === '__tous__') return { ...f, badge: undefined }
      return f
    })
    fd.append('filtres', JSON.stringify(filtresEffectifs))
    await onSave(fd)
    setPending(false)
  }

  function renderValeurInput(cond: Condition, i: number) {
    if (cond.op === 'existe') return null

    const def = CHAMPS.find(c => c.champ === cond.champ)

    // Champ statut — valeur + badge intégré
    if (cond.champ === 'statut') {
      const badgeChamp = BADGE_CHAMP[String(cond.val)]
      const badgeOpts  = badgeChamp ? BADGE_OPTIONS[badgeChamp] : []
      // Badge affiché en lecture : si pas de badge sauvegardé, on affiche "Tous" par défaut
      const badge = cond.badge ?? (badgeOpts.length > 0
        ? { champ: badgeChamp, op: 'eq' as const, vals: ['__tous__'] }
        : undefined)

      return (
        <div className="flex flex-col gap-1.5 flex-1">
          {/* Valeur statut */}
          <select
            value={String(cond.val)}
            onChange={e => handleStatutValChange(i, e.target.value)}
            className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
          >
            {def?.options?.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>

          {/* Badge intégré — toujours visible, ressemble à une ligne de condition */}
          {badge && badgeOpts.length > 0 && (
            <div className="ml-3 pl-3 border-l border-gray-700 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-500 uppercase tracking-wide font-semibold w-10 flex-shrink-0">Badge</span>

                {/* Op */}
                <select
                  value={badge.op}
                  onChange={e => {
                    const newOp = e.target.value as BadgeCondition['op']
                    const vals  = newOp === 'any' ? [] : ['__tous__']
                    updateBadge(i, { op: newOp, vals })
                  }}
                  className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  {BADGE_OPS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                </select>

                {/* Valeur unique (est / n'est pas) */}
                {badge.op !== 'any' && (
                  <select
                    value={badge.vals[0] ?? '__tous__'}
                    onChange={e => updateBadge(i, { vals: [e.target.value] })}
                    className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                  >
                    <option value="__tous__">Tous les badges</option>
                    {badgeOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
                  </select>
                )}
              </div>

              {/* Checkboxes pour "est parmi" */}
              {badge.op === 'any' && (
                <div className="flex items-center gap-3 flex-wrap pl-14">
                  {badgeOpts.map(o => (
                    <label key={o.val} className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={badge.vals.includes(o.val)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...badge.vals, o.val]
                            : badge.vals.filter(v => v !== o.val)
                          updateBadge(i, { vals: next })
                        }}
                        className="accent-indigo-500 cursor-pointer"
                      />
                      <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{o.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )
    }

    // Champs avec options statiques (enum/boolean)
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

                  {/* Ligne condition */}
                  <div className="flex items-start gap-2 flex-wrap">
                    {/* Champ */}
                    <select
                      value={cond.champ}
                      onChange={e => updateCondition(i, { champ: e.target.value })}
                      className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer min-w-[140px]"
                    >
                      {CHAMPS.map(c => (
                        <option key={c.champ} value={c.champ}>{c.label}</option>
                      ))}
                    </select>

                    {/* Opérateur */}
                    {cond.champ !== 'statut' && (
                      <select
                        value={cond.op}
                        onChange={e => updateCondition(i, { op: e.target.value as Condition['op'] })}
                        className="bg-gray-800 border border-gray-700 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-white outline-none cursor-pointer"
                      >
                        {ops.map(o => (
                          <option key={o.val} value={o.val}>{o.label}</option>
                        ))}
                      </select>
                    )}

                    {/* Valeur */}
                    {renderValeurInput(cond, i)}

                    {/* Supprimer */}
                    {filtres.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(i)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0 mt-1.5"
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
