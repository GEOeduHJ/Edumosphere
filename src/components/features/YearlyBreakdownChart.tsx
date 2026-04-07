import React from 'react'
import Plot from 'react-plotly.js'
import { YearlyClimateRecord, MonthlyClimateRecord } from '../../types/climate'

type Props = {
  series: Array<{ label: string; monthly: MonthlyClimateRecord[] }>
  metric?: 'temperature' | 'precipitation'
}

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

const YearlyBreakdownChart: React.FC<Props> = ({ series, metric = 'temperature' }) => {
  // Get all unique years
  const allYears = [...new Set(series.flatMap(s => s.monthly.map(m => m.year)))].sort((a, b) => a - b)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
      {allYears.map(year => {
        const traces = series.map((s, idx) => {
          const yearData = s.monthly.filter(m => m.year === year).sort((a, b) => a.month - b.month)
          const yData = yearData.map(m => {
            if (metric === 'precipitation') {
              return typeof m.totalPrecipitation === 'number' ? m.totalPrecipitation : null
            }
            return typeof m.meanTemp === 'number' ? m.meanTemp : null
          })
          return {
            x: yearData.map(m => `${m.month}월`),
            y: yData,
            type: 'scatter',
            mode: 'lines+markers',
            name: s.label,
            line: { color: colors[idx % colors.length] }
          }
        })

        const yTitle = metric === 'precipitation' ? '강수량 (mm)' : '평균기온 (°C)'

        const layout = {
          margin: { t: 30, r: 20, l: 50, b: 50 },
          title: { text: `${year}년`, font: { size: 14 } },
          xaxis: { title: '월' },
          yaxis: { title: yTitle },
          legend: { orientation: 'v', x: 1.02, y: 1 },
          height: 300
        } as any

        return (
          <div key={year} style={{ background: 'white', borderRadius: '8px', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '300px' }} useResizeHandler={true} />
          </div>
        )
      })}
    </div>
  )
}

export default YearlyBreakdownChart
