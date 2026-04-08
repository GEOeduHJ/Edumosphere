import React, { useMemo, useState, useEffect, useRef } from 'react'
import { MapContainer, Marker, Popup } from 'react-leaflet'
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
import { SelectedCountry } from '../types/country'
import { fetchWorldCountries, getNameToIsoMap } from '../services/geoBoundaries'
import AdminBoundariesLayer from '../components/map/AdminBoundariesLayer'
import CountryComparePanel from '../components/features/CountryComparePanel'

const MapPage: React.FC = () => {
  const { state } = useAppState()

  // memoize positions to avoid recreating bounds every render
  const positions = useMemo(() => state.locations.map(l => [l.latitude, l.longitude] as [number, number]), [state.locations])
  const bounds = useMemo(() => (positions.length > 0 ? new LatLngBounds(positions) : undefined), [positions])

  const { data, loading } = useClimateQuery(state)
  // canonical selection stored as SelectedCountry[] (iso3, iso2, name)
  const [selectedCountries, setSelectedCountries] = useState<SelectedCountry[]>(() => {
    try {
      const raw = localStorage.getItem('selected_countries')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return []
      // if persisted as object array with iso3, assume canonical format
      if (typeof parsed[0] === 'object' && parsed[0] !== null && parsed[0].iso3) return parsed as SelectedCountry[]
      // otherwise persistence may be old string[] form — we'll populate pendingSelected and convert later
      return []
    } catch (e) { return [] }
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
      for (const sc of selectedCountries) {
        const name = sc.name
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
      for (const sc of selectedCountries) delete next[sc.name]
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

      // try leaflet-easyprint first (dynamic import) — if available, use it and return
      try {
        const ep: any = await import('leaflet-easyprint')
        const EasyPrint = (L as any).easyPrint || (ep && (ep.default || ep))
        if (typeof EasyPrint === 'function') {
          try {
            const printer = (L as any).easyPrint({ exportOnly: true, hideControlContainer: true, filename: 'map' })
            try { printer.addTo(map) } catch (_) {}
            try {
              if (typeof printer.printMap === 'function') {
                // print current view
                ;(printer as any).printMap('CurrentSize', 'map')
                setExporting(false)
                try { printer.remove && printer.remove() } catch (_) {}
                return
              }
            } catch (_) {}
            try { printer.remove && printer.remove() } catch (_) {}
          } catch (_) {}
        }
      } catch (_) {}

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
              const selectedNameSet = new Set((selectedCountries || []).map(s => s.name))
              for (const f of features) {
                const name = getLabelText(f)
                if (!name || !selectedNameSet.has(name)) continue
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
  // pendingSelected remains a list of country NAMES used by the selection UI
  const [pendingSelected, setPendingSelected] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('selected_countries')
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return []
      if (typeof parsed[0] === 'string') return parsed as string[]
      if (typeof parsed[0] === 'object' && parsed[0] !== null && parsed[0].name) return (parsed as any[]).map(p => p.name)
      return []
    } catch (e) { return [] }
  })

  const [nameToIso3, setNameToIso3] = useState<Record<string, string>>({})
  const [showAdminBoundaries, setShowAdminBoundaries] = useState(false)
  const [adminLevel, setAdminLevel] = useState<string>('ADM1')
  const [adminInteractive, setAdminInteractive] = useState<boolean>(false)

  const selectedIso3 = useMemo(() => {
    try {
      return (selectedCountries || []).map(s => (s && s.iso3) || null).filter(Boolean) as string[]
    } catch (e) { return [] }
  }, [selectedCountries])

  const isoToNameMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const sc of selectedCountries || []) {
      try {
        if (sc && sc.iso3) m[(sc.iso3 || '').toUpperCase()] = sc.name
      } catch (e) {}
    }
    return m
  }, [selectedCountries])

  const stylesMapIso = useMemo(() => {
    const m: Record<string, any> = {}
    for (const sc of selectedCountries || []) {
      try {
        if (sc && sc.iso3) m[(sc.iso3 || '').toUpperCase()] = (countryStyles && countryStyles[sc.name]) || undefined
      } catch (e) {}
    }
    return m
  }, [selectedCountries, countryStyles])

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
    // New step flow: 1 = 색상 선택, 2 = 글자 입력, 3 = 이미지 다운로드
    if (editStep === 1) {
      // apply color/opacity edits
      setCountryStyles(prev => {
        const next = { ...prev }
        for (const sc of selectedCountries) {
          const name = sc.name
          const t = tempEdits[name]
          if (!t) continue
          next[name] = { ...(next[name] || {}), fillColor: t.fillColor, fillOpacity: t.fillOpacity }
        }
        try { localStorage.setItem('country_styles', JSON.stringify(next)) } catch (e) {}
        return next
      })
      setEditStep(2)
      return
    }
    if (editStep === 2) {
      // apply label/text edits
      setCountryStyles(prev => {
        const next = { ...prev }
        for (const sc of selectedCountries) {
          const name = sc.name
          const t = tempEdits[name]
          if (!t) continue
          next[name] = { ...(next[name] || {}), label: t.label || undefined, labelColor: t.labelColor, fontSize: t.fontSize }
        }
        try { localStorage.setItem('country_styles', JSON.stringify(next)) } catch (e) {}
        return next
      })
      setEditStep(3)
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
    fetchWorldCountries()
      .then((gj: any) => {
        if (!mounted) return
        const features = Array.isArray(gj && gj.features) ? gj.features : []
        const rawNames = features.map((f: any) => getLabelText(f)).filter((x: any) => typeof x === 'string') as string[]
        const names = Array.from(new Set(rawNames)).sort((a, b) => a.localeCompare(b))
        setAllCountries(names)
        try {
          const map = getNameToIsoMap()
          setNameToIso3(map)
          // If pending selections (legacy or UI) exist, convert to canonical SelectedCountry objects
          if (pendingSelected && pendingSelected.length > 0) {
            const scs: SelectedCountry[] = pendingSelected.map(n => ({ name: n, iso3: (map && map[n]) || '', iso2: undefined }))
            setSelectedCountries(prev => (prev && prev.length > 0 ? prev : scs))
          }
        } catch (e) {}
      })
      .catch(() => {
        setAllCountries([])
      })
    return () => { mounted = false }
  }, [])

  // keep pending buffer in sync when external selection changes (e.g., map clicks)
  useEffect(() => {
    setPendingSelected((selectedCountries || []).map(s => s.name))
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
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="checkbox" checked={showAdminBoundaries} onChange={e => setShowAdminBoundaries(e.target.checked)} /> 세부 행정구역 보기
            </label>
            {showAdminBoundaries ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  수준:
                  <select value={adminLevel} onChange={e => setAdminLevel(e.target.value)} style={{ marginLeft: 6 }}>
                    <option value="ADM0">ADM0</option>
                    <option value="ADM1">ADM1</option>
                    <option value="ADM2">ADM2</option>
                    <option value="ADM3">ADM3</option>
                    <option value="ADM4">ADM4</option>
                    <option value="ADM5">ADM5</option>
                  </select>
                </label>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={adminInteractive} onChange={e => setAdminInteractive(e.target.checked)} /> 행정구역 상호작용 허용
                </label>
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.selectorContainer}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className={styles.countrySearch} placeholder="국가 검색..." value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={() => setPendingSelected(allCountries)}>전체선택</button>
            <button onClick={() => setPendingSelected([])}>전체해제</button>
            <button onClick={() => {
              const scs: SelectedCountry[] = (pendingSelected || []).map(n => ({ name: n, iso3: (nameToIso3 && nameToIso3[n]) || '', iso2: undefined }))
              setSelectedCountries(scs)
            }}>적용</button>
            <button onClick={() => {
              // full reset: clear selections, pending buffer, applied styles, temp edits and persisted storage
              setSelectedCountries([])
              setPendingSelected([])
              setCountryStyles({})
              setTempEdits({})
              setEditorColor('#ffcc33')
              setEditorOpacity(0.9)
              setEditorLabel('')
              setEditorLabelColor('#000000')
              setEditorFontSize(16)
              try { localStorage.removeItem('selected_countries') } catch (_) {}
              try { localStorage.removeItem('country_styles') } catch (_) {}
            }}>초기화</button>
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

        <div style={{ marginTop: 12 }}>
          <CountryComparePanel iso3List={selectedIso3} />
        </div>

        <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className={styles.stepper}>
            <div className={`${styles.stepItem} ${editStep === 1 ? styles.activeStep : ''}`}>1. 색상 선택</div>
            <div className={`${styles.stepItem} ${editStep === 2 ? styles.activeStep : ''}`}>2. 글자 입력</div>
            <div className={`${styles.stepItem} ${editStep === 3 ? styles.activeStep : ''}`}>3. 이미지 다운로드</div>
          </div>

          <div className={styles.stepPanel}>
            {editStep === 1 && (
              <div>
                <div style={{ marginBottom: 8 }}>1단계: 선택한 국가별 색상과 투명도를 설정하세요. 상단의 '전체 색상 적용'으로 한 번에 바꿀 수 있습니다.</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    전체 색상 적용
                    <input type="color" onChange={e => {
                      const c = e.target.value
                      setTempEdits(prev => {
                        const next = { ...prev }
                        for (const sc of selectedCountries) next[sc.name] = { ...(next[sc.name] || {}), fillColor: c }
                        return next
                      })
                    }} />
                  </label>
                </div>
                <div className={styles.editorList}>
                  {selectedCountries.map(sc => {
                    const name = sc.name
                    return (
                      <div key={name} className={styles.editorRow}>
                        <div style={{ width: 220 }}>{name}</div>
                        <input type="color" value={tempEdits[name]?.fillColor || '#ffcc33'} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fillColor: e.target.value } }))} />
                        <input type="range" min={0} max={1} step={0.05} value={tempEdits[name]?.fillOpacity ?? 0.9} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fillOpacity: Number(e.target.value) } }))} style={{ width: 140, marginLeft: 8 }} />
                        <div style={{ width: 56, textAlign: 'right' }}>{Math.round((tempEdits[name]?.fillOpacity ?? 0.9) * 100)}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {editStep === 2 && (
              <div>
                <div style={{ marginBottom: 8 }}>2단계: 선택한 국가 내부에 들어갈 글자를 입력하세요.</div>
                <div className={styles.editorList}>
                  {selectedCountries.map(sc => {
                    const name = sc.name
                    return (
                      <div key={name} className={styles.editorRow}>
                        <div style={{ width: 220 }}>{name}</div>
                        <input type="text" placeholder="레이블 텍스트" value={tempEdits[name]?.label || ''} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), label: e.target.value } }))} />
                        <input type="color" value={tempEdits[name]?.labelColor || '#000000'} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), labelColor: e.target.value } }))} style={{ marginLeft: 8 }} />
                        <input type="number" min={8} max={48} value={tempEdits[name]?.fontSize ?? 16} onChange={e => setTempEdits(prev => ({ ...prev, [name]: { ...(prev[name] || {}), fontSize: Number(e.target.value) } }))} style={{ width: 72, marginLeft: 8 }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {editStep === 3 && (
              <div>
                <div style={{ marginBottom: 8 }}>3단계: 편집 결과를 이미지로 다운로드하세요.</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={captureMapImage}>지도 이미지 다운로드</button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {editStep > 1 && <button onClick={prevStep}>이전</button>}
            {editStep < 3 && <button onClick={nextStep}>다음</button>}
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
              selectedIds={showAdminBoundaries ? [] : (selectedCountries || []).map(s => s.name)}
              onSelectionChange={(names: string[]) => {
                const scs: SelectedCountry[] = (names || []).map(n => ({ name: n, iso3: (nameToIso3 && nameToIso3[n]) || '', iso2: undefined }))
                setSelectedCountries(scs)
              }}
              stylesMap={countryStyles}
              fitOnLoad={!bounds}
              editable={true}
              exporting={exporting}
              onLoad={geo => (geoLayerRef.current = geo)}
            />
            {showAdminBoundaries && <AdminBoundariesLayer iso3List={selectedIso3} enabled={showAdminBoundaries} level={adminLevel} interactive={adminInteractive} stylesMap={countryStyles} isoToNameMap={isoToNameMap} stylesMapIso={stylesMapIso} />}
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
