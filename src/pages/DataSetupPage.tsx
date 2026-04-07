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

    // Automatically set the query to use full default range and all metrics
    dispatch({ type: 'SET_RANGE', payload: { startYear: 1991, endYear: 2026 } })
    dispatch({ type: 'SET_METRICS', payload: ['temperature', 'temperature_max', 'temperature_min', 'precipitation'] })
    // After selecting a location, go directly to the data view so the app fetches data
    navigate('/view')
  }

  const handleRemoveLocation = (id: string) => {
    dispatch({ type: 'REMOVE_LOCATION', payload: id })
  }

  // Metrics and range are set automatically; no manual controls here.

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

        <section className={styles.card}>
          <h2 className={styles.sectionTitle}>⏱️ 기간 및 변수</h2>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            선택한 지점으로 자동 호출: 기간 1991–2026, 모든 변수(온도·최저/최고·강수).
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
