import React from 'react'
import Plot from 'react-plotly.js'
import { MonthlyClimateRecord } from '../../types/climate'
import { cumulativePrecipByYear } from '../../utils/aggregation'

type Props = { monthly: MonthlyClimateRecord[] }

const CumulativePrecipChart: React.FC<Props> = ({ monthly }) => {
  const cum = cumulativePrecipByYear(monthly)

  const byYear = new Map<number, { months: string[]; values: number[] }>()
  cum.forEach(m => {
    const existing = byYear.get(m.year) || { months: [], values: [] }
    existing.months.push(String(m.month))
    existing.values.push(m.cumulativePrecip)
    byYear.set(m.year, existing)
  })

  const traces = Array.from(byYear.entries()).map(([year, data], idx) => ({
    x: data.months.map(m => `${year}-${String(m).padStart(2, '0')}`),
    y: data.values,
    type: 'scatter',
    mode: 'lines+markers',
    name: String(year)
  }))

  const layout = {
    margin: { t: 20, r: 20, l: 50, b: 50 },
    xaxis: { title: '월' },
    yaxis: { title: '누적 강수량 (mm)' },
    legend: { orientation: 'h', y: -0.2 }
  } as any

  return <Plot data={traces as any} layout={layout} style={{ width: '100%', height: '420px' }} useResizeHandler={true} />
}

export default CumulativePrecipChart
