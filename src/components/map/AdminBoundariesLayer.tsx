import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { fetchAdminBoundaries } from '../../services/geoBoundaries'

type Props = {
  iso3List: string[]
  enabled: boolean
  level?: string
  strokeColor?: string
  interactive?: boolean
  stylesMap?: Record<string, any>
  isoToNameMap?: Record<string, string>
}

const AdminBoundariesLayer: React.FC<Props> = ({ iso3List, enabled, level = 'ADM1', strokeColor = '#333', interactive = false, stylesMap, isoToNameMap }) => {
  const map = useMap()
  const layersRef = useRef<Map<string, L.Layer>>(new Map())

  const paneName = 'adminBoundariesPane'

  useEffect(() => {
    let mounted = true

    // ensure pane exists and set pointer events based on interactivity
    try {
      if ((map as any).createPane && !(map as any).getPane(paneName)) {
        ;(map as any).createPane(paneName)
      }
      const p = (map as any).getPane(paneName)
      if (p && p.style) {
        // high z-index so admin boundaries render above country fills and canvas layers
        p.style.zIndex = '10000'
        p.style.pointerEvents = interactive ? 'auto' : 'none'
      }
    } catch (e) {
      // ignore pane errors
    }

    const levelStyles: Record<string, { weight: number; color: string }> = {
      ADM0: { weight: 2.0, color: '#333' },
      ADM1: { weight: 1.6, color: '#444' },
      ADM2: { weight: 1.2, color: '#666' },
      ADM3: { weight: 1.0, color: '#888' },
      ADM4: { weight: 0.8, color: '#aaa' },
      ADM5: { weight: 0.6, color: '#ccc' }
    }
    const s = levelStyles[level] || { weight: 1.0, color: strokeColor }

      // helper to resolve style entry from stylesMap with fallbacks
      const findStyleFor = (map: Record<string, any> | undefined, name?: string, iso?: string) => {
        if (!map) return undefined
        if (name && map[name]) return map[name]
        if (name) {
          const n = name.trim().toLowerCase()
          for (const k of Object.keys(map)) {
            if (!k) continue
            if (k.trim().toLowerCase() === n) return map[k]
          }
          for (const k of Object.keys(map)) {
            if (!k) continue
            const kk = k.trim().toLowerCase()
            if (kk.includes(n) || n.includes(kk)) return map[k]
          }
        }
        if (iso) {
          const iu = iso.toUpperCase()
          if (map[iu]) return map[iu]
          for (const k of Object.keys(map)) {
            if (!k) continue
            if (k.trim().toUpperCase() === iu) return map[k]
          }
        }
        return undefined
      }

      const addFor = async (iso3: string) => {
      if (!iso3) return
      const key = `${iso3}|${level}`
      if (layersRef.current.has(key)) return
      try {
        const gj = await fetchAdminBoundaries(iso3, level)
        if (!mounted || !gj) {
          // helpful debug when remote fetch failed (CORS or 404)
          // eslint-disable-next-line no-console
          console.warn('AdminBoundariesLayer: no GeoJSON returned for', iso3, level)
          return
        }

        // derive country-level custom style (stylesMap keyed by country name)
        const countryName = (isoToNameMap && isoToNameMap[iso3]) || undefined
        // fallback: try to read name from geo features if iso->name map not provided
        let inferredCountryName: string | undefined = countryName
        if (!inferredCountryName) {
          try {
            const maybe = (gj.features && gj.features[0] && gj.features[0].properties && (gj.features[0].properties['shapeName'] || gj.features[0].properties['COUNTRY'] || gj.features[0].properties['country']))
            if (maybe) inferredCountryName = String(maybe)
          } catch (e) {}
        }
        // attempt to resolve a style from stylesMap using several fallbacks
        const findStyleFor = (map: Record<string, any> | undefined, name?: string, iso?: string) => {
          if (!map) return undefined
          if (name && map[name]) return map[name]
          if (name) {
            const n = name.trim().toLowerCase()
            for (const k of Object.keys(map)) {
              if (!k) continue
              if (k.trim().toLowerCase() === n) return map[k]
            }
            for (const k of Object.keys(map)) {
              if (!k) continue
              const kk = k.trim().toLowerCase()
              if (kk.includes(n) || n.includes(kk)) return map[k]
            }
          }
          if (iso) {
            const iu = iso.toUpperCase()
            if (map[iu]) return map[iu]
            for (const k of Object.keys(map)) {
              if (!k) continue
              if (k.trim().toUpperCase() === iu) return map[k]
            }
          }
          return undefined
        }

        const custom = findStyleFor(stylesMap, inferredCountryName, iso3) || {}
        try { console.debug && console.debug('AdminBoundariesLayer style lookup', { iso3, inferredCountryName, custom }) } catch (e) {}

        const computeStyle = (feature: any) => {
          const base: any = { color: s.color || strokeColor, weight: s.weight || 1.0 }
          const out: any = { ...base }
          if (custom && custom.fillColor) out.fillColor = custom.fillColor
          // coerce fillOpacity from string/number if present, otherwise default 0 (no fill)
          let fo: number | undefined = undefined
          if (typeof custom.fillOpacity === 'number') fo = custom.fillOpacity
          else if (typeof custom.fillOpacity === 'string' && custom.fillOpacity.trim() !== '' && !isNaN(Number(custom.fillOpacity))) fo = Number(custom.fillOpacity)
          out.fillOpacity = typeof fo === 'number' ? fo : 0
          out.fill = out.fillOpacity > 0
          return out
        }

        const geo = L.geoJSON(gj as any, {
          pane: paneName,
          style: computeStyle,
          interactive: interactive,
          onEachFeature: interactive
            ? (feature: any, layer: L.Layer) => {
                // placeholder: could emit events or integrate with map state
                ;(layer as any).on && (layer as any).on('click', () => {})
              }
            : undefined
        })

        geo.addTo(map)
        // schedule bringToFront to ensure DOM order after add
        try {
          setTimeout(() => {
            geo.eachLayer((ly: any) => {
              try { ly.bringToFront && ly.bringToFront() } catch (e) {}
            })
            // also force pane to the top of map container
            try {
              const p = (map as any).getPane(paneName)
              if (p && p.parentNode) p.parentNode.appendChild(p)
            } catch (e) {}
          }, 0)
        } catch (e) {}

        layersRef.current.set(key, geo)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('AdminBoundariesLayer fetch failed for', iso3, level, e)
      }
    }

    // when stylesMap or iso->name mapping changes, update existing layers' styles
    try {
      // small debounce - schedule update on next tick
      setTimeout(() => {
        try {
          for (const [k, geo] of layersRef.current.entries()) {
            try {
              const parts = String(k).split('|')
              const iso = parts[0]
              const lvl = parts[1]
              if (lvl !== level) continue
              // determine name used for style lookup
              let nameForIso = isoToNameMap && isoToNameMap[iso]
              if (!nameForIso) {
                try {
                  const gj = (geo as any).toGeoJSON ? (geo as any).toGeoJSON() : undefined
                  const maybe = gj && gj.features && gj.features[0] && gj.features[0].properties && (gj.features[0].properties['shapeName'] || gj.features[0].properties['COUNTRY'] || gj.features[0].properties['country'])
                  if (maybe) nameForIso = String(maybe)
                } catch (e) {}
              }
              const customStyle = findStyleFor(stylesMap, nameForIso, iso) || {}
              // coerce fillOpacity
              let fo: number | undefined = undefined
              if (typeof customStyle.fillOpacity === 'number') fo = customStyle.fillOpacity
              else if (typeof customStyle.fillOpacity === 'string' && customStyle.fillOpacity.trim() !== '' && !isNaN(Number(customStyle.fillOpacity))) fo = Number(customStyle.fillOpacity)
              const applyStyle = (f: any) => {
                const base: any = { color: s.color || strokeColor, weight: s.weight || 1.0 }
                const out: any = { ...base }
                if (customStyle && customStyle.fillColor) out.fillColor = customStyle.fillColor
                out.fillOpacity = typeof fo === 'number' ? fo : 0
                out.fill = out.fillOpacity > 0
                return out
              }
              try { (geo as any).setStyle && (geo as any).setStyle(applyStyle) } catch (e) {}
            } catch (e) {}
          }
        } catch (e) {}
      }, 0)
    } catch (e) {}

    if (!enabled) {
      for (const layer of layersRef.current.values()) try { map.removeLayer(layer) } catch (e) {}
      layersRef.current.clear()
      return
    }

    for (const iso of iso3List) addFor(iso)

    return () => {
      mounted = false
      for (const layer of layersRef.current.values()) try { map.removeLayer(layer) } catch (e) {}
      layersRef.current.clear()
    }
  }, [iso3List.join(','), enabled, level, strokeColor, interactive, map])

  return null
}

export default AdminBoundariesLayer
