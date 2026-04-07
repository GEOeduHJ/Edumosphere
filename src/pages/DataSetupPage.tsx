import React, { useEffect, useState } from 'react'
import { searchLocation } from '../api/geocoding'
import { useAppState } from '../hooks/useAppState'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import { useNavigate } from 'react-router-dom'
import styles from '../styles/DataSetupPage.module.css'

const DataSetupPage: React.FC = () => {
  const { state, dispatch } = useAppState()
  const [q, setQ] = useState('')
  const [candidates, setCandidates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setCandidates([])
      return
    }
    const ac = new AbortController()
    setLoading(true)
    setError(null)
    const t = setTimeout(() => {
      searchLocation(q, ac.signal)
        .then(r => setCandidates(r))
        .catch(e => setError(String(e)))
        .finally(() => setLoading(false))
    }, 300)
    return () => {
      ac.abort()
      clearTimeout(t)
    }
  }, [q])

  const handleAddLocation = (c: any) => {
    dispatch({
      type: 'ADD_LOCATION',
      payload: {
        id: c.id ?? `${c.latitude},${c.longitude}`,
        name: c.name,
        country: c.country,
        countryCode: c.country_code ?? null,
        admin1: c.admin1 ?? null,
        latitude: Number(c.latitude),
        longitude: Number(c.longitude),
        elevation: c.elevation ?? null,
        timezone: c.timezone ?? null
      }
    })
  }

  const handleRemoveLocation = (id: string) => {
    dispatch({ type: 'REMOVE_LOCATION', payload: id })
  }

  const updateMetric = (metric: string, checked: boolean) => {
    const next = checked
      ? [...state.selectedMetrics, metric]
      : state.selectedMetrics.filter(m => m !== metric)
    dispatch({ type: 'SET_METRICS', payload: next as any })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>🌍 데이터 설정</h1>
        <p className={styles.subtitle}>관측 지점을 선택하고 분석할 기간과 변수를 설정하세요</p>
      </div>

      <div className={styles.content}>
        {/* Search Section */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>📍 도시 검색</h2>
          <input
            className={styles.searchInput}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="도시 또는 장소명을 입력하세요"
            type="text"
          />
          
          {loading && <LoadingState />}
          {error && <ErrorState message={error} />}
          {candidates.length === 0 && !loading && q && <EmptyState message="검색 결과가 없습니다" />}

          {candidates.length > 0 && (
            <div className={styles.candidatesList}>
              {candidates.map(c => (
                <div key={c.id} className={styles.candidateItem}>
                  <div className={styles.candidateInfo}>
                    <strong>{c.name}</strong>
                    <span className={styles.location}>
                      {c.country} {c.admin1 ? `(${c.admin1})` : ''}
                    </span>
                  </div>
                  <button
                    className={styles.addButton}
                    onClick={() => handleAddLocation(c)}
                  >
                    + 추가
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Selected Locations Section */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>✓ 선택 지점</h2>
          {state.locations.length === 0 ? (
            <EmptyState message="지점을 추가하세요" />
          ) : (
            <div className={styles.locationsList}>
              {state.locations.map(l => (
                <div key={l.id} className={styles.locationItem}>
                  <div className={styles.locationInfo}>
                    <strong>{l.name}</strong>
                    <span className={styles.location}>
                      {l.country} {l.admin1 ? `(${l.admin1})` : ''}
                    </span>
                  </div>
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveLocation(l.id)}
                  >
                    ✕ 제거
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Time Range and Variables Section */}
        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>⏱️ 기간 및 변수</h2>
          
          <div className={styles.rangeControls}>
            <div className={styles.rangeInput}>
              <label htmlFor="startYear">시작 연도</label>
              <input
                id="startYear"
                type="number"
                value={state.startYear}
                onChange={e => {
                  const userStart = Number(e.target.value)
                  const newStart = Math.min(userStart, 1991)
                  const newEnd = Math.max(state.endYear, 2020)
                  dispatch({
                    type: 'SET_RANGE',
                    payload: { startYear: newStart, endYear: newEnd }
                  })
                }}
              />
            </div>
            <div className={styles.rangeSeparator}>~</div>
            <div className={styles.rangeInput}>
              <label htmlFor="endYear">종료 연도</label>
              <input
                id="endYear"
                type="number"
                value={state.endYear}
                onChange={e => {
                  const userEnd = Number(e.target.value)
                  const newStart = Math.min(state.startYear, 1991)
                  const newEnd = Math.max(userEnd, 2020)
                  dispatch({
                    type: 'SET_RANGE',
                    payload: { startYear: newStart, endYear: newEnd }
                  })
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            💡 연간 편차 계산을 위해 1991–2020 기간이 자동으로 포함됩니다.
          </div>

          <div className={styles.metricsSection}>
            <h3>변수 선택</h3>
            <div className={styles.metricsPills}>
              <label className={`${styles.metricPill} ${state.selectedMetrics.includes('temperature_max') ? styles.selected : ''}`}>
                <input
                  type="checkbox"
                  checked={state.selectedMetrics.includes('temperature_max')}
                  onChange={e => updateMetric('temperature_max', e.target.checked)}
                />
                🌡️ 최대기온
              </label>
              <label className={`${styles.metricPill} ${state.selectedMetrics.includes('temperature_min') ? styles.selected : ''}`}>
                <input
                  type="checkbox"
                  checked={state.selectedMetrics.includes('temperature_min')}
                  onChange={e => updateMetric('temperature_min', e.target.checked)}
                />
                ❄️ 최소기온
              </label>
              <label className={`${styles.metricPill} ${state.selectedMetrics.includes('precipitation') ? styles.selected : ''}`}>
                <input
                  type="checkbox"
                  checked={state.selectedMetrics.includes('precipitation')}
                  onChange={e => updateMetric('precipitation', e.target.checked)}
                />
                💧 강수량
              </label>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.footer}>
        <button
          className={styles.primaryButton}
          disabled={state.locations.length === 0}
          onClick={() => navigate('/view')}
        >
          데이터 보기 →
        </button>
        <button
          className={styles.secondaryButton}
          onClick={() => {
            setQ('')
            setCandidates([])
          }}
        >
          초기화
        </button>
      </div>
    </div>
  )
}

export default DataSetupPage
