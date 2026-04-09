#!/usr/bin/env node
const fs = require('fs').promises
const path = require('path')

const ADM0_PATH = path.join('public', 'data', 'geoBoundaries', 'ADM0.geojson')
const WORLD_PATH = path.join('public', 'data', 'world-countries.geojson')
const BACKUP_PATH = ADM0_PATH + '.bak'
// optional: use i18n-iso-countries for robust name->ISO mapping
let countries = null
try {
  countries = require('i18n-iso-countries')
  try { countries.registerLocale(require('i18n-iso-countries/langs/en.json')) } catch (e) {}
} catch (e) {
  countries = null
}

function normalizeName(input) {
  if (input === undefined || input === null) return ''
  try {
    let s = String(input).trim()
    s = s.replace(/\s*\(.*?\)\s*/g, ' ')
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    s = s.replace(/[^\w\s-]/g, ' ')
    s = s.replace(/\s+/g, ' ').trim()
    return s.toLowerCase()
  } catch (e) {
    return String(input).toLowerCase()
  }
}

function tryIsoFromProps(p) {
  if (!p) return null
  const candidates = [
    p['shapeGroup'], p['shape_group'], p['SHAPE_GRP'], p['shapeISO'], p['shape_iso'],
    p['ISO_A3'], p['ISO3'], p['ISO3166-1-Alpha-3'], p['ISO_A3_EH'], p['ADM0_A3'], p['adm0_a3'],
    p['iso_a3'], p['CCA3'], p['cca3'], p['ISO3166_A3']
  ]
  for (const c of candidates) {
    if (!c) continue
    try {
      const s = String(c).toUpperCase().trim()
      if (/^[A-Z]{3}$/.test(s)) return s
    } catch (e) { continue }
  }
  return null
}

function getLabelText(feature) {
  const p = feature && feature.properties ? feature.properties : {}
  return p.ADMIN || p.name || p.NAME || p.country_name || p.country || p.admin || p['shapeName'] || ''
}

async function loadJson(p) {
  const txt = await fs.readFile(p, 'utf8')
  return JSON.parse(txt)
}

async function main() {
  try {
    const world = await loadJson(WORLD_PATH)
    const adm0 = await loadJson(ADM0_PATH)

    // build name->iso map from world countries
    const nameToIso = {}
    const iso3ToIso2 = {}
    if (world && Array.isArray(world.features)) {
      for (const f of world.features) {
        try {
          const name = getLabelText(f)
          const iso = tryIsoFromProps(f.properties)
          if (!name) continue
          const norm = normalizeName(name)
          if (iso) {
            nameToIso[name] = iso
            nameToIso[norm] = iso
            // try to find a 2-letter code for this iso3
            try {
              const p = f.properties || {}
              const iso2candidates = [p['ISO3166-1-Alpha-2'], p['ISO_A2'], p['ISO2'], p['iso_a2'], p['CCA2'], p['cca2']]
              for (const c of iso2candidates) {
                if (!c) continue
                const s2 = String(c).toUpperCase().trim()
                if (/^[A-Z]{2}$/.test(s2)) { iso3ToIso2[iso] = s2; break }
              }
            } catch (e) {}
          } else {
            if (!nameToIso[norm]) nameToIso[norm] = null
          }
        } catch (e) {}
      }
    }

    let changed = 0
    const changes = []
    if (adm0 && Array.isArray(adm0.features)) {
      for (let i = 0; i < adm0.features.length; i++) {
        const f = adm0.features[i]
        const props = f.properties = f.properties || {}
        const currentIso = tryIsoFromProps(props)
        // If an ISO3 exists but hyphenated ISO properties are missing, populate them.
        if (currentIso) {
          const needIso3163 = !props['ISO3166-1-Alpha-3']
          const needIso3162 = !props['ISO3166-1-Alpha-2']
          if (!needIso3163 && !needIso3162) {
            continue
          }
          // ensure ISO3166-1-Alpha-3 exists
          try { if (needIso3163) props['ISO3166-1-Alpha-3'] = currentIso } catch (e) {}
          // derive ISO2 if possible
          const iso2 = iso3ToIso2[currentIso]
          if (iso2 && needIso3162) {
            try { props['ISO3166-1-Alpha-2'] = iso2 } catch (e) {}
            try { props['ISO_A2'] = iso2 } catch (e) {}
          }
          if (!needIso3163 && !needIso3162) continue
          // if we populated missing fields, record change
          changes.push({ index: i, name: getLabelText(f), mapped: currentIso, old: { shapeGroup: props.shapeGroup || null, ADM0_A3: props.ADM0_A3 || null } })
          changed++
          continue
        }

        // try label-based mapping
        const label = getLabelText(f) || props['NAME'] || props['shapeName'] || props['ADMIN'] || ''
        const norm = normalizeName(label)
        let mapped = null
        if (label && nameToIso[label]) mapped = nameToIso[label]
        if (!mapped && norm && nameToIso[norm]) mapped = nameToIso[norm]

        // fuzzy search: normalized keys that include or are included by norm
        if (!mapped && norm) {
          for (const k of Object.keys(nameToIso)) {
            if (!k) continue
            const kk = normalizeName(k)
            if (!kk) continue
            if (kk === norm || kk.includes(norm) || norm.includes(kk)) {
              const candidate = nameToIso[k]
              if (candidate) { mapped = candidate; break }
            }
          }
        }

        // try i18n-iso-countries fallback if available (robust name -> alpha2 -> alpha3)
        if (!mapped && countries) {
          try {
            const alpha2 = countries.getAlpha2Code(label, 'en') || countries.getAlpha2Code(norm, 'en')
            if (alpha2) {
              const alpha3 = countries.alpha2ToAlpha3(alpha2)
              if (alpha3) mapped = alpha3
            }
          } catch (e) {}
        }

        if (mapped) {
          const old = { shapeGroup: props.shapeGroup || null, ADM0_A3: props.ADM0_A3 || null }
          props.shapeGroup = mapped
          props.ADM0_A3 = mapped
          props.ISO_A3 = mapped
          props.ISO3 = mapped
          // set standard ISO3166 fields explicitly for compatibility
          try { props['ISO3166-1-Alpha-3'] = mapped } catch (e) {}
          const iso2 = iso3ToIso2[mapped]
          if (iso2) {
            try { props['ISO3166-1-Alpha-2'] = iso2 } catch (e) {}
            try { props['ISO_A2'] = iso2 } catch (e) {}
          }
          changes.push({ index: i, name: label, mapped, old })
          changed++
        }
      }
    }

    if (changed > 0) {
      // backup
      try {
        await fs.writeFile(BACKUP_PATH, JSON.stringify(adm0, null, 2), 'utf8')
      } catch (e) {
        // if backup fails just continue
      }
      // write updated ADM0
      await fs.writeFile(ADM0_PATH, JSON.stringify(adm0, null, 2), 'utf8')
    }

    console.log(`ADM0 preprocessing complete. Features scanned: ${adm0.features.length}. Updated: ${changed}`)
    if (changes.length > 0) console.log('Sample changes:', changes.slice(0,10))
    process.exit(0)
  } catch (e) {
    console.error('Error in ADM0 preprocessing:', e)
    process.exit(2)
  }
}

main()
