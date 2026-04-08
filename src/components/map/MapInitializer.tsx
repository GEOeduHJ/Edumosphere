import React, { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

type Props = {
  bounds?: L.LatLngBounds | undefined
}

const MapInitializer: React.FC<Props> = ({ bounds }) => {
  const map = useMap()

  useEffect(() => {
    const container = map.getContainer()
    // ensure container has explicit size
    try {
      if (container && container.style) {
        if (!container.style.width) container.style.width = '100%'
        if (!container.style.height) container.style.height = '100%'
      }
    } catch (e) {}

    const t = setTimeout(() => {
      try {
        map.invalidateSize()
        if (bounds) {
          try {
            map.fitBounds(bounds, { animate: false })
          } catch (e) {}
        }
      } catch (e) {}
    }, 250)

    // publish container rect for diagnostics
    try {
      const rect = container && container.getBoundingClientRect ? container.getBoundingClientRect() : null
      ;(window as any).__leafletContainerRect = rect
    } catch (e) {}

    const onTileError = (ev: any) => {
      // log to window for diagnostics
      try {
        ;(window as any).__leafletTileError = String(ev || 'tile error')
      } catch (e) {}
      // eslint-disable-next-line no-console
      console.error('Leaflet tile error', ev)
    }

    const onTileLoad = () => {
      // note tile load success
      try {
        ;(window as any).__leafletTileLoaded = true
      } catch (e) {}
    }

    map.on('tileerror', onTileError)
    map.on('tileload', onTileLoad)

    return () => {
      clearTimeout(t)
      map.off('tileerror', onTileError)
      map.off('tileload', onTileLoad)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default MapInitializer
