import { Feature } from 'geojson'

export const getLabelText = (feature: any): string => {
  const p = feature && feature.properties ? feature.properties : {}
  return p.ADMIN || p.name || p.NAME || p.country_name || p.country || p.admin || 'Unknown'
}
