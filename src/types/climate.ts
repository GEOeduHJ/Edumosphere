export type LocationResult = {
  id: string
  name: string
  country: string
  countryCode?: string | null
  admin1?: string | null
  latitude: number
  longitude: number
  elevation?: number | null
  timezone?: string | null
}

export type ClimateMetric = 'temperature' | 'temperature_max' | 'temperature_min' | 'precipitation'

export type AppQuery = {
  locations: LocationResult[]
  startYear: number
  endYear: number
  selectedMetrics: ClimateMetric[]
  activeMetric: ClimateMetric
  comparisonEnabled: boolean
}

export type DailyWeatherRecord = {
  date: string // YYYY-MM-DD
  temperatureMax?: number | null
  temperatureMin?: number | null
  precipitationSum?: number | null
}

export type MonthlyClimateRecord = {
  year: number
  month: number // 1-12
  meanTemp?: number | null
  totalPrecipitation?: number | null
  daysCounted: number
}

export type YearlyClimateRecord = {
  year: number
  meanTemp?: number | null
  totalPrecipitation?: number | null
  hottestMonth?: number | null
  coldestMonth?: number | null
  wettestMonth?: number | null
}
