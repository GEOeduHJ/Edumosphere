import React from 'react'
import Plot from 'react-plotly.js'
import { YearlyClimateRecord } from '../../types/climate'
import { annualAnomalies } from '../../utils/aggregation'

type Props = { yearly: YearlyClimateRecord[]; baselineStart?: number; baselineEnd?: number; metric?: 'temperature' | 'precipitation' }

const AnnualAnomalyChart: React.FC<Props> = ({ yearly, baselineStart, baselineEnd, metric = 'temperature' }) => {
  const ann = annualAnomalies(yearly, baselineStart, baselineEnd)

  const x = ann.map(y => y.year)
  const y = ann.map(y => (metric === 'temperature' ? y.tempAnomaly : y.precipAnomaly))

  const traces = [
    {
      x,
      y,
      type: 'bar',
      name: metric === 'temperature' ? '연간 기온 편차 (°C)' : '연간 강수 편차 (mm)',
      marker: { color: metric === 'temperature' ? '#d62728' : '#1f77b4' }
    }
  ]

  const layout = {
    margin: { t: 20, r: 20, l: 50, b: 50 },
    xaxis: { title: '연도' },
    yaxis: { title: metric === 'temperature' ? '편차 (°C)' : '편차 (mm)' },
    shapes: [{ type: 'line', x0: 0, x1: 1, xref: 'paper', y0: 0, y1: 0, line: { color: '#666', dash: 'dash' } }],
    legend: { orientation: 'h', y: -0.2 }
  } as any

  return <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '420px' }} useResizeHandler={true} />
}

export default AnnualAnomalyChart
