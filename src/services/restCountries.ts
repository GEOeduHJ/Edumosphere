import { RestCountryProfile } from '../types/country'

const cache = new Map<string, any>()

function normalizeIso3(code: string) {
  return (code || '').toUpperCase()
}

export async function fetchRestCountriesByIso3(codes: string[]): Promise<Record<string, RestCountryProfile | null>> {
  const out: Record<string, RestCountryProfile | null> = {}
  if (!codes || codes.length === 0) return out
  const uniq = Array.from(new Set(codes.map(normalizeIso3)))
  const toFetch: string[] = []
  for (const c of uniq) {
    if (cache.has(c)) out[c] = cache.get(c)
    else toFetch.push(c)
  }
  if (toFetch.length > 0) {
    try {
      const url = toFetch.length === 1
        ? `https://restcountries.com/v3.1/alpha/${toFetch[0]}`
        : `https://restcountries.com/v3.1/alpha?codes=${toFetch.join(',')}`
      const res = await fetch(url)
      if (!res.ok) {
        // mark as null
        for (const c of toFetch) { cache.set(c, null); out[c] = null }
        return out
      }
      const data = await res.json()
      const arr = Array.isArray(data) ? data : [data]
      for (const item of arr) {
        const iso3 = normalizeIso3(item?.cca3 || item?.CIOC || item?.cioc || '')
        const profile: RestCountryProfile = {
          iso2: item?.cca2 || item?.cca2?.toUpperCase?.() || undefined,
          officialName: item?.name?.official,
          commonName: item?.name?.common,
          flagPng: item?.flags?.png || item?.flags?.svg,
          capital: item?.capital || undefined,
          region: item?.region,
          subregion: item?.subregion,
          population: typeof item?.population === 'number' ? item.population : undefined,
          languages: item?.languages || undefined,
          currencies: item?.currencies || undefined
        }
        cache.set(iso3, profile)
        out[iso3] = profile
      }
      // ensure any requested but not returned codes are set to null
      for (const c of toFetch) if (!out[c]) { cache.set(c, null); out[c] = null }
    } catch (e) {
      for (const c of toFetch) { cache.set(c, null); out[c] = null }
    }
  }
  return out
}
