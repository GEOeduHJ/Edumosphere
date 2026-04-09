// Catch-all serverless proxy for geoBoundaries geojson
// Deploys at: /api/geoboundaries/proxy/:iso/:level
// Returns GeoJSON with CORS header to avoid client-side CORS issues.

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

async function tryFetchJson(u) {
  try {
    const r = await fetch(u)
    if (!r.ok) return null
    return await r.json()
  } catch (e) { return null }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const parts = url.pathname.split('/').filter(Boolean)
    // parts: ['api','geoboundaries','proxy', ...slug]
    const slug = parts.slice(3)
    const iso = slug[0] || (url.searchParams.get('iso') || '')
    const level = slug[1] || (url.searchParams.get('level') || '')

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

    // 1) try geoBoundaries metadata
    let meta = null
    try {
      const mres = await fetch(`https://www.geoboundaries.org/api/current/gbOpen/${encodeURIComponent(iso)}/${encodeURIComponent(level)}/`)
      if (mres.ok) {
        meta = await mres.json()
        if (Array.isArray(meta) && meta.length > 0) meta = meta[0]
      }
    } catch (e) { meta = null }

    // 2) try meta gjDownloadURL
    let gj = null
    if (meta) {
      const gjUrl = meta.gjDownloadURL || meta.gjdwnld || meta.gj || meta['gjDownloadURL']
      if (gjUrl) {
        gj = await tryFetchJson(gjUrl)
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

    // 3) try known raw paths
    if (!gj) {
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
