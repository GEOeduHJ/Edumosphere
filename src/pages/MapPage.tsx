import React, { useMemo, useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L, { LatLngBounds } from 'leaflet'
import { useAppState } from '../hooks/useAppState'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import { useClimateQuery } from '../hooks/useClimateQuery'
import { summarizePeriod } from '../utils/aggregation'
import { formatNumberWithUnit } from '../utils/format'
import styles from '../styles/MapPage.module.css'
import GeoJsonLayer from '../components/map/GeoJsonLayer'
import MapInitializer from '../components/map/MapInitializer'
import BasemapBoundaries from '../components/map/BasemapBoundaries'
import Graticule from '../components/map/Graticule'
import { getLabelText } from '../utils/label'

const MapPage: React.FC = () => {
  const { state } = useAppState()

  // memoize positions to avoid recreating bounds every render
  const positions = useMemo(() => state.locations.map(l => [l.latitude, l.longitude] as [number, number]), [state.locations])
  const bounds = useMemo(() => (positions.length > 0 ? new LatLngBounds(positions) : undefined), [positions])

  const { data, loading } = useClimateQuery(state)
  const [selectedCountries, setSelectedCountries] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('selected_countries')
      return raw ? JSON.parse(raw) : []
    } catch (_) {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('selected_countries', JSON.stringify(selectedCountries))
    } catch (e) {}
  }, [selectedCountries])

  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const mapRef = useRef<L.Map | null>(null)

  const [countryStyles, setCountryStyles] = useState<Record<string, any>>(() => {
    try {
      const raw = localStorage.getItem('country_styles')
      return raw ? JSON.parse(raw) : {}
    } catch (_) {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('country_styles', JSON.stringify(countryStyles))
    } catch (e) {}
  }, [countryStyles])

  const [editorColor, setEditorColor] = useState('#ffcc33')
  const [editorOpacity, setEditorOpacity] = useState(0.9)
  const [editorLabel, setEditorLabel] = useState('')
  const [editorLabelColor, setEditorLabelColor] = useState('#000000')
  const [editorFontSize, setEditorFontSize] = useState(16)

  const applyStyleToSelection = () => {
    if (!selectedCountries || selectedCountries.length === 0) return
    setCountryStyles(prev => {
      const next = { ...prev }
      for (const name of selectedCountries) {
        next[name] = {
          ...(next[name] || {}),
          fillColor: editorColor,
          fillOpacity: editorOpacity,
          label: editorLabel || undefined,
          labelColor: editorLabelColor,
          fontSize: editorFontSize
        }
      }
      try {
        localStorage.setItem('country_styles', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const clearStyleForSelection = () => {
    if (!selectedCountries || selectedCountries.length === 0) return
    setCountryStyles(prev => {
      const next = { ...prev }
      for (const name of selectedCountries) delete next[name]
      try {
        localStorage.setItem('country_styles', JSON.stringify(next))
      } catch (e) {}
      return next
    })
  }

  const captureMapImage = async () => {
    let prevCenter: L.LatLng | null = null
    let prevZoom: number | null = null
    // Use leaflet-image to rasterize the map (tiles + SVG vectors).
    // Then overlay textual labels for selected countries onto the returned canvas.
    try {
      setExporting(true)
      // wait a short moment for layers to be recreated as SVG by child layers
      await new Promise(res => setTimeout(res, 300))
      const map = mapRef.current
      if (!map) {
        alert('맵이 초기화되지 않았습니다.')
        setExporting(false)
        return
      }

      // save current view and set a fixed world view for export
      try {
        prevCenter = map.getCenter()
        prevZoom = map.getZoom()
      } catch (_) {}
      await new Promise<void>(res => {
        const onMove = () => { map.off('moveend', onMove); res() }
        map.on('moveend', onMove)
        map.setView([20, 0], 2)
      })

      // dynamic import of leaflet-image
      const mod: any = await import('leaflet-image')
      const leafletImage = mod.default || mod

      const featuresResp = await fetch('/data/world-countries.geojson')
      const gj = await featuresResp.json()
      const features = Array.isArray(gj && gj.features) ? gj.features : []

      await new Promise<void>((resolve, reject) => {
        try {
          leafletImage(map, (err: any, canvas: HTMLCanvasElement) => {
            if (err) return reject(err)
            try {
              const exportScale = 2 // scale factor for higher resolution export
              const outCanvas = document.createElement('canvas')
              outCanvas.width = Math.max(1, Math.round(canvas.width * exportScale))
              outCanvas.height = Math.max(1, Math.round(canvas.height * exportScale))
              const outCtx = outCanvas.getContext('2d')
              if (!outCtx) return reject(new Error('Canvas context 생성 실패'))

              // draw base raster into scaled canvas
              outCtx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height)

              // overlay labels for selected countries using their bbox-centers
              for (const f of features) {
                const name = getLabelText(f)
                if (!name || !selectedCountries.includes(name)) continue
                const geom = f && f.geometry
                if (!geom || !geom.coordinates) continue

                const coords: Array<[number, number]> = []
                const collect = (arr: any) => {
                  if (!Array.isArray(arr)) return
                  if (typeof arr[0] === 'number' && typeof arr[1] === 'number') {
                    coords.push([arr[1], arr[0]])
                    return
                  }
                  for (const it of arr) collect(it)
                }
                collect(geom.coordinates)
                if (coords.length === 0) continue
                let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
                for (const [lat, lng] of coords) {
                  minLat = Math.min(minLat, lat)
                  maxLat = Math.max(maxLat, lat)
                  minLng = Math.min(minLng, lng)
                  maxLng = Math.max(maxLng, lng)
                }
                const center = L.latLng((minLat + maxLat) / 2, (minLng + maxLng) / 2)
                const pt = map.latLngToContainerPoint(center)

                const style = (countryStyles && countryStyles[name]) || {}
                const labelText = style.label || ''
                if (!labelText) continue
                const fontSize = (style.fontSize || 16) * exportScale
                outCtx.save()
                outCtx.font = `${fontSize}px sans-serif`
                outCtx.textAlign = 'center'
                outCtx.textBaseline = 'middle'
                outCtx.fillStyle = style.labelColor || '#000'
                outCtx.fillText(labelText, Math.round(pt.x * exportScale), Math.round(pt.y * exportScale))
                outCtx.restore()
              }

              outCanvas.toBlob((blob: Blob | null) => {
                if (!blob) return reject(new Error('이미지 생성 실패'))
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'map.png'
                a.click()
                URL.revokeObjectURL(url)
                resolve()
              })
            } catch (err2) {
              reject(err2)
            }
          })
        } catch (outer) {
          reject(outer)
        }
      })
    } catch (e) {
      // fallback to html2canvas if leaflet-image fails
      // eslint-disable-next-line no-console
      console.error('leaflet-image 실패, html2canvas로 폴백', e)
      try {
        const container = document.querySelector('.leaflet-container') as HTMLElement
        if (!container) {
          alert('맵 컨테이너를 찾을 수 없습니다.')
          setExporting(false)
          return
        }
        const hmod: any = await import('html2canvas')
        const html2canvas = hmod.default || hmod
        const canvas: HTMLCanvasElement = await html2canvas(container, { useCORS: true, allowTaint: false, backgroundColor: '#ffffff', scale: 2 })
        canvas.toBlob(blob => {
          try {
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'map.png'
            a.click()
            URL.revokeObjectURL(url)
          } finally {
            setExporting(false)
          }
        })
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error('이미지 생성 실패', e2)
        alert('이미지 생성 중 오류가 발생했습니다. 콘솔을 확인하세요.')
        setExporting(false)
      }
    } finally {
      try {
        const m = mapRef.current
        if (m && prevCenter && typeof prevZoom === 'number') {
          m.setView(prevCenter, prevZoom)
        }
      } catch (_) {}
      setExporting(false)
    }
  }

  const [exporting, setExporting] = useState(false)

  const [allCountries, setAllCountries] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [pendingSelected, setPendingSelected] = useState<string[]>(selectedCountries)

  const [editStep, setEditStep] = useState<number>(1)
  const [tempEdits, setTempEdits] = useState<Record<string, any>>({})

  // editMode removed: stepper is always available

  const initTempEditsFor = (names: string[]) => {
    const next: Record<string, any> = {}
    for (const n of names) {
      const existing = countryStyles[n] || {}
      next[n] = {
        fillColor: existing.fillColor || '#ffcc33',
        fillOpacity: typeof existing.fillOpacity === 'number' ? existing.fillOpacity : 0.9,
        label: existing.label || '',
        labelColor: existing.labelColor || '#000000',
        fontSize: existing.fontSize || 16
      }
    }
    setTempEdits(next)
  }

  const nextStep = () => {
    if (editStep === 1) {
      if (!pendingSelected || pendingSelected.length === 0) {
        alert('적용할 국가를 먼저 선택하세요.')
        return
      }
      setSelectedCountries(pendingSelected)
      initTempEditsFor(pendingSelected)
      setEditStep(2)
      return
    }
    if (editStep === 2) {
      setCountryStyles(prev => {
        const next = { ...prev }
        for (const name of selectedCountries) {
          const t = tempEdits[name]
          if (!t) continue
          next[name] = { ...(next[name] || {}), fillColor: t.fillColor, fillOpacity: t.fillOpacity }
        }
        try { localStorage.setItem('country_styles', JSON.stringify(next)) } catch (e) {}
        return next
      })
      setEditStep(3)
      return
    }
    if (editStep === 3) {
      setCountryStyles(prev => {
        const next = { ...prev }
        for (const name of selectedCountries) {
          const t = tempEdits[name]
          if (!t) continue
          next[name] = { ...(next[name] || {}), label: t.label || undefined, labelColor: t.labelColor, fontSize: t.fontSize }
        }
        try { localStorage.setItem('country_styles', JSON.stringify(next)) } catch (e) {}
        return next
      })
      setEditStep(4)
      return
    }
  }

  const prevStep = () => {
    setEditStep(s => Math.max(1, s - 1))
  }

  const hangul = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하']
  const idxToLabel = (i: number) => `(${hangul[i] ?? String(i + 1)})`

  // memoize marker elements to avoid recreating icons on every render
  const markers = useMemo(() => {
    return state.locations.map((l, i) => {
      const daily = data[l.id] || []
      const summary = summarizePeriod(daily)
      const metricDisplay = state.activeMetric.includes('temperature')
        ? formatNumberWithUnit(summary.meanTemp, '°C')
        : formatNumberWithUnit(summary.totalPrecipitation, 'mm')

      const label = idxToLabel(i)
      const icon = L.divIcon({
        className: 'custom-marker-icon',
        html: `<div class="marker-badge">${label}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })

      return (
        <Marker key={l.id} position={[l.latitude, l.longitude]} icon={icon}>
          <Popup>
            <div className={styles.markerPopup}>
              <div className={styles.markerPopupTitle}>{label} {l.name}</div>
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
    })
  }, [state.locations, data, state.activeMetric])

  useEffect(() => {
    let mounted = true
    fetch('/data/world-countries.geojson')
      .then(r => r.json())
      .then((gj: any) => {
        if (!mounted) return
        const features = Array.isArray(gj && gj.features) ? gj.features : []
        const rawNames = features.map((f: any) => getLabelText(f)).filter((x: any) => typeof x === 'string') as string[]
        const names = Array.from(new Set(rawNames)).sort((a, b) => a.localeCompare(b))
        setAllCountries(names)
      })
      .catch(() => {
        setAllCountries([])
      })
    return () => {
      mounted = false
    }
  }, [])

  // keep pending buffer in sync when external selection changes (e.g., map clicks)
  useEffect(() => {
    setPendingSelected(selectedCountries)
  }, [selectedCountries])

  const filteredCountries = useMemo(() => {
    if (!search) return allCountries
    const s = search.trim().toLowerCase()
    return allCountries.filter(c => c.toLowerCase().includes(s))
  }, [allCountries, search])

  const [leafletReady, setLeafletReady] = useState<boolean | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setLeafletReady(Boolean(document.querySelector('.leaflet-container')))
    }, 400)
    return () => clearTimeout(t)
  }, [loading, bounds, pendingSelected, selectedCountries])

  // graticule toggles
  const [showEquator, setShowEquator] = useState(false)
  const [showLat30, setShowLat30] = useState(false)
  const [showLat60, setShowLat60] = useState(false)
  const [showLongitudes, setShowLongitudes] = useState(false)

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>🗺️ 지도화</h1>
        <p>선택한 관측 지점을 지도상에 표시하고, 각 지점의 기후 데이터를 확인합니다</p>

        <div style={{ marginTop: 8 }}>
          상태: {leafletReady === null ? '확인중...' : leafletReady ? 'Leaflet 컨테이너 존재' : 'Leaflet 없음 — 콘솔 확인 필요'}
          {typeof (window as any).__geojsonFetchError !== 'undefined' && (window as any).__geojsonFetchError ? (
            <div style={{ color: '#b91c1c', marginTop: 6 }}>GeoJSON 로드 오류: {(window as any).__geojsonFetchError}</div>
          ) : null}
          <div style={{ marginTop: 6 }}>
            타일 상태: {(window as any).__leafletTileLoaded ? '타일 로드됨' : ((window as any).__leafletTileError ? `타일 오류: ${(window as any).__leafletTileError}` : '로딩중/없음')}
          </div>
          {typeof (window as any).__leafletContainerRect !== 'undefined' && (window as any).__leafletContainerRect ? (
            <div style={{ marginTop: 6 }}>
              컨테이너 크기: {Math.round((window as any).__leafletContainerRect.width)} x {Math.round((window as any).__leafletContainerRect.height)}
            </div>
          ) : null}

          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showEquator} onChange={e => setShowEquator(e.target.checked)} /> 적도
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showLat30} onChange={e => setShowLat30(e.target.checked)} /> 30°
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showLat60} onChange={e => setShowLat60(e.target.checked)} /> 60°
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showLongitudes} onChange={e => setShowLongitudes(e.target.checked)} /> 경선 (10° 간격)
            </label>
          </div>
        </div>

        <div className={styles.selectorContainer}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className={styles.countrySearch} placeholder="국가 검색..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={() => setPendingSelected(allCountries)}>전체선택</button>
            <button onClick={() => setPendingSelected([])}>전체해제</button>
            <button onClick={() => setSelectedCountries(pendingSelected)}>적용</button>
            <button onClick={() => { setSelectedCountries([]); setPendingSelected([]); localStorage.removeItem('selected_countries') }}>초기화</button>
          </div>

          <div className={styles.countryList}>
            {filteredCountries.map(name => (
              <label key={name} className={styles.countryItem}>
                <input type="checkbox" checked={pendingSelected.includes(name)} onChange={() => setPendingSelected(prev => (prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]))} />
                <span style={{ marginLeft: 8 }}>{name}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div>선택된 국가: {selectedCountries.length}</div>
        </div>

        <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={styles.stepper}>
            <div className={`${styles.stepItem} ${editStep === 1 ? styles.activeStep : ''}`}>1. 국가 선택</div>
            <div className={`${styles.stepItem} ${editStep === 2 ? styles.activeStep : ''}`}>2. 색상 선택</div>
            <div className={`${styles.stepItem} ${editStep === 3 ? styles.activeStep : ''}`}>3. 글자 입력</div>
            <div className={`${styles.stepItem} ${editStep === 4 ? styles.activeStep : ''}`}>4. 이미지 다운로드</div>
          </div>

          <div className={styles.stepPanel}>
            {editStep === 1 && (
              <div>
                <div>1단계: 왼쪽 목록에서 국가를 선택한 뒤 '적용'을 누르거나 아래 '다음'을 눌러 선택을 확정하세요.</div>
                <div style={{ marginTop: 8 }}>
                  선택된 국가 수: <strong>{pendingSelected.length}</strong>
                  <div style={{ marginTop: 6 }}>
                    <button onClick={() => { setSelectedCountries(pendingSelected); initTempEditsFor(pendingSelected); }}>선택 적용</button>
                  </div>
                </div>
              </div>
            )}

            {editStep === 2 && (
              <div>
                <div style={{ marginBottom: 8 }}>2단계: 선택한 국가별 색상과 투명도를 설정하세요. 상단의 '전체 색상 적용'으로 한 번에 바꿀 수 있습니다.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    전체 색상 적용
                    <input type="color" onChange={e => {
                      const c = e.target.value
                      setTempEdits(prev => {
                        const next = { ...prev }
                        for (const name of selectedCountries) next[name] = { ...(next[name] || {}), fillColor: c }
                        return next
                      })
                    }} />
                  </label>
                </div>
                <div className={styles.editorList}>
                  {selectedCountries.map(name => (
                    <div key={name} className={styles.editorRow}>
                      <div style={{ width: 220 }}>{name}</div>
                      <input type="color" value={tempEdits[name]?.fillColor || '#ffcc33'} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fillColor: e.target.value } }))} />
                      <input type="range" min={0} max={1} step={0.05} value={tempEdits[name]?.fillOpacity ?? 0.9} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fillOpacity: Number(e.target.value) } }))} style={{ width: 140, marginLeft: 8 }} />
                      <div style={{ width: 56, textAlign: 'right' }}>{Math.round((tempEdits[name]?.fillOpacity ?? 0.9) * 100)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editStep === 3 && (
              <div>
                <div style={{ marginBottom: 8 }}>3단계: 선택한 국가 내부에 들어갈 글자를 입력하세요.</div>
                <div className={styles.editorList}>
                  {selectedCountries.map(name => (
                    <div key={name} className={styles.editorRow}>
                      <div style={{ width: 220 }}>{name}</div>
                      <input type="text" placeholder="레이블 텍스트" value={tempEdits[name]?.label || ''} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), label: e.target.value } }))} />
                      <input type="color" value={tempEdits[name]?.labelColor || '#000000'} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), labelColor: e.target.value } }))} style={{ marginLeft: 8 }} />
                      <input type="number" min={8} max={48} value={tempEdits[name]?.fontSize ?? 16} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fontSize: Number(e.target.value) } }))} style={{ width: 72, marginLeft: 8 }} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editStep === 4 && (
              <div>
                <div style={{ marginBottom: 8 }}>4단계: 편집 결과를 이미지로 다운로드하세요.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={captureMapImage}>지도 이미지 다운로드</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {editStep > 1 && <button onClick={prevStep}>이전</button>}
            {editStep < 4 && <button onClick={nextStep}>다음</button>}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className={styles.mapWrapper}>
        {loading ? (
          <LoadingState />
        ) : (
          <MapContainer
            {...(bounds ? { bounds } : { center: [20, 0], zoom: 2 })}
            className={styles.mapContainer}
            style={{ height: '600px' }}
            ref={mapRef as any}
          >
            <MapInitializer bounds={bounds} />
            <BasemapBoundaries />
            <GeoJsonLayer
              selectedIds={selectedCountries}
              onSelectionChange={setSelectedCountries}
              stylesMap={countryStyles}
              fitOnLoad={!bounds}
              editable={true}
              exporting={exporting}
              onLoad={geo => (geoLayerRef.current = geo)}
            />
            <Graticule
              showEquator={showEquator}
              showLat30={showLat30}
              showLat60={showLat60}
              showLongitudes={showLongitudes}
              lonInterval={10}
            />
            {markers}
          </MapContainer>
        )}
      </div>
    </div>
  )
}

export default MapPage
