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
}

const AdminBoundariesLayer: React.FC<Props> = ({ iso3List, enabled, level = 'ADM1', strokeColor = '#333', interactive = false }) => {
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

        const geo = L.geoJSON(gj as any, {
          pane: paneName,
          style: { color: s.color || strokeColor, weight: s.weight || 1.0, fillOpacity: 0 },
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
