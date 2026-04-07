import React from 'react'
import Plot from 'react-plotly.js'
import { DailyWeatherRecord } from '../../types/climate'

type Props = {
  series: Array<{ label: string; daily: DailyWeatherRecord[] }>
  year: number
  metric?: 'temperature' | 'precipitation'
}

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

const MonthlyBreakdownChart: React.FC<Props> = ({ series, year, metric = 'temperature' }) => {
  // Group daily data by month
  const monthlyGroups = new Map<number, DailyWeatherRecord[]>()
  
  series.forEach(s => {
    s.daily.forEach(d => {
      const [y, m] = d.date.split('-')
      if (Number(y) === year) {
        const month = Number(m)
        if (!monthlyGroups.has(month)) {
          monthlyGroups.set(month, [])
        }
        monthlyGroups.get(month)!.push(d)
      }
    })
  })

  const sortedMonths = Array.from(monthlyGroups.keys()).sort((a, b) => a - b)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
      {sortedMonths.map(month => {
        const monthData = monthlyGroups.get(month) || []
        const traces = series.map((s, idx) => {
          const dateStrings = monthData.map(d => d.date)
          const yData = monthData.map(d => {
            if (metric === 'precipitation') {
              return typeof d.precipitationSum === 'number' ? d.precipitationSum : null
            }
            // For temperature, show average of max and min
            if (d.temperatureMax !== null && d.temperatureMax !== undefined && d.temperatureMin !== null && d.temperatureMin !== undefined) {
              return ((d.temperatureMax + d.temperatureMin) / 2)
            }
            return null
          })

          return {
            x: dateStrings,
            y: yData,
            type: metric === 'precipitation' ? 'bar' : 'scatter',
            mode: metric === 'precipitation' ? undefined : 'lines+markers',
            name: s.label,
            line: metric === 'precipitation' ? undefined : { color: colors[idx % colors.length] },
            marker: metric === 'precipitation' ? { color: colors[idx % colors.length] } : undefined
          }
        })

        const yTitle = metric === 'precipitation' ? '강수량 (mm)' : '평균기온 (°C)'

        const layout = {
          margin: { t: 30, r: 20, l: 50, b: 80 },
          title: { text: `${year}년 ${month}월`, font: { size: 14 } },
          xaxis: { title: '날짜', tickangle: -45 },
          yaxis: { title: yTitle },
          legend: { orientation: 'v', x: 1.02, y: 1 },
          height: 320
        } as any

        return (
          <div key={month} style={{ background: 'white', borderRadius: '8px', padding: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '320px' }} useResizeHandler={true} />
          </div>
        )
      })}
    </div>
  )
}

export default MonthlyBreakdownChart
