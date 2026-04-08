declare module 'react-leaflet'

declare module 'leaflet' {
  export type Map = any
  export type GeoJSON = any
  export type Marker = any
  export type Layer = any
  export type LayerGroup = any
  export type LatLngExpression = any
  export type LatLngBounds = any
  export type LatLng = any
  export const LatLngBounds: any
  const _: any
  export default _
}

declare module 'leaflet-image'
declare module 'leaflet-easyprint'
declare module 'html2canvas'

// Allow plain JSON imports in modules that may not have types
declare module '*.geojson' {
  const value: any
  export default value
}
