import React, { createContext, useContext, useReducer } from 'react'
import { AppQuery, LocationResult, ClimateMetric } from '../types/climate'

type Action =
  | { type: 'ADD_LOCATION'; payload: LocationResult }
  | { type: 'REMOVE_LOCATION'; payload: string }
  | { type: 'SET_RANGE'; payload: { startYear: number; endYear: number } }
  | { type: 'SET_METRICS'; payload: ClimateMetric[] }
  | { type: 'SET_ACTIVE_METRIC'; payload: ClimateMetric }
  | { type: 'TOGGLE_COMPARISON'; payload?: boolean }

const now = new Date().getFullYear()
const initialState: AppQuery = {
  locations: [],
  startYear: now - 10,
  endYear: now,
  selectedMetrics: ['temperature_max', 'precipitation'] as ClimateMetric[],
  activeMetric: 'temperature_max',
  comparisonEnabled: false
}

function reducer(state: AppQuery, action: Action): AppQuery {
  switch (action.type) {
    case 'ADD_LOCATION':
      if (state.locations.find(l => l.id === action.payload.id)) return state
      return { ...state, locations: [...state.locations, action.payload] }
    case 'REMOVE_LOCATION':
      return { ...state, locations: state.locations.filter(l => l.id !== action.payload) }
    case 'SET_RANGE':
      return { ...state, startYear: action.payload.startYear, endYear: action.payload.endYear }
    case 'SET_METRICS':
      return { ...state, selectedMetrics: action.payload }
    case 'SET_ACTIVE_METRIC':
      return { ...state, activeMetric: action.payload }
    case 'TOGGLE_COMPARISON':
      return { ...state, comparisonEnabled: action.payload ?? !state.comparisonEnabled }
    default:
      return state
  }
}

const AppStateContext = createContext<{
  state: AppQuery
  dispatch: React.Dispatch<Action>
} | null>(null)

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState)
  return <AppStateContext.Provider value={{ state, dispatch }}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppStateContext)
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider')
  return ctx
}
