#!/usr/bin/env node
// Estimate total remote download size for geoBoundaries GeoJSON files (ADM levels)
// Usage: node scripts/estimate-geoboundaries-size.js --isos=all --levels=ADM0,ADM1,ADM2

const fs = require('fs')
const path = require('path')

const rawArgs = process.argv.slice(2)
const argv = {}
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) argv[m[1]] = m[2]
}
const isosArg = (argv.isos || argv.i || 'all').trim()
const levelsArg = argv.levels || argv.l || 'ADM0,ADM1,ADM2'
const release = argv.release || 'gbOpen'
const delayMs = Number(argv.delay || 50)

const levels = levelsArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

function tryIsoFromProps(p) {
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

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} when fetching ${url}`)
  return res.json()
}

async function headSize(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' })
    if (!res.ok) return null
    const len = res.headers.get('content-length')
    return len ? Number(len) : null
  } catch (e) { return null }
}

async function getMeta(iso, level) {
  const url = `https://www.geoboundaries.org/api/current/${release}/${iso}/${level}/`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Meta HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  return Array.isArray(json) ? json[0] : json
}

async function sizeForGjUrl(gjUrl) {
  let size = await headSize(gjUrl)
  if (size != null) return size
  // fallback to GET and measure length
  const res = await fetch(gjUrl)
  if (!res.ok) return null
  const txt = await res.text()
  return Buffer.byteLength(txt, 'utf8')
}

function human(n) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB','MB','GB','TB']
  let u = 0
  let v = n
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++ }
  return `${v.toFixed(2)} ${units[u]}`
}

async function main() {
  let isos = []
  if (isosArg.toLowerCase() === 'all') {
    const fpath = path.join(process.cwd(), 'public', 'data', 'world-countries.geojson')
    if (!fs.existsSync(fpath)) {
      console.error('world-countries.geojson not found at', fpath)
      process.exit(1)
    }
    const raw = fs.readFileSync(fpath, 'utf8')
    const json = JSON.parse(raw)
    const set = new Set()
    for (const feat of (json.features || [])) {
      const iso = tryIsoFromProps(feat.properties || {})
      if (iso) set.add(iso)
    }
    isos = Array.from(set).sort()
  } else {
    isos = isosArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
  }

  if (!isos.length) { console.error('No ISOs to process'); process.exit(1) }

  console.log(`Estimating sizes for ${isos.length} ISOs × ${levels.length} levels (${levels.join(',')}) ...`)

  const totals = {}
  for (const l of levels) totals[l] = 0
  let totalBytes = 0
  let missing = 0
  let metaMissing = 0

  for (let i = 0; i < isos.length; i++) {
    const iso = isos[i]
    for (const level of levels) {
      process.stdout.write(`[${i+1}/${isos.length}] ${iso} ${level} ... `)
      try {
        const meta = await getMeta(iso, level)
        if (!meta) { console.log('no-meta'); metaMissing++; missing++; continue }
        const gjUrl = meta.gjDownloadURL || meta.gjdwnld || meta['gjDownloadURL']
        if (!gjUrl) { console.log('no-gj'); missing++; continue }
        const size = await sizeForGjUrl(gjUrl)
        if (size == null) { console.log('no-size'); missing++; continue }
        totals[level] += size
        totalBytes += size
        console.log(human(size))
      } catch (e) {
        console.log('err')
        missing++
      }
      if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    }
  }

  console.log('\nSummary:')
  for (const l of levels) console.log(`- ${l}: ${human(totals[l])} (${totals[l]} bytes)`)
  console.log(`- Total: ${human(totalBytes)} (${totalBytes} bytes)`)
  console.log(`- Missing/failed: ${missing} (meta-missing: ${metaMissing})`)
}

main().catch(e => { console.error(e); process.exit(1) })
