import React from 'react'
import Plot from 'react-plotly.js'
import { MonthlyClimateRecord } from '../../types/climate'

type Props = {
  series: Array<{ label: string; monthly: MonthlyClimateRecord[] }>
  year: number
  metric?: 'temperature' | 'precipitation'
}

const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']

const RadarChart: React.FC<Props> = ({ series, year, metric = 'temperature' }) => {
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

  const traces = series.map((s, idx) => {
    const yearData = s.monthly.filter(m => m.year === year).sort((a, b) => a.month - b.month)
    const yData = yearData.map(m => {
      if (metric === 'precipitation') {
        return typeof m.totalPrecipitation === 'number' ? m.totalPrecipitation : 0
      }
      return typeof m.meanTemp === 'number' ? m.meanTemp : 0
    })

    // Pad with zeros if less than 12 months
    const fullYear = new Array(12).fill(0)
    yearData.forEach((m, i) => {
      fullYear[m.month - 1] = yData[i]
    })

    return {
      type: 'scatterpolar',
      r: fullYear.concat([fullYear[0]]), // Close the polygon
      theta: monthNames.concat([monthNames[0]]),
      name: s.label,
      line: { color: colors[idx % colors.length] },
      fill: 'toself',
      fillcolor: colors[idx % colors.length],
      opacity: 0.3
    }
  })

  const yTitle = metric === 'precipitation' ? '강수량 (mm)' : '평균기온 (°C)'

  const layout = {
    polar: {
      radialaxis: {
        visible: true,
        range: metric === 'precipitation' ? [0, Math.max(...series.flatMap(s => s.monthly.filter(m => m.year === year).map(m => m.totalPrecipitation || 0)))] : undefined,
        title: { text: yTitle, font: { size: 12 } }
      },
      angularaxis: {
        tickfont: { size: 12 }
      }
    },
    title: { text: `${year}년 월별 ${metric === 'precipitation' ? '강수량' : '기온'} 분포`, font: { size: 14 } },
    showlegend: true,
    legend: { orientation: 'v', x: 1.02, y: 1 },
    margin: { t: 60, r: 80, l: 80, b: 60 }
  } as any

  return <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '500px' }} useResizeHandler={true} />
}

export default RadarChart
