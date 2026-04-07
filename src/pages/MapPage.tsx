import React, { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { LatLngBounds } from 'leaflet'
import { useAppState } from '../hooks/useAppState'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import { useClimateQuery } from '../hooks/useClimateQuery'
import { summarizePeriod } from '../utils/aggregation'
import { formatNumberWithUnit } from '../utils/format'
import styles from '../styles/MapPage.module.css'

const MapPage: React.FC = () => {
  const { state } = useAppState()
  if (state.locations.length === 0) return <EmptyState message="지도를 보려면 지점을 추가하세요." />

  const positions = state.locations.map(l => [l.latitude, l.longitude] as [number, number])
  const bounds = useMemo(() => new LatLngBounds(positions), [positions])

  const { data, loading } = useClimateQuery(state)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>🗺️ 지도화</h1>
        <p>선택한 관측 지점을 지도상에 표시하고, 각 지점의 기후 데이터를 확인합니다</p>
      </div>

      {/* Map */}
      <div className={styles.mapWrapper}>
        {loading ? (
          <LoadingState />
        ) : (
          <MapContainer bounds={bounds} className={styles.mapContainer}>
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />
            {state.locations.map(l => {
              const daily = data[l.id] || []
              const summary = summarizePeriod(daily)
              const metricDisplay = state.activeMetric.includes('temperature')
                ? formatNumberWithUnit(summary.meanTemp, '°C')
                : formatNumberWithUnit(summary.totalPrecipitation, 'mm')

              return (
                <Marker key={l.id} position={[l.latitude, l.longitude]}>
                  <Popup>
                    <div className={styles.markerPopup}>
                      <div className={styles.markerPopupTitle}>{l.name}</div>
                      <div className={styles.markerPopupLocation}>
                        {l.country} {l.admin1 ? `(${l.admin1})` : ''}
                      </div>
                      <div className={styles.markerPopupValue}>
                        {state.activeMetric.includes('temperature') ? '🌡️' : '💧'} {metricDisplay}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}
          </MapContainer>
        )}
      </div>
    </div>
  )
}

export default MapPage
