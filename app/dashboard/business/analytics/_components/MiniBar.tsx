'use client'

type Props = {
  value: number
  max: number
  color?: string
}

export default function MiniBar({ value, max, color = '#4ade80' }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="w-16 h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
