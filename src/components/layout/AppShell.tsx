import React from 'react'
import { NavLink } from 'react-router-dom'
import Attribution from '../common/Attribution'

const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-shell">
      <header>
        <nav>
          <NavLink to="/">홈</NavLink>
          <NavLink to="/setup">데이터 설정</NavLink>
          <NavLink to="/view">데이터 보기</NavLink>
          <NavLink to="/compare">지점 비교</NavLink>
          <NavLink to="/map">지도</NavLink>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <Attribution />
      </footer>
    </div>
  )
}

export default AppShell
