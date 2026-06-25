'use client'

type Props = {
  label: string
  value: string
  sub?: string
  color?: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export default function KpiCard({ label, value, sub, color, active, onClick, className = '' }: Props) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-colors w-full ${
        active
          ? 'border-indigo-500 bg-gray-900'
          : onClick
            ? 'border-gray-800 bg-gray-900 hover:border-gray-700 cursor-pointer'
            : 'border-gray-800 bg-gray-900'
      } ${className}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black truncate" style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </Tag>
  )
}
