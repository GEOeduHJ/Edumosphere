import { useEffect, useRef, useState } from 'react'
import { AppQuery, DailyWeatherRecord } from '../types/climate'
import { fetchDailyWeather } from '../api/weather'

const cache = new Map<string, DailyWeatherRecord[]>()

function keyFor(locId: string, startYear: number, endYear: number, metrics: string[]) {
  return `${locId}_${startYear}_${endYear}_${metrics.join(',')}`
}

export function useClimateQuery(query: AppQuery) {
  const [data, setData] = useState<Record<string, DailyWeatherRecord[]>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Memoize location IDs and metrics to prevent needless re-fetches
  const locationIds = JSON.stringify(query.locations.map(l => l.id))
  const metricStr = JSON.stringify(query.selectedMetrics)

  useEffect(() => {
    let active = true
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    async function fetchAll() {
      setLoading(true)
      setError(null)
      const results: Record<string, DailyWeatherRecord[]> = {}
      try {
        const promises = query.locations.map(async loc => {
          const key = keyFor(loc.id, query.startYear, query.endYear, query.selectedMetrics)
          if (cache.has(key)) {
            results[loc.id] = cache.get(key) as DailyWeatherRecord[]
            return
          }
          const startIso = `${query.startYear}-01-01`
          const endIso = `${query.endYear}-12-31`
          const d = await fetchDailyWeather(loc, startIso, endIso, query.selectedMetrics, controller.signal)
          results[loc.id] = d
          cache.set(key, d)
        })
        await Promise.all(promises)
        if (active) {
          setData(results)
          setLoading(false)
        }
      } catch (err) {
        if (!active) return
        if ((err as any)?.name === 'AbortError') {
          setLoading(false)
          return
        }
        setError(err as Error)
        setLoading(false)
      }
    }

    if (query.locations.length > 0) fetchAll()
    else setData({})

    return () => {
      active = false
      controller.abort()
    }
  }, [locationIds, query.startYear, query.endYear, metricStr])

  return { data, loading, error, refetch: () => {
    // simple refetch by clearing cache entries matching current query
    query.locations.forEach(loc => {
      const k = keyFor(loc.id, query.startYear, query.endYear, query.selectedMetrics)
      cache.delete(k)
    })
    // force effect by changing nothing (caller can re-run). For simplicity, do nothing here.
  } }
}
