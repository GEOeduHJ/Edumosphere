import React from 'react'
import Plot from 'react-plotly.js'
import { MonthlyClimateRecord } from '../../types/climate'
import { monthlyAnomalies } from '../../utils/aggregation'

type Props = { monthly: MonthlyClimateRecord[]; baselineStart?: number; baselineEnd?: number; metric?: 'temperature' | 'precipitation' }

const MonthlyAnomalyChart: React.FC<Props> = ({ monthly, baselineStart, baselineEnd, metric = 'temperature' }) => {
  const anomalies = monthlyAnomalies(monthly, baselineStart, baselineEnd)

  const x = anomalies.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`)
  const y = anomalies.map(m => (metric === 'temperature' ? m.tempAnomaly : m.precipAnomaly))

  const traces = [
    {
      x,
      y,
      type: 'bar',
      name: metric === 'temperature' ? '기온 편차 (°C)' : '강수 편차 (mm)',
      marker: { color: metric === 'temperature' ? '#d62728' : '#1f77b4' }
    }
  ]

  const layout = {
    margin: { t: 20, r: 20, l: 50, b: 80 },
    xaxis: { title: '연-월', tickangle: -45 },
    yaxis: { title: metric === 'temperature' ? '편차 (°C)' : '편차 (mm)' },
    shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: '#666', dash: 'dash' } }],
    legend: { orientation: 'h', y: -0.25 }
  } as any

  return <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '420px' }} useResizeHandler={true} />
}

export default MonthlyAnomalyChart
