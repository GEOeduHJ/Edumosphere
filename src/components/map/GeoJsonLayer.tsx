import React, { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { Feature, FeatureCollection } from 'geojson'
import { baseStyle, hoverStyle, selectedStyle } from '../../utils/mapStyle'
import { getLabelText } from '../../utils/label'

type Props = {
  dataUrl?: string
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  storageKey?: string
  fitOnLoad?: boolean
  editable?: boolean
  stylesMap?: Record<string, {
    fillColor?: string
    fillOpacity?: number
    color?: string
    weight?: number
    label?: string
    labelColor?: string
    fontSize?: number
  }>
  onLoad?: (geo: L.GeoJSON) => void
  exporting?: boolean
}

const GeoJsonLayer: React.FC<Props> = ({
  dataUrl = '/data/geoBoundaries/ADM0.geojson',
  selectedIds = [],
  onSelectionChange,
  storageKey = 'selected_countries'
  ,
  fitOnLoad = false,
  editable = false,
  stylesMap,
  exporting = false,
  onLoad
}) => {
  const map = useMap()
  const layerRef = useRef<L.GeoJSON | null>(null)
  const dataRef = useRef<FeatureCollection | null>(null)
  const labelIndexRef = useRef<Map<string, Feature[]>>(new Map())
  const layerCacheRef = useRef<Map<string, L.GeoJSON>>(new Map())
  const markerCacheRef = useRef<Map<string, L.Marker[]>>(new Map())
  const activeSetRef = useRef<Set<string>>(new Set())
  const selectedIdsRef = useRef<string[]>(selectedIds)
  const stylesMapRef = useRef<Props['stylesMap'] | undefined>(stylesMap)

  // keep a ref of latest selectedIds so event handlers read current value
  useEffect(() => {
    selectedIdsRef.current = selectedIds
  }, [selectedIds, exporting])

  useEffect(() => {
    stylesMapRef.current = stylesMap
  }, [stylesMap])

  // create (or reuse) a layer for a given label
  const ensureLayer = (label: string) => {
    const cache = layerCacheRef.current
    if (cache.has(label)) {
      const l = cache.get(label)!
      if (!(map as any).hasLayer || !(map as any).hasLayer(l)) {
        l.addTo(map)
      }
      return
    }

    const feats = labelIndexRef.current.get(label) || []
    if (!feats || feats.length === 0) return

    const fc: FeatureCollection = { type: 'FeatureCollection', features: feats }
      // determine renderer: prefer SVG when editing or exporting to ensure visual fidelity
      const renderer = (editable || exporting) ? undefined : L.canvas({ padding: 0.5 })

      // compute per-feature style using stylesMapRef
      const computeStyle = (feature: any) => {
        const s = baseStyle(feature)
        try {
          const lbl = getLabelText(feature)
          const custom = (stylesMapRef.current && stylesMapRef.current[lbl]) || {}
          if (custom.fillColor) s.fillColor = custom.fillColor
          if (typeof custom.fillOpacity === 'number') s.fillOpacity = custom.fillOpacity
          if (custom.color) s.color = custom.color
          if (typeof custom.weight === 'number') s.weight = custom.weight
        } catch (e) {}
        return s
      }

      const onEachFeature = (feature: Feature, layer: L.Layer) => {
        const labelText = getLabelText(feature)
        // tooltip
        try { (layer as any).bindTooltip && (layer as any).bindTooltip(labelText, { sticky: true }) } catch (e) {}

        // mouse events: highlight border on hover but preserve fillColor
        layer.on('mouseover', () => {
          try {
            const base = computeStyle(feature)
            const hover = { ...base, weight: (base.weight || 1) + 1, color: '#444444' }
            ;(layer as any).setStyle && (layer as any).setStyle(hover)
          } catch (e) {}
        })
        layer.on('mouseout', () => {
          try {
            const revert = computeStyle(feature)
            ;(layer as any).setStyle && (layer as any).setStyle(revert)
          } catch (e) {}
        })

        layer.on('click', () => {
          const cur = new Set(selectedIdsRef.current || [])
          if (cur.has(labelText)) cur.delete(labelText)
          else cur.add(labelText)
          const arr = Array.from(cur)
          // Parent component is responsible for persisting selection to localStorage.
          onSelectionChange && onSelectionChange(arr)
        })
      }

      const opts: any = { style: computeStyle, onEachFeature }
      if (renderer) opts.renderer = renderer

      const geo = L.geoJSON(fc as any, opts)
      geo.addTo(map)
      cache.set(label, geo)

    // create / update text markers for this label
    try {
      // remove existing markers first
      const prev = markerCacheRef.current.get(label) || []
      for (const m of prev) try { map.removeLayer(m) } catch (e) {}
      markerCacheRef.current.delete(label)

      const markers: L.Marker[] = []
      const custom = (stylesMapRef.current && stylesMapRef.current[label]) || {}
      const labelText = custom.label || ''
              if (labelText) {
        geo.eachLayer((ly: any) => {
          try {
            if (ly && ly.getBounds) {
              const c = ly.getBounds().getCenter()
              const html = `<div class="country-label" style="color:${custom.labelColor || '#000'}; font-size:${custom.fontSize || 16}px; font-weight:700; text-align:center;">${labelText}</div>`
              const icon = L.divIcon({ className: 'country-label-icon', html, iconSize: [100, 40] })
              const m = L.marker(c, { icon, interactive: false })
              m.addTo(map)
              markers.push(m)
            }
          } catch (e) {}
        })
        if (markers.length) markerCacheRef.current.set(label, markers)
      }
    } catch (e) {}
  }

  const removeLayerForLabel = (label: string) => {
    const cache = layerCacheRef.current
    if (!cache.has(label)) return
    const geo = cache.get(label)!
    try {
      map.removeLayer(geo)
    } catch (e) {}
    // remove markers too
    try {
      const prev = markerCacheRef.current.get(label) || []
      for (const m of prev) try { map.removeLayer(m) } catch (e) {}
      markerCacheRef.current.delete(label)
    } catch (e) {}
    // keep cached instance for faster re-add; do not delete cache to avoid GC churn
  }

  // add/remove layers to match requested names (efficient: reuse cached layers)
  const createLayerForNames = (names: string[]) => {
    const wanted = new Set(names || [])
    const active = activeSetRef.current

    // if exporting, clear cached layers so we recreate them with SVG renderer
    if (exporting) {
      try {
        for (const geo of layerCacheRef.current.values()) {
          try { map.removeLayer(geo) } catch (e) {}
        }
      } catch (e) {}
      layerCacheRef.current.clear()
      // remove existing markers
      try {
        for (const ms of markerCacheRef.current.values()) for (const m of ms) try { map.removeLayer(m) } catch (e) {}
      } catch (e) {}
      markerCacheRef.current.clear()
      active.clear()
    }

    // add new
    for (const name of Array.from(wanted)) {
      if (!active.has(name)) {
        ensureLayer(name)
        active.add(name)
      }
    }

    // remove old
    for (const name of Array.from(active)) {
      if (!wanted.has(name)) {
        removeLayerForLabel(name)
        active.delete(name)
      }
    }
  }

  useEffect(() => {
    let mounted = true
    fetch(dataUrl)
      .then(async r => {
        if (!r.ok) throw new Error('fetch failed: ' + r.status)
        const txt = await r.text()
        if (typeof txt === 'string' && txt.trim().startsWith('version https://git-lfs.github.com/spec/v1')) {
          throw new Error('Git LFS pointer returned for ' + dataUrl)
        }
        try {
          return JSON.parse(txt) as FeatureCollection
        } catch (e) {
          throw e
        }
      })
      .then((json: FeatureCollection) => {
        if (!mounted) return
        dataRef.current = json
        // build index by label
        const idx = new Map<string, Feature[]>()
        const features = Array.isArray(json && (json as any).features) ? (json as any).features : []
        for (const f of features) {
          const label = getLabelText(f)
          if (!idx.has(label)) idx.set(label, [])
          idx.get(label)!.push(f)
        }
        labelIndexRef.current = idx

        // if there are initial selections, render only them
        if (selectedIds && selectedIds.length > 0) {
          createLayerForNames(selectedIds)
        }
        // call onLoad with a lightweight proxy GeoJSON (not the whole dataset)
        onLoad && onLoad(L.geoJSON())
      })
      .catch(err => {
        try {
          ;(window as any).__geojsonFetchError = String(err || 'fetch error')
        } catch (e) {}
        // eslint-disable-next-line no-console
        console.error('GeoJSON fetch failed', err)
      })

    return () => {
      mounted = false
      // remove all active layers
      try {
        for (const geo of layerCacheRef.current.values()) {
          map.removeLayer(geo)
        }
      } catch (e) {}
      layerCacheRef.current.clear()
      activeSetRef.current.clear()
    }
  }, [dataUrl])

  // whenever selectedIds change, add/remove only the necessary label-layers
  useEffect(() => {
    try {
      if (selectedIds && selectedIds.length > 0) createLayerForNames(selectedIds)
      else {
        // remove all
        for (const name of Array.from(activeSetRef.current)) {
          removeLayerForLabel(name)
        }
        activeSetRef.current.clear()
      }
    } catch (e) {}
  }, [selectedIds])
  // when stylesMap changes, update existing layer styles and labels
  useEffect(() => {
    try {
      for (const [label, geo] of layerCacheRef.current.entries()) {
        try {
          // update polygon styles
          const custom = (stylesMapRef.current && stylesMapRef.current[label]) || {}
          geo.setStyle((f: any) => {
            const s = baseStyle(f)
            if (custom.fillColor) s.fillColor = custom.fillColor
            if (typeof custom.fillOpacity === 'number') s.fillOpacity = custom.fillOpacity
            if (custom.color) s.color = custom.color
            if (typeof custom.weight === 'number') s.weight = custom.weight
            return s
          })
          // update markers
          const prev = markerCacheRef.current.get(label) || []
          for (const m of prev) try { map.removeLayer(m) } catch (e) {}
          markerCacheRef.current.delete(label)
          const markers: L.Marker[] = []
          const labelText = custom.label || ''
          if (labelText) {
            geo.eachLayer((ly: any) => {
              try {
                if (ly && ly.getBounds) {
                  const c = ly.getBounds().getCenter()
                  const html = `<div class="country-label" style="color:${custom.labelColor || '#000'}; font-size:${custom.fontSize || 16}px; font-weight:700; text-align:center;">${labelText}</div>`
                  const icon = L.divIcon({ className: 'country-label-icon', html, iconSize: [100, 40] })
                  const m = L.marker(c, { icon, interactive: false })
                  m.addTo(map)
                  markers.push(m)
                }
              } catch (e) {}
            })
            if (markers.length) markerCacheRef.current.set(label, markers)
          }
        } catch (e) {}
      }
    } catch (e) {}
  }, [stylesMap])

  return null
}

export default GeoJsonLayer
