import React, { useMemo } from 'react'
import EmptyState from '../common/EmptyState'
import LoadingState from '../common/LoadingState'
import useCountryProfiles from '../../hooks/useCountryProfiles'
import { formatNumberWithUnit } from '../../utils/format'

type Props = { iso3List: string[] }

const INDICATOR_LABELS: Record<string, string> = {
  'SP.POP.TOTL': '인구 (총계)',
  'NY.GDP.PCAP.CD': '1인당 GDP (USD)'
}

const CountryComparePanel: React.FC<Props> = ({ iso3List }) => {
  const { profiles, loading } = useCountryProfiles(iso3List)

  const isoList = useMemo(() => (iso3List || []).map(s => (s || '').toUpperCase()).filter(Boolean), [iso3List])

  if (!isoList || isoList.length === 0) return <EmptyState message="국가를 선택하면 비교 정보를 표시합니다" />
  if (loading) return <LoadingState />

  if (isoList.length === 1) {
    const p = profiles[isoList[0]]
    if (!p) return <EmptyState message="데이터 없음" />
    const r = p.restCountry
    return (
      <div style={{ border: '1px solid #efefef', padding: 12, borderRadius: 8, background: '#fff' }}>
        <h3 style={{ marginTop: 0 }}>{p.name || r?.commonName || p.iso3}</h3>
        {r?.flagPng ? <img src={r.flagPng} alt="flag" style={{ width: 120, height: 'auto', borderRadius: 4 }} /> : null}
        <div style={{ marginTop: 8 }}>
          <div><strong>공식명:</strong> {r?.officialName || '-'}</div>
          <div><strong>수도:</strong> {r?.capital?.join(', ') || '-'}</div>
          <div><strong>지역:</strong> {r?.region || '-'} {r?.subregion ? ` / ${r.subregion}` : ''}</div>
          <div><strong>인구:</strong> {r?.population ? formatNumberWithUnit(r.population) : '-'}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <h4>지표</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {Object.entries(p.indicators || {}).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ padding: 6, borderTop: '1px solid #f0f0f0' }}>{INDICATOR_LABELS[k] || k}</td>
                  <td style={{ padding: 6, borderTop: '1px solid #f0f0f0', textAlign: 'right' }}>{v && v.value != null ? (k === 'SP.POP.TOTL' ? formatNumberWithUnit(v.value) : Number(v.value).toLocaleString()) : '데이터 없음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (isoList.length > 5) return <EmptyState message="최대 5개까지 비교할 수 있습니다" />

  // 2..5 comparison table
  const indicators = Object.keys(INDICATOR_LABELS)
  return (
    <div style={{ border: '1px solid #efefef', padding: 8, borderRadius: 8, background: '#fff', overflowX: 'auto' }}>
      <h4 style={{ marginTop: 0 }}>국가 비교 ({isoList.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid #eee' }}>지표</th>
            {isoList.map(iso => <th key={iso} style={{ textAlign: 'right', padding: 6, borderBottom: '1px solid #eee' }}>{profiles[iso]?.name || iso}</th>)}
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => (
            <tr key={ind}>
              <td style={{ padding: 6, borderTop: '1px solid #f6f6f6' }}>{INDICATOR_LABELS[ind] || ind}</td>
              {isoList.map(iso => {
                const v = profiles[iso]?.indicators?.[ind]
                return <td key={iso + ind} style={{ padding: 6, textAlign: 'right', borderTop: '1px solid #f6f6f6' }}>{v && v.value != null ? (ind === 'SP.POP.TOTL' ? formatNumberWithUnit(v.value) : Number(v.value).toLocaleString()) : '—'}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default CountryComparePanel
