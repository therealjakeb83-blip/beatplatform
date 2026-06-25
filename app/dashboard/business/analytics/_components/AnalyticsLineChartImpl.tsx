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
}

export default function AnalyticsLineChart({ data, xKey, series, formatValue, height = 160 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
          tickFormatter={v => formatValue ? formatValue(v as number) : String(v)}
          width={48}
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
        {series.length > 1 && (
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
