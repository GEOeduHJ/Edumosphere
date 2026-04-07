import React, { useState } from 'react'
import { useAppState } from '../hooks/useAppState'
import EmptyState from '../components/common/EmptyState'
import LoadingState from '../components/common/LoadingState'
import ErrorState from '../components/common/ErrorState'
import { useClimateQuery } from '../hooks/useClimateQuery'
import {
  aggregateDailyToMonthly,
  aggregateMonthlyToYearly,
  annualAnomalies
} from '../utils/aggregation'
import CompareChart from '../components/features/CompareChart'
import YearlyBreakdownChart from '../components/features/YearlyBreakdownChart'
import RadarChart from '../components/features/RadarChart'
import MonthlyBreakdownChart from '../components/features/MonthlyBreakdownChart'
import CumulativePrecipChart from '../components/features/CumulativePrecipChart'
import ClimateChart from '../components/features/ClimateChart'
import RangeSlider from '../components/common/RangeSlider'
import { formatNumberWithUnit } from '../utils/format'
import styles from '../styles/ComparePage.module.css'

const ComparePage: React.FC = () => {
  const { state } = useAppState()
  const [metric, setMetric] = useState<'temperature' | 'precipitation'>('temperature')
  
  const [pairwise, setPairwise] = useState(false)
  
  // Year-wise options
  const [yearlyChartType, setYearlyChartType] = useState<'overlay' | 'breakdown' | 'radar'>('overlay')
  const [radarYear, setRadarYear] = useState<number | null>(null)
  
  // Month-wise options
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [monthlyChartType, setMonthlyChartType] = useState<'compare' | 'breakdown' | 'cumulative'>('compare')
  
  // Per-section year ranges
  const [yearlyChartStart, setYearlyChartStart] = useState<number | null>(null)
  const [yearlyChartEnd, setYearlyChartEnd] = useState<number | null>(null)

  if (state.locations.length < 2) return <EmptyState message="비교하려면 최소 2개 지점을 선택하세요." />

  const { data, loading, error } = useClimateQuery(state)

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error.message} />

  const series = state.locations.map(loc => {
    const daily = data[loc.id] || []
    const monthly = aggregateDailyToMonthly(daily)
    const yearly = aggregateMonthlyToYearly(monthly)
    return { label: loc.name, daily, monthly, yearly }
  })

  const allYears = [...new Set(series.flatMap(s => s.yearly.map(y => y.year)))].sort((a, b) => a - b)
  const defaultStartYear = allYears.length > 0 ? allYears[0] : 1991
  const defaultEndYear = allYears.length > 0 ? allYears[allYears.length - 1] : 2020
  const effectiveStartYear = defaultStartYear
  const effectiveEndYear = defaultEndYear

  const filteredSeries = series.map(s => ({
    label: s.label,
    daily: s.daily,
    monthly: s.monthly.filter(m => m.year >= effectiveStartYear && m.year <= effectiveEndYear),
    yearly: s.yearly.filter(y => y.year >= effectiveStartYear && y.year <= effectiveEndYear)
  }))

  const transformedSeriesForAnomalyChart = filteredSeries.map(s => ({
    label: s.label,
    yearly: s.yearly
  }))

  // Yearly section with separate year range
  const yearlyChartYearStart = yearlyChartStart ?? effectiveStartYear
  const yearlyChartYearEnd = yearlyChartEnd ?? effectiveEndYear
  const yearlyFilteredSeries = series.map(s => ({
    label: s.label,
    daily: s.daily,
    monthly: s.monthly.filter(m => m.year >= yearlyChartYearStart && m.year <= yearlyChartYearEnd),
    yearly: s.yearly.filter(y => y.year >= yearlyChartYearStart && y.year <= yearlyChartYearEnd)
  }))

  const transformedYearlySeriesForAnomalyChart = yearlyFilteredSeries.map(s => ({
    label: s.label,
    yearly: s.yearly
  }))

  // Pairwise comparison
  const pairs: Array<[number, number]> = []
  for (let i = 0; i < state.locations.length; i++) {
    for (let j = 0; j < state.locations.length; j++) {
      if (i === j) continue
      pairs.push([i, j])
    }
  }

  const selectedYearForRadar = radarYear ?? allYears[0]

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>🔄 지점 간 비교</h1>
        <p>선택한 지점 ({state.locations.length})을 다양한 시각화로 비교합니다.</p>
      </div>

      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGrid}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>분석 변수</div>
            <div className={styles.radioGroup}>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="metric"
                  checked={metric === 'temperature'}
                  onChange={() => setMetric('temperature')}
                />
                🌡️ 기온
              </label>
              <label className={styles.radioItem}>
                <input
                  type="radio"
                  name="metric"
                  checked={metric === 'precipitation'}
                  onChange={() => setMetric('precipitation')}
                />
                💧 강수
              </label>
            </div>
          </div>

          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>비교 모드</div>
            <label className={styles.checkboxItem}>
              <input type="checkbox" checked={pairwise} onChange={e => setPairwise(e.target.checked)} />
              1:1 쌍별 매칭
            </label>
          </div>
        </div>

        {/* 전역 기간 필터 제거 — 필요하면 섹션별 슬라이더를 사용하세요 */}
      </div>

      {/* Yearly Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📈 연도별 비교</h2>
        
        <div style={{ marginBottom: 16 }}>
          <RangeSlider
            min={defaultStartYear}
            max={defaultEndYear}
            start={yearlyChartYearStart}
            end={yearlyChartYearEnd}
            onStartChange={setYearlyChartStart}
            onEndChange={setYearlyChartEnd}
            label="연도별 기간 선택"
          />
        </div>
        
        <div style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="yearlyType"
              checked={yearlyChartType === 'overlay'}
              onChange={() => setYearlyChartType('overlay')}
            />
            <span style={{ fontSize: 14 }}>한 줄로 겹쳐서 보기</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="yearlyType"
              checked={yearlyChartType === 'breakdown'}
              onChange={() => setYearlyChartType('breakdown')}
            />
            <span style={{ fontSize: 14 }}>개별 연도 그래프</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="yearlyType"
              checked={yearlyChartType === 'radar'}
              onChange={() => setYearlyChartType('radar')}
            />
            <span style={{ fontSize: 14 }}>방사형 그래프</span>
          </label>
        </div>

        {yearlyChartType === 'overlay' && (
          <CompareChart series={transformedYearlySeriesForAnomalyChart} metric={metric} />
        )}

        {yearlyChartType === 'breakdown' && (
          <YearlyBreakdownChart series={yearlyFilteredSeries} metric={metric} />
        )}

        {yearlyChartType === 'radar' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ marginBottom: 12, display: 'inline-block' }}>
              <strong>연도 선택:</strong>
              <select
                value={radarYear ?? ''}
                onChange={e => setRadarYear(e.target.value ? Number(e.target.value) : null)}
                style={{ marginLeft: 12, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
              >
                <option value="">선택...</option>
                {Array.from({ length: 2026 - 1991 + 1 }, (_, i) => 1991 + i).map(y => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </label>
            {radarYear && (
              // Radar should always use the full series (not range-filtered)
              <RadarChart series={series} year={radarYear} metric={metric} />
            )}
          </div>
        )}
      </div>

      {/* Monthly Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>📅 월별 비교</h2>

        <div style={{ marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong>연도 선택:</strong>
            <select
              value={selectedYear ?? ''}
              onChange={e => setSelectedYear(e.target.value ? Number(e.target.value) : null)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)' }}
            >
              <option value="">선택...</option>
              {allYears.map(y => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </label>

          {selectedYear && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="monthlyType"
                  checked={monthlyChartType === 'compare'}
                  onChange={() => setMonthlyChartType('compare')}
                />
                <span style={{ fontSize: 14 }}>월별 비교</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="radio"
                  name="monthlyType"
                  checked={monthlyChartType === 'breakdown'}
                  onChange={() => setMonthlyChartType('breakdown')}
                />
                <span style={{ fontSize: 14 }}>개별 월 그래프</span>
              </label>
              {metric === 'precipitation' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="radio"
                    name="monthlyType"
                    checked={monthlyChartType === 'cumulative'}
                    onChange={() => setMonthlyChartType('cumulative')}
                  />
                  <span style={{ fontSize: 14 }}>누적 강수</span>
                </label>
              )}
            </div>
          )}
        </div>

        {selectedYear && (
          <>
            {monthlyChartType === 'compare' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                {filteredSeries.map((s, idx) => (
                  <div key={idx} style={{ background: 'white', borderRadius: '8px', padding: '16px', border: '1px solid var(--color-border)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>{s.label}</h3>
                    <ClimateChart monthly={s.monthly.filter(m => m.year === selectedYear)} />
                  </div>
                ))}
              </div>
            )}

            {monthlyChartType === 'breakdown' && (
              // Provide per-series daily records filtered to the selected year so
              // MonthlyBreakdownChart always has the correct per-series data.
              <MonthlyBreakdownChart
                series={filteredSeries.map(s => ({
                  label: s.label,
                  daily: s.daily.filter(d => {
                    const [y] = d.date.split('-')
                    return Number(y) === selectedYear
                  })
                }))}
                year={selectedYear}
                metric={metric}
              />
            )}

            {monthlyChartType === 'cumulative' && metric === 'precipitation' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                {filteredSeries.map((s, idx) => (
                  <div key={idx} style={{ background: 'white', borderRadius: '8px', padding: '16px', border: '1px solid var(--color-border)' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>{s.label}</h3>
                    <CumulativePrecipChart monthly={s.monthly.filter(m => m.year === selectedYear)} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pairwise Comparison */}
      {pairwise && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>🔗 1:1 쌍별 비교</h2>
          {pairs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center' }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>짝을 이룰 수 있는 지점이 없습니다.</p>
            </div>
          ) : (
            <div className={styles.pairsGrid}>
              {pairs.map(([a, b], idx) => {
                const lhsOrig = filteredSeries[a]
                const rhsOrig = filteredSeries[b]
                
                const lhsMeans = lhsOrig.yearly.map(y => metric === 'precipitation' ? y.totalPrecipitation : y.meanTemp).filter(v => typeof v === 'number') as number[]
                const rhsMeans = rhsOrig.yearly.map(y => metric === 'precipitation' ? y.totalPrecipitation : y.meanTemp).filter(v => typeof v === 'number') as number[]
                
                const meanA = lhsMeans.length > 0 ? lhsMeans.reduce((a, b) => a + b, 0) / lhsMeans.length : null
                const meanB = rhsMeans.length > 0 ? rhsMeans.reduce((a, b) => a + b, 0) / rhsMeans.length : null
                const diff = meanA == null || meanB == null ? null : meanA - meanB

                return (
                  <div key={idx} className={styles.pairCard}>
                    <h3 className={styles.pairCardTitle}>
                      {lhsOrig.label} <span style={{ color: 'var(--color-text-secondary)' }}>vs</span> {rhsOrig.label}
                    </h3>

                    <div className={styles.pairChartContainer}>
                      <CompareChart series={[lhsOrig, rhsOrig]} metric={metric} />
                    </div>

                    <div className={styles.pairStats}>
                      <div className={styles.statItem}>
                        <div className={styles.statLabel}>{lhsOrig.label}</div>
                        <div className={styles.statValue}>{formatNumberWithUnit(meanA, metric === 'precipitation' ? 'mm' : '°C')}</div>
                      </div>
                      <div className={styles.statItem}>
                        <div className={styles.statLabel}>{rhsOrig.label}</div>
                        <div className={styles.statValue}>{formatNumberWithUnit(meanB, metric === 'precipitation' ? 'mm' : '°C')}</div>
                      </div>
                      <div className={`${styles.statItem} ${styles.diffStat}`}>
                        <div className={styles.statLabel}>차이 ({lhsOrig.label} - {rhsOrig.label})</div>
                        <div className={`${styles.statValue} ${styles.diffValue}`}>
                          {diff == null ? '—' : formatNumberWithUnit(diff, metric === 'precipitation' ? 'mm' : '°C')}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ComparePage
