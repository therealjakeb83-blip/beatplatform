'use client'

import dynamic from 'next/dynamic'

export type { ChartSeries } from './AnalyticsLineChartImpl'

const AnalyticsLineChart = dynamic(
  () => import('./AnalyticsLineChartImpl'),
  {
    ssr: false,
    loading: () => <div className="animate-pulse bg-gray-800 rounded-xl" style={{ height: 160 }} />,
  }
)

export default AnalyticsLineChart
