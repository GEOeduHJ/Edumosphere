import React, { useEffect, useState } from 'react'
import { searchLocation } from '../api/geocoding'
import { useAppState } from '../hooks/useAppState'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import { useNavigate } from 'react-router-dom'

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

  return (
    <div className="page">
      <h1>📍 기후 데이터 설정</h1>
      
      <section>
        <h2>도시 검색</h2>
        <input 
          value={q} 
          onChange={e => setQ(e.target.value)} 
          placeholder="도시 또는 지역명을 입력하세요 (예: Seoul, Tokyo, London)" 
          style={{ width: '100%', marginBottom: 12, padding: '12px 16px', fontSize: '15px' }}
        />
        
        {loading && <LoadingState />}
        {error && <ErrorState message={error} />}
        {candidates.length === 0 && !loading && q && <EmptyState message="검색 결과가 없습니다" />}
        
        {candidates.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginTop: 12 }}>
            {candidates.map(c => (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ fontSize: 15, color: '#1f2937' }}>{c.name}</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {c.country} {c.admin1 ? `• ${c.admin1}` : ''}
                  </div>
                </div>
                <button 
                  onClick={() => dispatch({ type: 'ADD_LOCATION', payload: {
                    id: c.id ?? `${c.latitude},${c.longitude}`,
                    name: c.name,
                    country: c.country,
                    countryCode: c.country_code ?? null,
                    admin1: c.admin1 ?? null,
                    latitude: Number(c.latitude),
                    longitude: Number(c.longitude),
                    elevation: c.elevation ?? null,
                    timezone: c.timezone ?? null
                  }})}
                  style={{ width: '100%', background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)', color: 'white' }}
                >
                  + 추가하기
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>✓ 선택된 지점</h2>
        {state.locations.length === 0 ? (
          <EmptyState message="아직 선택한 지점이 없습니다. 위에서 도시를 검색해 추가하세요." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {state.locations.map(l => (
              <div key={l.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <strong style={{ color: 'var(--primary)' }}>{l.name}</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    {l.country} {l.admin1 ? `• ${l.admin1}` : ''}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                    📍 {l.latitude.toFixed(2)}°, {l.longitude.toFixed(2)}°
                  </div>
                </div>
                <button 
                  onClick={() => dispatch({ type: 'REMOVE_LOCATION', payload: l.id })}
                  style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                >
                  ✕ 제거
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>⏱️ 기간 및 변수 설정</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>시작 연도</label>
            <input 
              type="number" 
              value={state.startYear} 
              onChange={e => dispatch({ type: 'SET_RANGE', payload: { startYear: Number(e.target.value), endYear: state.endYear } })}
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>종료 연도</label>
            <input 
              type="number" 
              value={state.endYear} 
              onChange={e => dispatch({ type: 'SET_RANGE', payload: { startYear: state.startYear, endYear: Number(e.target.value) } })}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <h3 style={{ marginTop: 16 }}>조회 변수</h3>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: state.selectedMetrics.includes('temperature_max') ? 'rgba(30, 64, 175, 0.1)' : 'var(--lighter)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.3s ease' }}>
            <input 
              type="checkbox" 
              checked={state.selectedMetrics.includes('temperature_max')} 
              onChange={e => {
                const next = e.target.checked ? [...state.selectedMetrics, 'temperature_max'] : state.selectedMetrics.filter(m => m !== 'temperature_max')
                dispatch({ type: 'SET_METRICS', payload: next as any })
              }}
            />
            🌡️ 최고기온
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: state.selectedMetrics.includes('temperature_min') ? 'rgba(30, 64, 175, 0.1)' : 'var(--lighter)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.3s ease' }}>
            <input 
              type="checkbox" 
              checked={state.selectedMetrics.includes('temperature_min')} 
              onChange={e => {
                const next = e.target.checked ? [...state.selectedMetrics, 'temperature_min'] : state.selectedMetrics.filter(m => m !== 'temperature_min')
                dispatch({ type: 'SET_METRICS', payload: next as any })
              }}
            />
            ❄️ 최저기온
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: state.selectedMetrics.includes('precipitation') ? 'rgba(30, 64, 175, 0.1)' : 'var(--lighter)', borderRadius: 6, cursor: 'pointer', transition: 'all 0.3s ease' }}>
            <input 
              type="checkbox" 
              checked={state.selectedMetrics.includes('precipitation')} 
              onChange={e => {
                const next = e.target.checked ? [...state.selectedMetrics, 'precipitation'] : state.selectedMetrics.filter(m => m !== 'precipitation')
                dispatch({ type: 'SET_METRICS', payload: next as any })
              }}
            />
            💧 강수량
          </label>
        </div>
      </section>

      <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
        <button 
          disabled={state.locations.length === 0} 
          onClick={() => navigate('/view')}
          style={{ 
            fontSize: 16, 
            padding: '12px 32px',
            background: state.locations.length === 0 ? '#d1d5db' : 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
            color: 'white'
          }}
        >
          ➜ 데이터 보기
        </button>
        <button 
          style={{ 
            background: 'white',
            color: 'var(--muted)',
            border: '2px solid var(--border)',
            padding: '12px 32px'
          }}
          onClick={() => setQ('')}
        >
          초기화
        </button>
      </div>
    </div>
  )
}

export default DataSetupPage
