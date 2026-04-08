import { WorldBankIndicatorValue, CountryProfile } from '../types/country'
import { parseLatestIndicator } from '../utils/worldBank'

const metaCache = new Map<string, any>()
const indicatorCache = new Map<string, Map<string, WorldBankIndicatorValue>>() // iso3 -> (indicator -> value)

function normalizeCode(code: string) { return (code || '').toUpperCase() }

export async function fetchWorldBankMeta(iso3: string): Promise<any | null> {
  const key = normalizeCode(iso3)
  if (metaCache.has(key)) return metaCache.get(key)
  try {
    const url = `https://api.worldbank.org/v2/country/${key}?format=json`
    const res = await fetch(url)
    if (!res.ok) { metaCache.set(key, null); return null }
    const json = await res.json()
    // World Bank returns [metadata, [countryObj]] typically
    const data = Array.isArray(json) && Array.isArray(json[1]) ? json[1][0] : null
    metaCache.set(key, data)
    return data
  } catch (e) {
    metaCache.set(key, null)
    return null
  }
}

export async function fetchWorldBankIndicators(iso3: string, indicators: string[]): Promise<Record<string, WorldBankIndicatorValue>> {
  const key = normalizeCode(iso3)
  if (!indicatorCache.has(key)) indicatorCache.set(key, new Map())
  const isoMap = indicatorCache.get(key)!
  const out: Record<string, WorldBankIndicatorValue> = {}
  const toFetch: string[] = []
  for (const ind of indicators) {
    if (isoMap.has(ind)) out[ind] = isoMap.get(ind)!
    else toFetch.push(ind)
  }
  await Promise.all(toFetch.map(async ind => {
    try {
      const url = `https://api.worldbank.org/v2/country/${key}/indicator/${ind}?format=json&per_page=1000`
      const res = await fetch(url)
      if (!res.ok) { isoMap.set(ind, { indicator: ind, value: null, year: null }); out[ind] = isoMap.get(ind)!; return }
      const json = await res.json()
      const parsed = parseLatestIndicator(json)
      const val: WorldBankIndicatorValue = { indicator: ind, value: parsed.value, year: parsed.year }
      isoMap.set(ind, val)
      out[ind] = val
    } catch (e) {
      isoMap.set(ind, { indicator: ind, value: null, year: null })
      out[ind] = isoMap.get(ind)!
    }
  }))
  return out
}
