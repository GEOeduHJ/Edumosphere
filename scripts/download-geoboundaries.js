#!/usr/bin/env node
// Simple downloader for geoBoundaries layers (ADM0..ADM2 by default)
// Usage: node scripts/download-geoboundaries.js --isos=KOR,USA --levels=ADM0,ADM1,ADM2 --maxBytes=20000000

const fs = require('fs')
const path = require('path')

const rawArgs = process.argv.slice(2)
const argv = {}
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) argv[m[1]] = m[2]
}
const isosArg = argv.isos || argv.i || ''
const levelsArg = argv.levels || argv.l || 'ADM0,ADM1,ADM2'
const maxBytes = Number(argv.maxBytes || argv.maxbytes || 20000000)
const release = argv.release || 'gbOpen'

if (!isosArg) {
  console.error('Missing --isos argument. Example: --isos=KOR,USA')
  process.exit(1)
}

const isos = isosArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
const levels = levelsArg.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)

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

async function download(iso, level) {
  try {
    console.log(`Fetching metadata for ${iso} ${level}...`)
    const metaUrl = `https://www.geoboundaries.org/api/current/${release}/${iso}/${level}/`
    const meta = await fetchJson(metaUrl)
    const m = Array.isArray(meta) ? meta[0] : meta
    if (!m) throw new Error('No metadata')
    const gjUrl = m.gjDownloadURL || m['gjDownloadURL']
    if (!gjUrl) throw new Error('No gjDownloadURL in metadata')

    const size = await headSize(gjUrl)
    if (size && size > maxBytes) {
      console.warn(`Skipping ${iso} ${level}: remote size ${size} > maxBytes ${maxBytes}`)
      return
    }

    console.log(`Downloading GeoJSON from ${gjUrl} ...`)
    const gj = await fetchJson(gjUrl)

    const outDir = path.join(process.cwd(), 'public', 'data', 'geoBoundaries', iso)
    fs.mkdirSync(outDir, { recursive: true })
    const outPath = path.join(outDir, `${level}.geojson`)
    fs.writeFileSync(outPath, JSON.stringify(gj))
    console.log(`Saved ${outPath}`)
  } catch (e) {
    console.error(`Failed ${iso} ${level}:`, e && e.message ? e.message : e)
  }
}

(async () => {
  for (const iso of isos) {
    for (const level of levels) {
      await download(iso, level)
    }
  }
  console.log('Done')
})()
