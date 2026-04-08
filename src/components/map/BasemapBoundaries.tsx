import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const BasemapBoundaries: React.FC = () => {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/data/world-countries.geojson')
      .then(r => r.json())
      .then((gj: any) => {
        if (!mounted) return
        try {
          const geo = L.geoJSON(gj, {
            style: () => ({
              fillOpacity: 0,
              color: '#333333',
              weight: 1.2,
              opacity: 0.9
            }),
            interactive: false
          })
          geo.addTo(map)
          layerRef.current = geo
          // put below interactive layers
          try {
            geo.eachLayer((ly: any) => { try { ly.bringToBack && ly.bringToBack() } catch (e) {} })
          } catch (e) {}
        } catch (e) {
          // ignore
        }
      })
      .catch(err => {
        // ignore
      })

    return () => {
      mounted = false
      if (layerRef.current) {
        try {
          map.removeLayer(layerRef.current)
        } catch (e) {}
        layerRef.current = null
      }
    }
  }, [map])

  return null
}

export default BasemapBoundaries
