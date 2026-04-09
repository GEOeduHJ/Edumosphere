#!/usr/bin/env node
const fs = require('fs').promises
const path = require('path')

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch (e) {
    return false
  }
}

function tryIsoFromProps(p) {
  if (!p) return null
  const candidates = ['shapeGroup','shape_group','SHAPE_GRP','shapeISO','shape_iso','ISO_A3','ISO3','ISO3166-1-Alpha-3','ISO_A3_EH','ADM0_A3','adm0_a3','iso_a3','CCA3','cca3','ISO3166_A3','ADM0_A3_EH']
  for (const k of candidates) {
    if (!p[k]) continue
    try {
      const s = String(p[k]).toUpperCase().trim()
      if (/^[A-Z]{3}$/.test(s)) return s
    } catch (e) {}
  }
  return null
}

async function run() {
  const level = (process.argv[2] || 'ADM1').toUpperCase()
  const candidates = [
    path.join('public','data','geoBoundaries', `${level}.geojson`),
    path.join('public','data','geoBoundaries', `geoBoundaries-${level}.geojson`),
    path.join('public','data','geoBoundaries', `${level}-global.geojson`)
  ]

  let inFile = null
  for (const c of candidates) {
    if (await exists(c)) { inFile = c; break }
  }
  if (!inFile) {
    console.error('No input file found for level', level, 'searched:', candidates.join(', '))
    process.exit(1)
  }

  console.log('Reading', inFile)
  const txt = await fs.readFile(inFile, 'utf8')
  let json
  try { json = JSON.parse(txt) } catch (e) { console.error('Invalid JSON in', inFile); process.exit(2) }
  if (!json || !Array.isArray(json.features)) { console.error('No features array in', inFile); process.exit(2) }

  const buckets = Object.create(null)
  for (const f of json.features) {
    const props = (f && f.properties) || {}
    let iso = tryIsoFromProps(props)
    if (!iso) iso = 'UNMAPPED'
    if (!buckets[iso]) buckets[iso] = []
    buckets[iso].push(f)
  }

  const outBase = path.join('public','data','geoBoundaries','split', level)
  await fs.mkdir(outBase, { recursive: true })
  let written = 0
  for (const iso of Object.keys(buckets)) {
    const arr = buckets[iso]
    const outFile = path.join(outBase, `${iso}.geojson`)
    const coll = { type: 'FeatureCollection', features: arr }
    await fs.writeFile(outFile, JSON.stringify(coll, null, 2), 'utf8')
    console.log('Wrote', outFile, arr.length, 'features')
    written++
  }
  console.log(`Done: wrote ${written} files to ${outBase}`)
}

run().catch(err => { console.error(err); process.exit(3) })
