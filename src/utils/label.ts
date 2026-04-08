import { Feature } from 'geojson'

export const getLabelText = (feature: any): string => {
  const p = feature && feature.properties ? feature.properties : {}
  return p.ADMIN || p.name || p.NAME || p.country_name || p.country || p.admin || 'Unknown'
}

export const getIso3 = (feature: any): string | null => {
  const p = feature && feature.properties ? feature.properties : {}
  const candidates = [
    p['ISO_A3'],
    p['ISO3'],
    p['ISO3166-1-Alpha-3'],
    p['iso_a3'],
    p['cca3'],
    p['CCA3'],
    p['ADM0_A3']
  ]
  for (const c of candidates) if (c) return String(c).toUpperCase()
  return null
}
