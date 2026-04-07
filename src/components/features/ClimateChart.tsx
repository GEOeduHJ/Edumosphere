import React from 'react'
import Plot from 'react-plotly.js'
import { MonthlyClimateRecord } from '../../types/climate'

type Props = { monthly: MonthlyClimateRecord[] }

const ClimateChart: React.FC<Props> = ({ monthly }) => {
  const x = monthly.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`)
  const temps = monthly.map(m => (typeof m.meanTemp === 'number' ? m.meanTemp : null))
  const prec = monthly.map(m => (typeof m.totalPrecipitation === 'number' ? m.totalPrecipitation : null))

  const traces = [
    {
      x,
      y: temps,
      type: 'scatter',
      mode: 'lines+markers',
      name: '평균기온 (°C)',
      yaxis: 'y1',
      line: { color: '#d62728' }
    },
    {
      x,
      y: prec,
      type: 'bar',
      name: '강수량 (mm)',
      yaxis: 'y2',
      marker: { color: '#1f77b4' },
      opacity: 0.6
    }
  ]

  const layout = {
    margin: { t: 20, r: 50, l: 50, b: 50 },
    xaxis: { title: '연-월' },
    yaxis: { title: '평균기온 (°C)', side: 'left' },
    yaxis2: { title: '강수량 (mm)', overlaying: 'y', side: 'right' },
    legend: { orientation: 'h', y: -0.2 }
  } as any

  return (
    <div>
      <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '400px' }} useResizeHandler={true} />
    </div>
  )
}

export default ClimateChart
