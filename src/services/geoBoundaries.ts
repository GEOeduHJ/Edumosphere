import { FeatureCollection, Feature } from 'geojson'
import { getLabelText } from '../utils/label'

let worldCache: FeatureCollection | null = null
let nameToIsoCache: Record<string, string> | null = null
let isoToFeaturesCache: Map<string, Feature[]> | null = null
// cache global ADM files per level (e.g., ADM0, ADM1)
const globalAdmCache: Map<string, FeatureCollection | null> = new Map()

// normalize names for better matching (remove diacritics, punctuation, parentheticals)
function normalizeName(input: any): string {
  if (!input && input !== 0) return ''
  try {
    let s = String(input).trim()
    // remove parenthetical content: "France (Metropolitan)" -> "France"
    s = s.replace(/\s*\(.*?\)\s*/g, ' ')
    // Unicode normalize and strip diacritics
    s = s.normalize && s.normalize('NFD') ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s
    // remove punctuation except word chars and spaces
    s = s.replace(/[^\w\s-]/g, ' ')
    s = s.replace(/\s+/g, ' ').trim()
    return s.toLowerCase()
  } catch (e) {
    return String(input).toLowerCase()
  }
}

function tryIsoFromProps(p: any): string | null {
  if (!p) return null
  const candidates = [
    // common geoBoundaries properties
    p['shapeGroup'],
    p['shape_group'],
    p['SHAPE_GRP'],
    p['shapeISO'],
    p['shape_iso'],
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
  for (const c of candidates) {
    if (!c) continue
    try {
      const s = String(c).toUpperCase().trim()
      // Accept only 3-letter alphabetic ISO3 codes (ignore '-99' and numeric junk)
      if (/^[A-Z]{3}$/.test(s)) return s
    } catch (e) {
      continue
    }
  }
  return null
}

export async function fetchWorldCountries(): Promise<FeatureCollection | null> {
  if (worldCache) return worldCache
  try {
    const res = await fetch('/data/geoBoundaries/ADM0.geojson')
    if (res && res.ok) {
      // read as text first to detect Git LFS pointer files that look like:
      // "version https://git-lfs.github.com/spec/v1"
      const txt = await res.text()
      if (typeof txt === 'string' && txt.trim().startsWith('version https://git-lfs.github.com/spec/v1')) {
        // LFS pointer detected; fall through to lightweight fallback
      } else {
        try {
          const json = JSON.parse(txt)
          if (json && Array.isArray(json.features)) {
            worldCache = json as FeatureCollection
            // build caches
            const nameMap: Record<string,string> = {}
            const isoMap = new Map<string, Feature[]>()
            for (const f of worldCache.features as Feature[]) {
              try {
                const name = getLabelText(f)
                const iso = tryIsoFromProps(f.properties)
                if (name) {
                  const norm = normalizeName(name)
                  if (iso) {
                    if (!nameMap[name]) nameMap[name] = iso
                    if (!nameMap[norm]) nameMap[norm] = iso
                  } else {
                    if (!nameMap[name]) nameMap[name] = nameMap[name] || null as any
                    if (!nameMap[norm]) nameMap[norm] = nameMap[norm] || null as any
                  }
                }
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
          }
        } catch (e) {
          // JSON parse failed; fall through to fallback below
        }
      }
    }

    // Fallback: if local ADM0 isn't available (or is an LFS pointer), use restcountries
    // to build a lightweight name->ISO map and a placeholder FeatureCollection so the
    // app can list countries and map names->ISO. Geometry will be requested per-ISO
    // using `fetchAdminBoundaries` when needed.
    try {
      const r = await fetch('https://restcountries.com/v3.1/all')
      if (!r.ok) return null
      const arr = await r.json()
      if (!Array.isArray(arr)) return null
      const features: Feature[] = []
      const nameMap: Record<string,string> = {}
      const isoMap = new Map<string, Feature[]>()
      for (const c of arr) {
        try {
          const common = (c && c.name && (c.name.common || c.name.official)) || c.name || (c && c.translations && Object.values(c.translations)[0]) || null
          const name = typeof common === 'string' ? common : (c.name && c.name.common) || ''
          const iso = (c && (c.cca3 || c.CCA3 || c.ccn3)) || null
          const props: any = { NAME: name }
          if (iso) props['CCA3'] = iso
          // placeholder feature without geometry; consumers must request real geometries as needed
          features.push({ type: 'Feature', properties: props, geometry: null as any })
          if (name) {
            const norm = normalizeName(name)
            if (iso) {
              nameMap[name] = iso
              nameMap[norm] = iso
            } else {
              if (!nameMap[name]) nameMap[name] = nameMap[name] || null as any
              if (!nameMap[norm]) nameMap[norm] = nameMap[norm] || null as any
            }
          }
          if (iso) {
            isoMap.set(String(iso).toUpperCase(), [])
          }
        } catch (e) {}
      }
      const pseudo: FeatureCollection = { type: 'FeatureCollection', features }
      worldCache = pseudo
      nameToIsoCache = nameMap
      isoToFeaturesCache = isoMap
      return worldCache
    } catch (e) {
      return null
    }
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
  if (adminCache.has(key)) {
    const cached = adminCache.get(key)
    if (cached) return cached
    // If we previously cached a null (failed attempt), allow a retry for
    // ADM1/ADM0 if a local global ADM file now exists. This handles the
    // case where a local composite was added after an earlier failure.
    const lvlU = (level || '').toUpperCase()
    if (lvlU === 'ADM1' || lvlU === 'ADM0') {
        // First: check if a per-ISO split file exists (preferred over global composite)
        try {
          const splitPath = `/data/geoBoundaries/split/${lvlU}/${code}.geojson`
          try {
            const sp = await fetch(splitPath)
            if (sp && sp.ok) {
              const txtSp = await sp.text()
              if (!(typeof txtSp === 'string' && txtSp.trim().startsWith('version https://git-lfs.github.com/spec/v1'))) {
                try {
                  const parsedSp = JSON.parse(txtSp)
                  if (parsedSp && Array.isArray(parsedSp.features)) {
                    adminCache.set(key, parsedSp as FeatureCollection)
                    // eslint-disable-next-line no-console
                    console.log('fetchAdminBoundaries: using local split file (retry) for', code, lvlU, splitPath)
                    return parsedSp as FeatureCollection
                  }
                } catch (ee) {}
              }
            }
          } catch (e) {}
        } catch (e) {}
      // Try the deployed server API first to avoid many HEAD/GET attempts
      // against candidate static files. This reduces console noise and
      // speeds up common cases where the serverless endpoint is available.
      try {
        const proxyRes = await fetch(`/api/geoboundaries/${code}/${lvlU}`)
        if (proxyRes.ok) {
          const pj = await proxyRes.json().catch(() => null)
          if (pj && Array.isArray(pj.features)) {
            adminCache.set(key, pj as FeatureCollection)
            // eslint-disable-next-line no-console
            console.log('fetchAdminBoundaries: using server API (cached-null retry) for', code, lvlU)
            return pj as FeatureCollection
          }
        }
      } catch (e) {}

      const localCandidatesCheck = lvlU === 'ADM1'
        ? [
            '/data/geoBoundaries/ADM1.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM1.geojson',
            '/data/geoBoundaries/ADM1-global.geojson',
            '/data/geoBoundaries/gbOpen_ADM1.geojson'
          ]
        : [
            '/data/geoBoundaries/ADM0.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM0.geojson',
            '/data/geoBoundaries/ADM0-global.geojson',
            '/data/geoBoundaries/gbOpen_ADM0.geojson'
          ]
      let found = false
      for (const p of localCandidatesCheck) {
        try {
          const r = await fetch(p, { method: 'HEAD' })
          if (r && r.ok) { found = true; break }
        } catch (e) {}
      }
      if (!found) return null
      // allow reattempt by removing the cached null
      adminCache.delete(key)
    } else {
      return null
    }
  }
  // First: if requesting ADM1, prefer a single global local file if present (official global ADM1 download ~350MB).
  // This avoids repeated remote fetches and CORS/redirect issues for large combined files.
  try {
    const lvlU = (level || '').toUpperCase()
    if (lvlU === 'ADM1' || lvlU === 'ADM0') {
      // 1) Try a per-ISO split file under public first (fast, local fetch)
      try {
        const splitPath = `/data/geoBoundaries/split/${lvlU}/${code}.geojson`
        const sp = await fetch(splitPath)
        if (sp && sp.ok) {
          const txtSp = await sp.text()
          if (!(typeof txtSp === 'string' && txtSp.trim().startsWith('version https://git-lfs.github.com/spec/v1'))) {
            try {
              const parsedSp = JSON.parse(txtSp)
              if (parsedSp && Array.isArray(parsedSp.features)) {
                adminCache.set(key, parsedSp as FeatureCollection)
                // eslint-disable-next-line no-console
                console.log('fetchAdminBoundaries: using local split file', splitPath)
                return parsedSp as FeatureCollection
              }
            } catch (e) {}
          }
        }
      } catch (e) {}

      // 2) Try the deployed server API which can return per-ISO ADM.
      try {
        const proxyRes = await fetch(`/api/geoboundaries/${code}/${lvlU}`)
        if (proxyRes.ok) {
          const pj = await proxyRes.json().catch(() => null)
          if (pj && Array.isArray(pj.features)) {
            adminCache.set(key, pj as FeatureCollection)
            // eslint-disable-next-line no-console
            console.log('fetchAdminBoundaries: using server API for', code, lvlU)
            return pj as FeatureCollection
          }
        }
      } catch (e) {}

      // 3) Fallback: try local global composite files and filter by ISO
      const globalCandidates = lvlU === 'ADM1'
        ? [
            '/data/geoBoundaries/ADM1.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM1.geojson',
            '/data/geoBoundaries/ADM1-global.geojson',
            '/data/geoBoundaries/gbOpen_ADM1.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM1.json',
            '/data/geoBoundaries/ADM1.json'
          ]
        : [
            '/data/geoBoundaries/ADM0.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM0.geojson',
            '/data/geoBoundaries/ADM0-global.geojson',
            '/data/geoBoundaries/gbOpen_ADM0.geojson',
            '/data/geoBoundaries/geoBoundaries-ADM0.json',
            '/data/geoBoundaries/ADM0.json'
          ]

      for (const p of globalCandidates) {
        try {
          // reuse in-memory global cache if already loaded for this level
          let j: FeatureCollection | null = globalAdmCache.get(lvlU) || null
          if (!j) {
            const r = await fetch(p)
            if (!r.ok) continue
            // read as text first so we can detect Git LFS pointer files which
            // start with: "version https://git-lfs.github.com/spec/v1"
            const txt = await r.text()
            if (typeof txt === 'string' && txt.trim().startsWith('version https://git-lfs.github.com/spec/v1')) {
              // Detected LFS pointer in deployed static asset. Fall back to
              // serverless proxy which can fetch per-ISO ADM data from
              // geoboundaries.org. We return the proxy result for this ISO
              // and level when available.
              try {
                const proxyRes = await fetch(`/api/geoboundaries/${code}/${lvlU}`)
                if (proxyRes.ok) {
                  const pj = await proxyRes.json().catch(() => null)
                  if (pj && Array.isArray(pj.features)) {
                    adminCache.set(key, pj as FeatureCollection)
                    // eslint-disable-next-line no-console
                    console.log('fetchAdminBoundaries: detected LFS pointer; using server API for', code, lvlU)
                    return pj as FeatureCollection
                  }
                }
              } catch (e) {}
              // proxy fallback failed; continue to next candidate
              continue
            }
            let parsed: any = null
            try { parsed = JSON.parse(txt) } catch (e) { parsed = null }
            if (!parsed || !Array.isArray(parsed.features)) continue
            j = parsed as FeatureCollection
            globalAdmCache.set(lvlU, j)
          }
          if (j && Array.isArray(j.features)) {
            // ensure we have country name->iso map to help match features that lack proper shapeGroup
            if (!nameToIsoCache) await fetchWorldCountries()

            const matchesFeature = (f: Feature) => {
              try {
                const props = (f as any).properties || {}
                const isoProp = tryIsoFromProps(props)
                if (isoProp && String(isoProp).toUpperCase() === code) return true
                // try label-based matching for features with missing/invalid shapeGroup (e.g. '-99')
                try {
                  const lbl = getLabelText(f)
                  if (lbl && nameToIsoCache) {
                    const lblNorm = normalizeName(lbl)
                    const mapped = nameToIsoCache[lbl] || nameToIsoCache[lblNorm]
                    if (mapped && String(mapped).toUpperCase() === code) return true
                    // Fuzzy match against normalized keys in the cache
                    for (const k of Object.keys(nameToIsoCache)) {
                      if (!k) continue
                      const kkNorm = normalizeName(k)
                      if (!kkNorm) continue
                      if (kkNorm === lblNorm || kkNorm.includes(lblNorm) || lblNorm.includes(kkNorm)) {
                        const mapped2 = nameToIsoCache[k]
                        if (mapped2 && String(mapped2).toUpperCase() === code) return true
                      }
                    }
                  }
                } catch (e) {}
                // try alternate name-like properties
                const altNames = [props['shapeName'], props['shape_name'], props['SHAPE_NAME'], props['shapeName_en'], props['NAME_EN'], props['NAME'], props['ADMIN'], props['COUNTRY'], props['country']]
                for (const n of altNames) {
                  if (!n) continue
                  const nStr = String(n)
                  const nNorm = normalizeName(nStr)
                  if (nameToIsoCache) {
                    const mapped3 = nameToIsoCache[nStr] || nameToIsoCache[nNorm]
                    if (mapped3 && String(mapped3).toUpperCase() === code) return true
                    for (const k of Object.keys(nameToIsoCache)) {
                      if (!k) continue
                      const kkNorm = normalizeName(k)
                      if (!kkNorm) continue
                      if (kkNorm === nNorm || kkNorm.includes(nNorm) || nNorm.includes(kkNorm)) {
                        const mapped4 = nameToIsoCache[k]
                        if (mapped4 && String(mapped4).toUpperCase() === code) return true
                      }
                    }
                  }
                }
              } catch (e) {}
              return false
            }

            const feats = (j.features as Feature[]).filter(matchesFeature)
            if (feats && feats.length > 0) {
              const filtered: FeatureCollection = { type: 'FeatureCollection', features: feats }
              // cache per-country result so subsequent calls are fast
              adminCache.set(key, filtered)
              // eslint-disable-next-line no-console
              console.log('fetchAdminBoundaries: using local global', lvlU, 'file (filtered)', p, 'features:', feats.length)
              return filtered
            }
            // otherwise fallthrough to try server-side proxy / API
            // eslint-disable-next-line no-console
            console.log('fetchAdminBoundaries: local', lvlU, 'found but no features for', code, 'in', p)
          }
        } catch (e) {
          continue
        }
      }
    }
  } catch (e) {}

  // Do not attempt remote fetches in the client build. ADM0/ADM1 data
  // must be provided locally under `public/data/geoBoundaries/`.
  // If no local features were found for the requested ISO/level, return null.
  adminCache.set(key, null)
  return null
}
