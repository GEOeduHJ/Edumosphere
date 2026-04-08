import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

type Props = {
  showEquator?: boolean
  showLat30?: boolean
  showLat60?: boolean
  showLongitudes?: boolean
  lonInterval?: number
}

const Graticule: React.FC<Props> = ({ showEquator, showLat30, showLat60, showLongitudes, lonInterval = 10 }) => {
  const map = useMap()
  const groupRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    const group = L.layerGroup()
    groupRef.current = group

    const addLatLine = (lat: number) => {
      const pts: L.LatLngExpression[] = []
      for (let lon = -180; lon <= 180; lon += 4) pts.push([lat, lon])
      const line = L.polyline(pts, { color: '#777', weight: 1, opacity: 0.7, dashArray: '4 6', interactive: false })
      group.addLayer(line)
    }

    const addLonLine = (lon: number) => {
      const pts: L.LatLngExpression[] = []
      for (let lat = -88; lat <= 88; lat += 4) pts.push([lat, lon])
      const line = L.polyline(pts, { color: '#777', weight: 1, opacity: 0.7, dashArray: '4 6', interactive: false })
      group.addLayer(line)
    }

    if (showEquator) addLatLine(0)
    if (showLat30) { addLatLine(30); addLatLine(-30) }
    if (showLat60) { addLatLine(60); addLatLine(-60) }
    if (showLongitudes) {
      for (let lon = 0; lon < 360; lon += (lonInterval || 10)) {
        const lonVal = lon <= 180 ? lon : lon - 360
        addLonLine(lonVal)
      }
    }

    group.addTo(map)

    return () => {
      try { map.removeLayer(group) } catch (e) {}
      groupRef.current = null
    }
  }, [map, showEquator, showLat30, showLat60, showLongitudes, lonInterval])

  return null
}

export default Graticule
