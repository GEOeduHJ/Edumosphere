import { DailyWeatherRecord, MonthlyClimateRecord, YearlyClimateRecord } from '../types/climate'

const DEFAULT_BASELINE_START = 1991
const DEFAULT_BASELINE_END = 2020

export function aggregateDailyToMonthly(daily: DailyWeatherRecord[]): MonthlyClimateRecord[] {
  const map = new Map<string, { year: number; month: number; tempSum: number; tempCount: number; precipSum: number; precipCount: number; daysCounted: number }>()

  daily.forEach(d => {
    const [yearStr, monthStr] = d.date.split('-')
    const year = Number(yearStr)
    const month = Number(monthStr)
    const key = `${year}-${month}`
    let entry = map.get(key)
    if (!entry) {
      entry = { year, month, tempSum: 0, tempCount: 0, precipSum: 0, precipCount: 0, daysCounted: 0 }
      map.set(key, entry)
    }

    const temps: number[] = []
    if (typeof d.temperatureMax === 'number') temps.push(d.temperatureMax)
    if (typeof d.temperatureMin === 'number') temps.push(d.temperatureMin)
    if (temps.length > 0) {
      const dayMean = temps.reduce((a, b) => a + b, 0) / temps.length
      entry.tempSum += dayMean
      entry.tempCount += 1
      entry.daysCounted += 1
    }
    if (typeof d.precipitationSum === 'number') {
      entry.precipSum += d.precipitationSum
      entry.precipCount += 1
    }
  })

  const results: MonthlyClimateRecord[] = []
  for (const [, v] of map) {
    results.push({
      year: v.year,
      month: v.month,
      meanTemp: v.tempCount > 0 ? v.tempSum / v.tempCount : null,
      totalPrecipitation: v.precipCount > 0 ? v.precipSum : null,
      daysCounted: v.daysCounted
    })
  }
  results.sort((a, b) => a.year - b.year || a.month - b.month)
  return results
}

export function aggregateMonthlyToYearly(monthly: MonthlyClimateRecord[]): YearlyClimateRecord[] {
  const map = new Map<number, MonthlyClimateRecord[]>()
  monthly.forEach(m => {
    const arr = map.get(m.year) || []
    arr.push(m)
    map.set(m.year, arr)
  })

  const results: YearlyClimateRecord[] = []
  for (const [year, months] of map) {
    const validTemps = months.filter(m => typeof m.meanTemp === 'number')
    const meanTemp = validTemps.length > 0 ? validTemps.reduce((s, m) => s + (m.meanTemp ?? 0), 0) / validTemps.length : null

    const validPrecip = months.filter(m => typeof m.totalPrecipitation === 'number')
    const totalPrecipitation = validPrecip.length > 0 ? validPrecip.reduce((s, m) => s + (m.totalPrecipitation ?? 0), 0) : null

    const hottest = validTemps.length > 0 ? validTemps.reduce((best, cur) => (cur.meanTemp! > best.meanTemp! ? cur : best)).month : null
    const coldest = validTemps.length > 0 ? validTemps.reduce((best, cur) => (cur.meanTemp! < best.meanTemp! ? cur : best)).month : null
    const wettest = validPrecip.length > 0 ? validPrecip.reduce((best, cur) => (cur.totalPrecipitation! > best.totalPrecipitation! ? cur : best)).month : null

    results.push({
      year,
      meanTemp,
      totalPrecipitation,
      hottestMonth: hottest ?? null,
      coldestMonth: coldest ?? null,
      wettestMonth: wettest ?? null
    })
  }
  results.sort((a, b) => a.year - b.year)
  return results
}

export function summarizePeriod(daily: DailyWeatherRecord[]) {
  if (!daily || daily.length === 0) return { meanTemp: null as number | null, totalPrecipitation: null as number | null, daysCounted: 0 }
  let tempSum = 0
  let tempCount = 0
  let precipSum = 0
  let precipCount = 0
  let daysCounted = 0

  daily.forEach(d => {
    const temps: number[] = []
    if (typeof d.temperatureMax === 'number') temps.push(d.temperatureMax)
    if (typeof d.temperatureMin === 'number') temps.push(d.temperatureMin)
    if (temps.length > 0) {
      tempSum += temps.reduce((a, b) => a + b, 0) / temps.length
      tempCount += 1
      daysCounted += 1
    }
    if (typeof d.precipitationSum === 'number') {
      precipSum += d.precipitationSum
      precipCount += 1
    }
  })

  return {
    meanTemp: tempCount > 0 ? tempSum / tempCount : null,
    totalPrecipitation: precipCount > 0 ? precipSum : null,
    daysCounted
  }
}

// --- Additional helpers for educational charts ---
export function computeMonthlyClimatology(monthlyRecords: MonthlyClimateRecord[], baselineStart?: number, baselineEnd?: number) {
  const result: { month: number; meanTemp: number | null; meanPrecip: number | null }[] = []
  
  // Auto-detect baseline if not provided or if baseline range is not in data
  const allYears = [...new Set(monthlyRecords.map(r => r.year))].sort((a, b) => a - b)
  
  let actualStart: number
  let actualEnd: number
  
  if (allYears.length === 0) {
    // No data, return all null climatology
    for (let m = 1; m <= 12; m++) {
      result.push({ month: m, meanTemp: null, meanPrecip: null })
    }
    return result
  }
  
  // Default baseline is 1991-2020. If that baseline isn't present in the
  // dataset, fall back to the original auto-detection (first 30 years).
  const bsStart = baselineStart == null ? DEFAULT_BASELINE_START : baselineStart
  const bsEnd = baselineEnd == null ? DEFAULT_BASELINE_END : baselineEnd

  const hasBaseline = allYears.some(y => y >= bsStart && y <= bsEnd)
  if (!hasBaseline) {
    // Use first 30 years or all data if less than 30 years
    actualStart = allYears[0]
    actualEnd = Math.min(actualStart + 29, allYears[allYears.length - 1])
  } else {
    actualStart = bsStart
    actualEnd = bsEnd
  }
  
  for (let m = 1; m <= 12; m++) {
    const entries = monthlyRecords.filter(r => r.month === m && r.year >= actualStart && r.year <= actualEnd)
    const tempVals = entries.map(e => e.meanTemp).filter(v => typeof v === 'number') as number[]
    const precipVals = entries.map(e => e.totalPrecipitation).filter(v => typeof v === 'number') as number[]
    const meanTemp = tempVals.length > 0 ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length : null
    const meanPrecip = precipVals.length > 0 ? precipVals.reduce((a, b) => a + b, 0) / precipVals.length : null
    result.push({ month: m, meanTemp, meanPrecip })
  }
  return result
}

export function monthlyAnomalies(
  monthlyRecords: MonthlyClimateRecord[],
  baselineStart?: number,
  baselineEnd?: number
): Array<MonthlyClimateRecord & { tempAnomaly?: number | null; precipAnomaly?: number | null; climatologyTemp?: number | null; climatologyPrecip?: number | null }> {
  const climatology = computeMonthlyClimatology(monthlyRecords, baselineStart, baselineEnd)
  return monthlyRecords.map(r => {
    const cl = climatology[r.month - 1]
    const tempAnom = typeof r.meanTemp === 'number' && typeof cl.meanTemp === 'number' ? r.meanTemp - cl.meanTemp : null
    const precipAnom = typeof r.totalPrecipitation === 'number' && typeof cl.meanPrecip === 'number' ? r.totalPrecipitation - cl.meanPrecip : null
    return { ...r, tempAnomaly: tempAnom, precipAnomaly: precipAnom, climatologyTemp: cl.meanTemp, climatologyPrecip: cl.meanPrecip }
  })
}

export function cumulativePrecipByYear(monthlyRecords: MonthlyClimateRecord[]): Array<MonthlyClimateRecord & { cumulativePrecip: number }> {
  const byYear = new Map<number, MonthlyClimateRecord[]>()
  monthlyRecords.forEach(m => {
    const arr = byYear.get(m.year) || []
    arr.push(m)
    byYear.set(m.year, arr)
  })

  const results: Array<MonthlyClimateRecord & { cumulativePrecip: number }> = []
  for (const [year, months] of byYear) {
    months.sort((a, b) => a.month - b.month)
    let cum = 0
    for (const m of months) {
      const precip = typeof m.totalPrecipitation === 'number' ? m.totalPrecipitation : 0
      cum += precip
      results.push({ ...m, cumulativePrecip: cum })
    }
  }
  results.sort((a, b) => a.year - b.year || a.month - b.month)
  return results
}

export function computeAnnualClimatology(yearly: YearlyClimateRecord[], baselineStart?: number, baselineEnd?: number) {
  const allYears = [...new Set(yearly.map(y => y.year))].sort((a, b) => a - b)
  
  let actualStart: number
  let actualEnd: number
  
  if (allYears.length === 0) {
    return {
      baselineMeanTemp: null,
      baselinePrecip: null
    }
  }
  
  // Default baseline is 1991-2020. If that baseline isn't present in the
  // dataset, fall back to the original auto-detection (first 30 years).
  const bsStartA = baselineStart == null ? DEFAULT_BASELINE_START : baselineStart
  const bsEndA = baselineEnd == null ? DEFAULT_BASELINE_END : baselineEnd

  const hasBaselineA = allYears.some(y => y >= bsStartA && y <= bsEndA)
  if (!hasBaselineA) {
    // Use first 30 years or all data if less than 30 years
    actualStart = allYears[0]
    actualEnd = Math.min(actualStart + 29, allYears[allYears.length - 1])
  } else {
    actualStart = bsStartA
    actualEnd = bsEndA
  }
  
  const entries = yearly.filter(y => y.year >= actualStart && y.year <= actualEnd)
  const tempVals = entries.map(e => e.meanTemp).filter(v => typeof v === 'number') as number[]
  const precipVals = entries.map(e => e.totalPrecipitation).filter(v => typeof v === 'number') as number[]
  return {
    baselineMeanTemp: tempVals.length > 0 ? tempVals.reduce((a, b) => a + b, 0) / tempVals.length : null,
    baselinePrecip: precipVals.length > 0 ? precipVals.reduce((a, b) => a + b, 0) / precipVals.length : null
  }
}

export function annualAnomalies(
  yearly: YearlyClimateRecord[],
  baselineStart?: number,
  baselineEnd?: number
): Array<YearlyClimateRecord & { tempAnomaly?: number | null; precipAnomaly?: number | null }> {
  const baseline = computeAnnualClimatology(yearly, baselineStart, baselineEnd)
  return yearly.map(y => {
    const tempAnom = typeof y.meanTemp === 'number' && typeof baseline.baselineMeanTemp === 'number' ? y.meanTemp - baseline.baselineMeanTemp : null
    const precipAnom = typeof y.totalPrecipitation === 'number' && typeof baseline.baselinePrecip === 'number' ? y.totalPrecipitation - baseline.baselinePrecip : null
    return { ...y, tempAnomaly: tempAnom, precipAnomaly: precipAnom }
  })
}
