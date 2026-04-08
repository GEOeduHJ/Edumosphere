import { Feature } from 'geojson'

export const baseStyle = (_feature: Feature) => ({
  fillColor: '#e7e7e7',
  color: '#333333',
  weight: 1,
  fillOpacity: 0.6
})

export const selectedStyle = (_feature: Feature) => ({
  fillColor: '#ffcc33',
  color: '#bb8800',
  weight: 2,
  fillOpacity: 0.9
})

export const hoverStyle = (_feature: Feature) => ({
  weight: 2,
  color: '#444444',
  fillOpacity: 0.85
})

export const getFeatureId = (feature: any): string => {
  const p = feature && feature.properties ? feature.properties : {}
  return (
    p.ISO_A3 || p.iso_a3 || p.ISO3 || p.ADM0_A3 || p.WB_A3 || p.ISO_A2 || p.iso_a2 || p.id || p.ID || p.name || p.ADMIN || p.NAME || p.country_name || JSON.stringify(feature && feature.geometry && feature.geometry.coordinates).slice(0, 80)
  )
}
