import { FeatureCollection, Feature } from 'geojson'
import { getLabelText } from '../utils/label'

let worldCache: FeatureCollection | null = null
let nameToIsoCache: Record<string, string> | null = null
let isoToFeaturesCache: Map<string, Feature[]> | null = null

function tryIsoFromProps(p: any): string | null {
  if (!p) return null
  const candidates = [
    p['ISO_A3'],
    p['ISO3'],
    p['ISO3166-1-Alpha-3'],
    p['ISO_A3_EH'],
    p['ADM0_A3'],
    p['adm0_a3'],
    p['iso_a3'],
    p['CCA3'],
    p['cca3'],
    p['ISO3166_A3']
  ]
  for (const c of candidates) if (c) return String(c).toUpperCase()
  return null
}

export async function fetchWorldCountries(): Promise<FeatureCollection | null> {
  if (worldCache) return worldCache
  try {
    const res = await fetch('/data/world-countries.geojson')
    if (!res.ok) return null
    const json = await res.json()
    if (!json || !Array.isArray(json.features)) return null
    worldCache = json as FeatureCollection
    // build caches
    const nameMap: Record<string,string> = {}
    const isoMap = new Map<string, Feature[]>()
    for (const f of worldCache.features as Feature[]) {
      try {
        const name = getLabelText(f)
        const iso = tryIsoFromProps(f.properties)
        if (name && iso && !nameMap[name]) nameMap[name] = iso
        if (iso) {
          const arr = isoMap.get(iso) || []
          arr.push(f)
          isoMap.set(iso, arr)
        }
      } catch (e) {}
    }
    nameToIsoCache = nameMap
    isoToFeaturesCache = isoMap
    return worldCache
  } catch (e) {
    return null
  }
}

export function getNameToIsoMap(): Record<string, string> {
  return nameToIsoCache || {}
}

export function getIsoToFeaturesMap(): Map<string, Feature[]> {
  return isoToFeaturesCache || new Map()
}

const adminCache = new Map<string, FeatureCollection | null>() // key = `${ISO3}|${LEVEL}`

async function fetchGeoBoundariesMetadata(iso3: string, level: string, release = 'gbOpen'): Promise<any | null> {
  try {
    const url = `https://www.geoboundaries.org/api/current/${release}/${iso3}/${level}/`
    // in dev, use the vite dev proxy for known hosts to avoid CORS
    const isDev = !!((import.meta as any).env && (import.meta as any).env.DEV)
    const shouldProxy = (u: string) => {
      try {
        const h = new URL(u).hostname
        return /geoboundaries\.org$/.test(h) || /github\.com$/.test(h) || /raw\.githubusercontent\.com$/.test(h)
      } catch (e) { return false }
    }
    const fetchUrl = isDev && shouldProxy(url) ? `/__gbproxy?url=${encodeURIComponent(url)}` : url

    const res = await fetch(fetchUrl)
    if (!res.ok) return null
    const json = await res.json()
    // sometimes returned as array or object; normalize to first element
    if (Array.isArray(json) && json.length > 0) return json[0]
    if (json && typeof json === 'object') return json
    return null
  } catch (e) {
    return null
  }
}

async function fetchGeoBoundariesGeoJSONFromMeta(meta: any): Promise<FeatureCollection | null> {
  try {
    const gjUrl = meta && (meta['gjDownloadURL'] || meta['gjdwnld'] || meta['gjDownloadURL'])
    if (!gjUrl) return null
    const isDev = !!((import.meta as any).env && (import.meta as any).env.DEV)
    const shouldProxy = (u: string) => {
      try {
        const host = new URL(u).hostname
        return /github\.com$/.test(host) || /raw\.githubusercontent\.com$/.test(host) || /geoboundaries\.org$/.test(host)
      } catch (e) { return false }
    }
    const proxied = (u: string) => `/__gbproxy?url=${encodeURIComponent(u)}`

    // Primary attempt: fetch the provided URL (use dev proxy when appropriate)
    try {
      const use = isDev && shouldProxy(gjUrl) ? proxied(gjUrl) : gjUrl
      const res = await fetch(use)
      if (res.ok) {
        const json = await res.json()
        if (json && Array.isArray(json.features)) return json as FeatureCollection
      }
    } catch (e) {
      // network/CORS error — we'll attempt fallbacks below
    }

    // Fallback 1: if GitHub "raw" URL was given via github.com/.../raw/, rewrite to raw.githubusercontent.com
    try {
      const ghMatch = String(gjUrl).match(/^https?:\/\/github\.com\/(.+?)\/(.+?)\/raw\/(.+?)\/(.+)$/i)
      if (ghMatch) {
        const owner = ghMatch[1]
        const repo = ghMatch[2]
        const commit = ghMatch[3]
        const rest = ghMatch[4]
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${rest}`
        try {
          const r2 = await fetch(isDev && shouldProxy(rawUrl) ? proxied(rawUrl) : rawUrl)
          if (r2.ok) {
            const json2 = await r2.json()
            if (json2 && Array.isArray(json2.features)) return json2 as FeatureCollection
          }
        } catch (e) {
          // ignore and fallthrough
        }
      }
    } catch (e) {}

    // Fallback 2: as a last resort (dev only), try AllOrigins proxy to avoid CORS. This helps local dev but
    // should not be used in production. We attempt it only if previous attempts failed.
    try {
      const proxy = 'https://api.allorigins.win/raw?url='
      const proxied = proxy + encodeURIComponent(gjUrl)
      const p = await fetch(proxied)
      if (p.ok) {
        const jsonp = await p.json().catch(() => null)
        // AllOrigins may return raw text; attempt parse if needed
        if (!jsonp) {
          try {
            const txt = await p.text()
            const parsed = JSON.parse(txt)
            if (parsed && Array.isArray(parsed.features)) return parsed as FeatureCollection
          } catch (e) {}
        } else if (Array.isArray(jsonp.features)) {
          return jsonp as FeatureCollection
        }
      }
    } catch (e) {}

    return null
  } catch (e) {
    return null
  }
}

export async function fetchAdminBoundaries(iso3: string, level: string = 'ADM1'): Promise<FeatureCollection | null> {
  if (!iso3) return null
  const code = iso3.toUpperCase()
  const key = `${code}|${level}`
  if (adminCache.has(key)) return adminCache.get(key) || null
  // First attempt: server-side proxy endpoint (recommended)
  try {
    const apiUrl = `/api/geoboundaries/${code}/${level}`
    const res = await fetch(apiUrl)
    if (res.ok) {
      const json = await res.json()
      if (json && Array.isArray(json.features)) {
        adminCache.set(key, json as FeatureCollection)
        return json as FeatureCollection
      }
    }
  } catch (e) {
    // ignore and fallback to direct API usage
  }

  // Fallback: directly query geoBoundaries metadata and try to fetch the GeoJSON (dev proxy and fallbacks may apply)
  try {
    const meta = await fetchGeoBoundariesMetadata(code, level, 'gbOpen')
    if (meta) {
      const gj = await fetchGeoBoundariesGeoJSONFromMeta(meta)
      adminCache.set(key, gj)
      return gj
    }
  } catch (e) {
    // swallow errors but cache null to avoid repeated failed attempts
  }

  adminCache.set(key, null)
  return null
}
