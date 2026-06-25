'use client'

import { useState } from 'react'
import { PERIODE_OPTIONS, type Periode } from '../_lib/periode'

type Props = {
  value: Periode
  debut: string
  fin: string
  onChange: (p: Periode, debut: string, fin: string) => void
}

export default function PeriodSelector({ value, debut, fin, onChange }: Props) {
  const [localDebut, setLocalDebut] = useState(debut)
  const [localFin, setLocalFin]     = useState(fin)

  function handleSelect(p: Periode) {
    if (p !== 'custom') onChange(p, '', '')
    else onChange('custom', localDebut, localFin)
  }

  function handleCustomChange(d: string, f: string) {
    setLocalDebut(d)
    setLocalFin(f)
    if (d && f) onChange('custom', d, f)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {PERIODE_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleSelect(opt.key)}
            className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              value === opt.key
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value === 'custom' && (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="date"
            value={localDebut}
            onChange={e => handleCustomChange(e.target.value, localFin)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
          <span className="text-gray-500 text-xs">→</span>
          <input
            type="date"
            value={localFin}
            onChange={e => handleCustomChange(localDebut, e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  )
}
