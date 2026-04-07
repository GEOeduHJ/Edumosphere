import { LocationResult } from '../types/climate'

export async function searchLocation(query: string, signal?: AbortSignal): Promise<LocationResult[]> {
  if (!query || query.trim().length === 0) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=ko`
  const res = await fetch(url, { signal })
  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Geocoding API error: ${res.status}`)
  }
  const data = await res.json()
  const results = (data.results || []).map((r: any) => {
    const id = r.id ?? `${r.latitude},${r.longitude}`
    return {
      id,
      name: r.name,
      country: r.country,
      countryCode: r.country_code ?? null,
      admin1: r.admin1 ?? null,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
      elevation: r.elevation ?? null,
      timezone: r.timezone ?? null
    } as LocationResult
  })
  return results
}
