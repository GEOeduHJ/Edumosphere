// Serverless proxy for geoBoundaries geojson
// Deploys on Vercel at /api/geoboundaries/:iso/:level
// Purpose: fetch GeoJSON server-side to avoid CORS and missing static LFS files in client builds.

const cache = global.__GEO_PROXY_CACHE ||= new Map()
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

function cacheGet(key) {
  const v = cache.get(key)
  if (!v) return null
  if (Date.now() - v.t > CACHE_TTL_MS) { cache.delete(key); return null }
  return v.val
}

function cacheSet(key, val) {
  cache.set(key, { t: Date.now(), val })
}

export default async function handler(req, res) {
  try {
    // read iso and level from URL params (Vercel/Next style available in req.query)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const parts = url.pathname.split('/').filter(Boolean)
    // expected path: /api/geoboundaries/:iso/:level
    const iso = parts[2] || (url.searchParams.get('iso') || '')
    const level = parts[3] || (url.searchParams.get('level') || '')
    if (!iso || !level) {
      res.statusCode = 400
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.end(JSON.stringify({ error: 'missing iso or level' }))
    }
    const key = `${iso.toUpperCase()}|${level.toUpperCase()}`
    const cached = cacheGet(key)
    if (cached) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.end(JSON.stringify(cached))
    }

    // 1) fetch metadata from geoboundaries API
    const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${encodeURIComponent(iso)}/${encodeURIComponent(level)}/`
    let meta
    try {
      const mres = await fetch(metaUrl)
      if (!mres.ok) throw new Error('meta fetch failed')
      meta = await mres.json()
      if (Array.isArray(meta) && meta.length > 0) meta = meta[0]
    } catch (e) {
      meta = null
    }

    // helper to attempt fetch of a URL and parse JSON
    async function tryFetchJson(u) {
      try {
        const r = await fetch(u)
        if (!r.ok) return null
        const j = await r.json()
        return j
      } catch (e) { return null }
    }

    // 2) try meta-provided download URL(s)
    let gj = null
    if (meta) {
      const gjUrl = meta.gjDownloadURL || meta.gjdwnld || meta.gjdownload || meta.gj || meta['gjDownloadURL']
      if (gjUrl) {
        gj = await tryFetchJson(gjUrl)
        // fallback rewrite for github.com/.../raw/... -> raw.githubusercontent.com
        if (!gj) {
          const ghMatch = String(gjUrl).match(/^https?:\/\/github\.com\/(.+?)\/(.+?)\/raw\/(.+?)\/(.+)$/i)
          if (ghMatch) {
            const owner = ghMatch[1]
            const repo = ghMatch[2]
            const commit = ghMatch[3]
            const rest = ghMatch[4]
            const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${commit}/${rest}`
            gj = await tryFetchJson(raw)
          }
        }
      }
    }

    // 3) As a last resort, try the official per-country raw locations on github (gbOpen release path pattern)
    if (!gj) {
      // try common raw paths used by geoBoundaries releases
      const candidates = [
        `https://raw.githubusercontent.com/wmgeolab/geoBoundaries/main/releaseData/gbOpen/${iso}/ADM1/geoBoundaries-${iso}-ADM1.geojson`,
        `https://github.com/wmgeolab/geoBoundaries/raw/main/releaseData/gbOpen/${iso}/ADM1/geoBoundaries-${iso}-ADM1.geojson`
      ]
      for (const c of candidates) {
        gj = await tryFetchJson(c)
        if (gj) break
      }
    }

    if (!gj) {
      res.statusCode = 404
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.end(JSON.stringify({ error: 'no geojson found' }))
    }

    cacheSet(key, gj)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.end(JSON.stringify(gj))
  } catch (err) {
    res.statusCode = 500
    res.setHeader('Access-Control-Allow-Origin', '*')
    try { res.end(JSON.stringify({ error: String(err) })) } catch (e) { res.end('error') }
  }
}
