import React from 'react'
import { Link } from 'react-router-dom'
import styles from '../styles/HomePage.module.css'

const HomePage: React.FC = () => {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Edumosphere</h1>
        <p>원하는 자료 유형을 선택하여 시작하세요.</p>
      </header>

      <div className={styles.grid}>
        <article className={styles.card}>
          <h2>단일 지점 데이터</h2>
          <p>도시 한 곳을 검색하여 연도별·월별 그래프를 확인합니다.</p>
          <Link to="/setup" className={styles.link}>시작하기 →</Link>
        </article>

        <article className={styles.card}>
          <h2>지점 비교</h2>
          <p>두 곳 이상을 선택하여 연도별·월별로 비교 분석합니다.</p>
          <Link to="/compare" className={styles.link}>비교하기 →</Link>
        </article>

        <article className={styles.card}>
          <h2>지도 자료</h2>
          <p>지도를 크게 보고 행정구역을 스타일링 및 내보내기 합니다.</p>
          <Link to="/map" className={styles.link}>지도로 이동 →</Link>
        </article>
      </div>
    </div>
  )
}

export default HomePage
