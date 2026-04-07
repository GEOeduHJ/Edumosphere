import React, { useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { useAppState } from '../hooks/useAppState'
import { useClimateQuery } from '../hooks/useClimateQuery'
import LoadingState from '../components/common/LoadingState'
import EmptyState from '../components/common/EmptyState'
import ErrorState from '../components/common/ErrorState'
import { aggregateDailyToMonthly, aggregateMonthlyToYearly } from '../utils/aggregation'
import { exportCsv, formatNumberWithUnit } from '../utils/format'
import ClimateChart from '../components/features/ClimateChart'
import CumulativePrecipChart from '../components/features/CumulativePrecipChart'
import MonthlyAnomalyChart from '../components/features/MonthlyAnomalyChart'
import AnnualAnomalyChart from '../components/features/AnnualAnomalyChart'
import CompareChart from '../components/features/CompareChart'
import RadarChart from '../components/features/RadarChart'
import RangeSlider from '../components/common/RangeSlider'
import styles from '../styles/DataViewPage.module.css'

const DataViewPage: React.FC = () => {
  const { state } = useAppState()
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedCharts, setSelectedCharts] = useState<string[]>(['mixed'])
  const [metric, setMetric] = useState<'temperature' | 'precipitation'>('temperature')
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null)
  const [filterStartYear, setFilterStartYear] = useState<number | null>(null)
  const [filterEndYear, setFilterEndYear] = useState<number | null>(null)
  const [expandedMonthly, setExpandedMonthly] = useState(false)
  const [expandedYearly, setExpandedYearly] = useState(false)
  const [expandedDailyTable, setExpandedDailyTable] = useState(false)
  const [radarYear, setRadarYear] = useState<number | null>(null)
  
  // Per-chart year ranges
  const [mixedChartStart, setMixedChartStart] = useState<number | null>(null)
  const [mixedChartEnd, setMixedChartEnd] = useState<number | null>(null)
  const [cumulativeChartStart, setCumulativeChartStart] = useState<number | null>(null)
  const [cumulativeChartEnd, setCumulativeChartEnd] = useState<number | null>(null)
  const [anomalyChartStart, setAnomalyChartStart] = useState<number | null>(null)
  const [anomalyChartEnd, setAnomalyChartEnd] = useState<number | null>(null)
  const [annualChartStart, setAnnualChartStart] = useState<number | null>(null)
  const [annualChartEnd, setAnnualChartEnd] = useState<number | null>(null)
  
  const query = state
  const { data, loading, error } = useClimateQuery(query)

  useEffect(() => {
    if (activeIndex >= state.locations.length) setActiveIndex(Math.max(0, state.locations.length - 1))
  }, [state.locations.length, activeIndex])

  if (state.locations.length === 0) return <EmptyState message="선택된 지점이 없습니다. 먼저 지점을 추가하세요." />
  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error.message} />

  const active = state.locations[activeIndex]
  const daily = data[active.id] || []
  const monthly = aggregateDailyToMonthly(daily)
  const yearly = aggregateMonthlyToYearly(monthly)
  
  const allYears = [...new Set([...monthly.map(m => m.year), ...yearly.map(y => y.year)])].sort((a, b) => a - b)
  const defaultStartYear = allYears.length > 0 ? allYears[0] : 1991
  const defaultEndYear = allYears.length > 0 ? allYears[allYears.length - 1] : 2020
  const effectiveStartYear = filterStartYear ?? defaultStartYear
  const effectiveEndYear = filterEndYear ?? defaultEndYear
  
  const filteredMonthly = monthly.filter(m => m.year >= effectiveStartYear && m.year <= effectiveEndYear)
  const filteredYearly = yearly.filter(y => y.year >= effectiveStartYear && y.year <= effectiveEndYear)

  // Per-chart filtered data
  const mixedStart = mixedChartStart ?? effectiveStartYear
  const mixedEnd = mixedChartEnd ?? effectiveEndYear
  const mixedMonthly = monthly.filter(m => m.year >= mixedStart && m.year <= mixedEnd)

  const cumulativeStart = cumulativeChartStart ?? effectiveStartYear
  const cumulativeEnd = cumulativeChartEnd ?? effectiveEndYear
  const cumulativeMonthly = monthly.filter(m => m.year >= cumulativeStart && m.year <= cumulativeEnd)

  const anomalyStart = anomalyChartStart ?? effectiveStartYear
  const anomalyEnd = anomalyChartEnd ?? effectiveEndYear
  const anomalyMonthly = monthly.filter(m => m.year >= anomalyStart && m.year <= anomalyEnd)

  const annualStart = annualChartStart ?? effectiveStartYear
  const annualEnd = annualChartEnd ?? effectiveEndYear
  const annualYearly = yearly.filter(y => y.year >= annualStart && y.year <= annualEnd)

  const CHARTS = [
    { id: 'mixed', label: '월별 혼합(기온+강수)' },
    { id: 'cumulative', label: '누적 강수(연내 누적)' },
    { id: 'monthly-anomaly', label: '월별 편차 (월별 기준)' },
    { id: 'annual-anomaly', label: '연간 편차 (기준 1991–2020)' },
    { id: 'annual', label: '연도별 평균' },
    { id: 'radar', label: '방사형 그래프 (12개월)' }
  ]

  const toggleChart = (id: string) => {
    setSelectedCharts(prev => (prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]))
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>📊 데이터 및 그래프 열람</h1>
        <p>관측 지점별 기후 데이터를 시각화하고 분석합니다</p>
      </div>

      {/* Location Tabs */}
      <div className={styles.locationTabs}>
        {state.locations.map((l, i) => (
          <button
            key={l.id}
            className={`${styles.locationTab} ${i === activeIndex ? styles.active : ''}`}
            onClick={() => setActiveIndex(i)}
          >
            {l.name}
          </button>
        ))}
      </div>

      {/* Control Panel */}
      <div className={styles.controlPanel}>
        <div className={styles.controlGrid}>
          <div className={styles.controlGroup}>
            <div className={styles.controlLabel}>표시할 그래프</div>
            <div className={styles.checkboxGroup}>
              {CHARTS.map(c => (
                <label key={c.id} className={styles.checkboxItem}>
                  <input
                    type="checkbox"
                    checked={selectedCharts.includes(c.id)}
                    onChange={() => toggleChart(c.id)}
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </div>

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
        </div>

        <RangeSlider
          min={defaultStartYear}
          max={defaultEndYear}
          start={effectiveStartYear}
          end={effectiveEndYear}
          onStartChange={setFilterStartYear}
          onEndChange={setFilterEndYear}
          label="기간 필터"
        />
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        {selectedCharts.includes('mixed') && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                min={defaultStartYear}
                max={defaultEndYear}
                start={mixedStart}
                end={mixedEnd}
                onStartChange={setMixedChartStart}
                onEndChange={setMixedChartEnd}
                label="월별 혼합 - 기간"
              />
            </div>
            <ClimateChart monthly={mixedMonthly} />
          </div>
        )}
        {selectedCharts.includes('cumulative') && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                min={defaultStartYear}
                max={defaultEndYear}
                start={cumulativeStart}
                end={cumulativeEnd}
                onStartChange={setCumulativeChartStart}
                onEndChange={setCumulativeChartEnd}
                label="누적 강수 - 기간"
              />
            </div>
            <CumulativePrecipChart monthly={cumulativeMonthly} />
          </div>
        )}
        {selectedCharts.includes('monthly-anomaly') && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                min={defaultStartYear}
                max={defaultEndYear}
                start={anomalyStart}
                end={anomalyEnd}
                onStartChange={setAnomalyChartStart}
                onEndChange={setAnomalyChartEnd}
                label="월별 편차 - 기간"
              />
            </div>
            <MonthlyAnomalyChart monthly={anomalyMonthly} metric={metric} />
          </div>
        )}
        {selectedCharts.includes('annual-anomaly') && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                min={defaultStartYear}
                max={defaultEndYear}
                start={anomalyStart}
                end={anomalyEnd}
                onStartChange={setAnomalyChartStart}
                onEndChange={setAnomalyChartEnd}
                label="연간 편차 - 기간"
              />
            </div>
            <AnnualAnomalyChart yearly={yearly.filter(y => y.year >= anomalyStart && y.year <= anomalyEnd)} metric={metric} baselineStart={1991} baselineEnd={2020} />
          </div>
        )}
        {selectedCharts.includes('annual') && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16 }}>
              <RangeSlider
                min={defaultStartYear}
                max={defaultEndYear}
                start={annualStart}
                end={annualEnd}
                onStartChange={setAnnualChartStart}
                onEndChange={setAnnualChartEnd}
                label="연도별 평균 - 기간"
              />
            </div>
            <CompareChart series={[{ label: active.name, yearly: annualYearly }]} metric={metric} />
          </div>
        )}
        {selectedCharts.includes('radar') && yearly.length > 0 && (
          <div className={styles.chartCard}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <RangeSlider
                  min={defaultStartYear}
                  max={defaultEndYear}
                  start={mixedStart}
                  end={mixedEnd}
                  onStartChange={setMixedChartStart}
                  onEndChange={setMixedChartEnd}
                  label="방사형 그래프 - 기간"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
                  연도 선택
                </label>
                <select
                  value={radarYear ?? ''}
                  onChange={e => setRadarYear(e.target.value ? Number(e.target.value) : null)}
                  style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', minWidth: '120px' }}
                >
                  <option value="">선택...</option>
                  {allYears.filter(y => y >= mixedStart && y <= mixedEnd).map(y => (
                    <option key={y} value={y}>
                      {y}년
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {radarYear && (
              <RadarChart series={[{ label: active.name, monthly: mixedMonthly }]} year={radarYear} metric={metric} />
            )}
          </div>
        )}
      </div>

      {/* Monthly Detail */}
      <div className={styles.detailCard}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: 600 }}>📅 월별 상세 조회</h2>
        <div className={styles.detailHeader}>
          <div className={styles.selectGroup}>
            <label htmlFor="yearSelect">
              연도
            </label>
            <select
              id="yearSelect"
              value={selectedYear ?? ''}
              onChange={e => {
                setSelectedYear(e.target.value ? Number(e.target.value) : null)
                setSelectedMonth(null)
              }}
            >
              <option value="">선택...</option>
              {[...new Set(monthly.map(m => m.year))].sort((a, b) => b - a).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {selectedYear && (
            <div className={styles.selectGroup}>
              <label htmlFor="monthSelect">
                월
              </label>
              <select
                id="monthSelect"
                value={selectedMonth ?? ''}
                onChange={e => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">선택...</option>
                {monthly.filter(m => m.year === selectedYear).sort((a, b) => a.month - b.month).map(m => (
                  <option key={m.month} value={m.month}>{m.month}월</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedYear && selectedMonth && (() => {
          const selected = monthly.find(m => m.year === selectedYear && m.month === selectedMonth)
          const dailyForMonth = daily.filter(d => {
            const [year, month] = d.date.split('-')
            return Number(year) === selectedYear && Number(month) === selectedMonth
          })
          
          const dailyX = dailyForMonth.map(d => d.date)
          const dailyTempMax = dailyForMonth.map(d => d.temperatureMax ?? null)
          const dailyTempMin = dailyForMonth.map(d => d.temperatureMin ?? null)
          const dailyPrecip = dailyForMonth.map(d => d.precipitationSum ?? null)
          
          return (
            <div className={styles.detailContent}>
              {selected && (
                <div className={styles.statGrid}>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>월별 평균기온</div>
                    <div className={styles.statValue}>{formatNumberWithUnit(selected.meanTemp, '°C')}</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>월별 강수량</div>
                    <div className={styles.statValue}>{formatNumberWithUnit(selected.totalPrecipitation, 'mm')}</div>
                  </div>
                  <div className={styles.statBox}>
                    <div className={styles.statLabel}>관측 일수</div>
                    <div className={styles.statValue}>{selected.daysCounted}일</div>
                  </div>
                </div>
              )}

              {dailyForMonth.length > 0 && (
                <>
                  <div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 600 }}>일별 그래프</h3>
                    <Plot
                      data={[
                        {
                          x: dailyX,
                          y: dailyTempMax,
                          type: 'scatter',
                          mode: 'lines+markers',
                          name: '최고기온',
                          line: { color: '#d62728' }
                        },
                        {
                          x: dailyX,
                          y: dailyTempMin,
                          type: 'scatter',
                          mode: 'lines+markers',
                          name: '최저기온',
                          line: { color: '#1f77b4' }
                        },
                        {
                          x: dailyX,
                          y: dailyPrecip,
                          type: 'bar',
                          name: '강수량',
                          yaxis: 'y2',
                          marker: { color: '#2ca02c' },
                          opacity: 0.6
                        }
                      ] as any}
                      layout={{
                        margin: { t: 20, r: 50, l: 50, b: 80 },
                        xaxis: { title: '날짜', tickangle: -45 },
                        yaxis: { title: '기온 (°C)', side: 'left' },
                        yaxis2: { title: '강수량 (mm)', overlaying: 'y', side: 'right' },
                        legend: { orientation: 'h', y: -0.25 }
                      } as any}
                      style={{ width: '100%', height: '420px' }}
                      useResizeHandler={true}
                    />
                  </div>

                  <div className={styles.collapsibleSection}>
                    <div
                      className={styles.sectionHeader}
                      onClick={() => setExpandedDailyTable(!expandedDailyTable)}
                    >
                      <span className={`${styles.sectionToggle} ${!expandedDailyTable ? styles.collapsed : ''}`}>▼</span>
                      일별 데이터 표
                    </div>
                    {expandedDailyTable && (
                      <div style={{ overflowX: 'auto' }}>
                        <table className={styles.dataTable}>
                        <thead className={styles.dataTableHeader}>
                          <tr>
                            <th>날짜</th>
                            <th>최고기온 (°C)</th>
                            <th>최저기온 (°C)</th>
                            <th>강수량 (mm)</th>
                          </tr>
                        </thead>
                        <tbody className={styles.dataTableBody}>
                          {dailyForMonth.map(d => (
                            <tr key={d.date}>
                              <td>{d.date}</td>
                              <td>{formatNumberWithUnit(d.temperatureMax, '°C')}</td>
                              <td>{formatNumberWithUnit(d.temperatureMin, '°C')}</td>
                              <td>{formatNumberWithUnit(d.precipitationSum, 'mm')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* Meta Info */}
      <div className={styles.detailCard}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>ℹ️ 관측지점 정보</h2>
        <div className={styles.metaInfo}>
          <span className={styles.metaLabel}>지점명</span>
          <span className={styles.metaValue}>{active.name}</span>
          <span className={styles.metaLabel}>위치</span>
          <span className={styles.metaValue}>{active.country} {active.admin1 ? `(${active.admin1})` : ''}</span>
          <span className={styles.metaLabel}>좌표</span>
          <span className={styles.metaValue}>{active.latitude.toFixed(4)}, {active.longitude.toFixed(4)}</span>
          {active.elevation && (
            <>
              <span className={styles.metaLabel}>표고</span>
              <span className={styles.metaValue}>{active.elevation}m</span>
            </>
          )}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className={styles.collapsibleSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setExpandedMonthly(!expandedMonthly)}
        >
          <span className={`${styles.sectionToggle} ${!expandedMonthly ? styles.collapsed : ''}`}>▼</span>
          월별 요약
        </div>
        {expandedMonthly && (
          <div className={styles.sectionContent}>
            {monthly.length === 0 ? (
              <EmptyState message="데이터가 없습니다" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.dataTable}>
                  <thead className={styles.dataTableHeader}>
                    <tr>
                      <th>연도</th>
                      <th>월</th>
                      <th>평균기온 (°C)</th>
                      <th>강수량 (mm)</th>
                      <th>일수</th>
                    </tr>
                  </thead>
                  <tbody className={styles.dataTableBody}>
                    {monthly.map(m => (
                      <tr key={`${m.year}-${m.month}`}>
                        <td>{m.year}</td>
                        <td>{m.month}</td>
                        <td>{formatNumberWithUnit(m.meanTemp, '°C')}</td>
                        <td>{formatNumberWithUnit(m.totalPrecipitation, 'mm')}</td>
                        <td>{m.daysCounted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={styles.footer}>
              <button
                className={styles.exportButton}
                onClick={() =>
                  exportCsv(
                    `${active.name.replace(/\s+/g, '_')}_monthly.csv`,
                    monthly.map(m => ({
                      year: m.year,
                      month: m.month,
                      meanTemp: m.meanTemp,
                      totalPrecipitation: m.totalPrecipitation,
                      daysCounted: m.daysCounted
                    }))
                  )
                }
              >
                📥 월별 데이터 내보내기
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Yearly Summary */}
      <div className={styles.collapsibleSection}>
        <div
          className={styles.sectionHeader}
          onClick={() => setExpandedYearly(!expandedYearly)}
        >
          <span className={`${styles.sectionToggle} ${!expandedYearly ? styles.collapsed : ''}`}>▼</span>
          연도별 요약
        </div>
        {expandedYearly && (
          <div className={styles.sectionContent}>
            {yearly.length === 0 ? (
              <EmptyState message="데이터가 없습니다" />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.dataTable}>
                  <thead className={styles.dataTableHeader}>
                    <tr>
                      <th>연도</th>
                      <th>평균기온 (°C)</th>
                      <th>강수량 (mm)</th>
                      <th>최고월</th>
                      <th>최저월</th>
                      <th>최다강수월</th>
                    </tr>
                  </thead>
                  <tbody className={styles.dataTableBody}>
                    {yearly.map(y => (
                      <tr key={y.year}>
                        <td>{y.year}</td>
                        <td>{formatNumberWithUnit(y.meanTemp, '°C')}</td>
                        <td>{formatNumberWithUnit(y.totalPrecipitation, 'mm')}</td>
                        <td>{y.hottestMonth ?? '—'}</td>
                        <td>{y.coldestMonth ?? '—'}</td>
                        <td>{y.wettestMonth ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default DataViewPage
