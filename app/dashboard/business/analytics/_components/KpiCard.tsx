'use client'

type Badge = 'actuel' | 'tous-temps' | 'periode'

const BADGE_STYLE: Record<Badge, string> = {
  'actuel':     'text-indigo-400 bg-indigo-500/10 border border-indigo-500/20',
  'tous-temps': 'text-gray-500   bg-gray-800      border border-gray-700',
  'periode':    'text-amber-400  bg-amber-500/10  border border-amber-500/20',
}
const BADGE_LABEL: Record<Badge, string> = {
  'actuel':     'Actuel',
  'tous-temps': 'Tous temps',
  'periode':    'Cette période',
}

type Props = {
  label: string
  value: string
  sub?: string
  color?: string
  active?: boolean
  onClick?: () => void
  className?: string
  badge?: Badge
}

export default function KpiCard({ label, value, sub, color, active, onClick, className = '', badge }: Props) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`relative text-left p-4 rounded-xl border transition-colors w-full ${
        active
          ? 'border-indigo-500 bg-gray-900'
          : onClick
            ? 'border-gray-800 bg-gray-900 hover:border-gray-700 cursor-pointer'
            : 'border-gray-800 bg-gray-900'
      } ${className}`}
    >
      {badge && (
        <span className={`absolute top-2.5 right-2.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${BADGE_STYLE[badge]}`}>
          {BADGE_LABEL[badge]}
        </span>
      )}
      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-black truncate" style={color ? { color } : {}}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </Tag>
  )
}
