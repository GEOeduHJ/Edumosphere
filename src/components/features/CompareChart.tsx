import React from 'react'
import Plot from 'react-plotly.js'
import { YearlyClimateRecord } from '../../types/climate'

type Series = { label: string; yearly: YearlyClimateRecord[] }

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

const CompareChart: React.FC<{ series: Series[]; metric?: 'temperature' | 'precipitation' }> = ({ series, metric = 'temperature' }) => {
  const traces = series.map((s, idx) => {
    const yData = s.yearly.map(y => {
      if (metric === 'precipitation') {
        return typeof y.totalPrecipitation === 'number' ? y.totalPrecipitation : null
      }
      return typeof y.meanTemp === 'number' ? y.meanTemp : null
    })
    return {
      x: s.yearly.map(y => y.year),
      y: yData,
      type: 'scatter',
      mode: 'lines+markers',
      name: s.label,
      line: { color: colors[idx % colors.length] }
    }
  })

  const yTitle = metric === 'precipitation' ? '연간 강수량 (mm)' : '평균기온 (°C)'

  const layout = {
    margin: { t: 20, r: 20, l: 50, b: 50 },
    xaxis: { title: '연도' },
    yaxis: { title: yTitle },
    legend: { orientation: 'h', y: -0.2 }
  } as any

  return <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '420px' }} useResizeHandler={true} />
}

export default CompareChart
