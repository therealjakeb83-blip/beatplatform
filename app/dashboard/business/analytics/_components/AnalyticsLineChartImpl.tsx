'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

export type ChartSeries = {
  key: string
  color: string
  label?: string
}

type Props = {
  data: Array<Record<string, unknown>>
  xKey: string
  series: ChartSeries[]
  formatValue?: (v: number) => string
  height?: number
  showLegend?: boolean
}

function fmtTick(v: number, formatValue?: (v: number) => string): string {
  if (!formatValue) {
    if (v >= 1000) return `${(v / 1000).toFixed(0)}k`
    return String(Math.round(v))
  }
  // Strip ",00 €" or ".00 €" for whole numbers (avoid "0,00 €" × 5)
  return formatValue(v).replace(/,00 €$/, ' €').replace(/\.00 €$/, ' €')
}

export default function AnalyticsLineChart({ data, xKey, series, formatValue, height = 160, showLegend = true }: Props) {
  const dataMax = Math.max(...data.flatMap(d => series.map(s => (d[s.key] as number) ?? 0)), 0)
  const yMax: number | 'auto' = dataMax === 0 ? 10 : 'auto'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 14, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickCount={4}
          domain={[0, yMax]}
          tickFormatter={v => fmtTick(v as number, formatValue)}
          width={52}
        />
        <Tooltip
          contentStyle={{
            background: '#111827',
            border: '1px solid #1f2937',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: '#9ca3af', fontSize: 11, marginBottom: 4 }}
          formatter={(v: unknown, name: string | number | undefined) => {
            const val = typeof v === 'number' ? v : 0
            const nameStr = String(name ?? '')
            const serie = series.find(s => s.key === nameStr)
            return [formatValue ? formatValue(val) : val, serie?.label ?? nameStr]
          }}
        />
        {showLegend && series.length > 1 && (
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#9ca3af', paddingTop: 8 }}
            formatter={(value) => series.find(s => s.key === value)?.label ?? value}
          />
        )}
        {series.map(s => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: s.color }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
