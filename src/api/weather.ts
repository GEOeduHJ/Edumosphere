import { LocationResult, DailyWeatherRecord, ClimateMetric } from '../types/climate'

// Try to use official SDK if available; otherwise fallback to REST archive API.
export async function fetchDailyWeather(
  location: LocationResult,
  startIso: string,
  endIso: string,
  metrics: ClimateMetric[] = ['temperature_max', 'temperature_min', 'precipitation'],
  signal?: AbortSignal
): Promise<DailyWeatherRecord[]> {
  // Validation and defensive adjustments
  if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
    throw new Error('Invalid location for weather request')
  }

  // Use full-date clamping (API limits by specific date, not year)
  const todayIso = new Date().toISOString().slice(0, 10)
  const minIso = '1940-01-01'
  const startDate = new Date(startIso)
  const endDate = new Date(endIso)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) throw new Error('Invalid start or end date')

  let start = startIso
  let end = endIso
  // Clamp to today's date if requested dates are in the future
  if (endDate > new Date()) {
    console.warn(`Requested end date ${endIso} > today ${todayIso}, clamping to ${todayIso}`)
    end = todayIso
  }
  if (startDate > new Date()) {
    console.warn(`Requested start date ${startIso} > today ${todayIso}, clamping to ${todayIso}`)
    start = todayIso
  }
  // Clamp to API minimum
  if (new Date(start) < new Date(minIso)) {
    console.warn(`Requested start date ${start} < minimum ${minIso}, clamping to ${minIso}`)
    start = minIso
  }
  if (new Date(start) > new Date(end)) throw new Error('Start date must be <= end date')

  // Attempt dynamic import of SDK (runtime) — use Function to avoid Vite pre-bundling
  try {
    const dynamicImport = (new Function('s', 'return import(s)')) as (s: string) => Promise<any>
    const pkgName = ['open', 'meteo'].join('')
    const sdk = await dynamicImport(pkgName).catch(() => null)
    if (sdk && typeof (sdk as any).fetchWeatherApi === 'function') {
      const dailyVars: string[] = []
      if (metrics.includes('temperature_max') || metrics.includes('temperature')) dailyVars.push('temperature_2m_max')
      if (metrics.includes('temperature_min') || metrics.includes('temperature')) dailyVars.push('temperature_2m_min')
      if (metrics.includes('precipitation')) dailyVars.push('precipitation_sum')

      const resp = await (sdk as any).fetchWeatherApi({
        latitude: location.latitude,
        longitude: location.longitude,
        start_date: start,
        end_date: end,
        timezone: location.timezone ?? 'UTC',
        daily: dailyVars.join(',')
      })

      const daily = resp?.daily || {}
      const dates: string[] = daily.time || []
      const tempMax = daily.temperature_2m_max || []
      const tempMin = daily.temperature_2m_min || []
      const precip = daily.precipitation_sum || []
      return dates.map((d: string, i: number) => ({
        date: d,
        temperatureMax: tempMax[i] != null ? Number(tempMax[i]) : null,
        temperatureMin: tempMin[i] != null ? Number(tempMin[i]) : null,
        precipitationSum: precip[i] != null ? Number(precip[i]) : null
      }))
    }
  } catch (e) {
    // SDK not available or failed — fallback to REST below
    // eslint-disable-next-line no-console
    console.warn('Open-Meteo SDK unavailable or failed, falling back to REST archive', e)
  }

  // REST fallback (archive)
  const params = new URLSearchParams()
  params.set('latitude', String(location.latitude))
  params.set('longitude', String(location.longitude))
  params.set('start_date', start)
  params.set('end_date', end)
  params.set('timezone', location.timezone ?? 'UTC')
  const dailyVars: string[] = []
  if (metrics.includes('temperature_max') || metrics.includes('temperature')) dailyVars.push('temperature_2m_max')
  if (metrics.includes('temperature_min') || metrics.includes('temperature')) dailyVars.push('temperature_2m_min')
  if (metrics.includes('precipitation')) dailyVars.push('precipitation_sum')
  if (dailyVars.length > 0) params.set('daily', dailyVars.join(','))
  const url = `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`

  // debug: include url in logs for easier debugging and include response body on error
  const res = await fetch(url, { signal })
  if (!res.ok) {
    let bodyText = ''
    try {
      bodyText = await res.text()
    } catch (e) {
      bodyText = String(e)
    }
    throw new Error(`Weather API error: ${res.status} ${bodyText} (url: ${url})`)
  }
  const data = await res.json()
  const daily = data.daily || {}
  const dates: string[] = daily.time || []
  const tempMax = daily.temperature_2m_max || []
  const tempMin = daily.temperature_2m_min || []
  const precip = daily.precipitation_sum || []
  return dates.map((d: string, i: number) => ({
    date: d,
    temperatureMax: tempMax[i] != null ? Number(tempMax[i]) : null,
    temperatureMin: tempMin[i] != null ? Number(tempMin[i]) : null,
    precipitationSum: precip[i] != null ? Number(precip[i]) : null
  }))
}
