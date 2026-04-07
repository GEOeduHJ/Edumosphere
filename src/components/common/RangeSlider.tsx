import React from 'react'
import styles from '../../styles/RangeSlider.module.css'

type Props = {
  min: number
  max: number
  start: number
  end: number
  onStartChange: (val: number) => void
  onEndChange: (val: number) => void
  step?: number
  label?: string
}

const RangeSlider: React.FC<Props> = ({
  min,
  max,
  start,
  end,
  onStartChange,
  onEndChange,
  step = 1,
  label
}) => {
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val <= end) {
      onStartChange(val)
    }
  }

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    if (val >= start) {
      onEndChange(val)
    }
  }

  const rangePercent = max - min
  const startPercent = ((start - min) / rangePercent) * 100
  const endPercent = 100 - ((max - end) / rangePercent) * 100

  return (
    <div className={styles.container}>
      {label && <div className={styles.label}>{label}</div>}
      
      <div className={styles.inputsRow}>
        <div className={styles.inputGroup}>
          <input
            type="number"
            value={start}
            onChange={e => {
              const val = Number(e.target.value)
              if (val >= min && val <= end) onStartChange(val)
            }}
            className={styles.numberInput}
            min={min}
            max={end}
          />
        </div>
        <div className={styles.separator}>~</div>
        <div className={styles.inputGroup}>
          <input
            type="number"
            value={end}
            onChange={e => {
              const val = Number(e.target.value)
              if (val >= start && val <= max) onEndChange(val)
            }}
            className={styles.numberInput}
            min={start}
            max={max}
          />
        </div>
      </div>

      <div className={styles.sliderContainer}>
        <input
          type="range"
          min={min}
          max={max}
          value={start}
          onChange={handleStartChange}
          step={step}
          className={`${styles.slider} ${styles.sliderStart}`}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={end}
          onChange={handleEndChange}
          step={step}
          className={`${styles.slider} ${styles.sliderEnd}`}
        />
        <div className={styles.track}>
          <div
            className={styles.trackActive}
            style={{
              left: `${startPercent}%`,
              right: `${100 - endPercent}%`
            }}
          />
        </div>
      </div>

      <div className={styles.labelsRow}>
        <span className={styles.yearLabel}>{start}년</span>
        <span className={styles.yearLabel}>{end}년</span>
      </div>
    </div>
  )
}

export default RangeSlider
