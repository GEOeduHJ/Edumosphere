import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DataSetupPage from './pages/DataSetupPage'
import DataViewPage from './pages/DataViewPage'
import ComparePage from './pages/ComparePage'
import MapPage from './pages/MapPage'
import { AppStateProvider } from './hooks/useAppState'

const App: React.FC = () => {
  return (
    <AppStateProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<Navigate to="/setup" replace />} />
          <Route path="/setup" element={<DataSetupPage />} />
          <Route path="/view" element={<DataViewPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/map" element={<MapPage />} />
        </Routes>
      </AppShell>
    </AppStateProvider>
  )
}

export default App
