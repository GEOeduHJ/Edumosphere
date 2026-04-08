export type SelectedCountry = {
  name: string
  iso3: string
  iso2?: string
}

export type RestCountryProfile = {
  iso2?: string
  officialName?: string
  commonName?: string
  flagPng?: string
  capital?: string[]
  region?: string
  subregion?: string
  population?: number
  languages?: Record<string, string>
  currencies?: Record<string, { name: string; symbol?: string }>
}

export type WorldBankIndicatorValue = {
  indicator: string
  value: number | null
  year: number | null
}

export type CountryProfile = {
  iso3: string
  iso2?: string
  name?: string
  restCountry?: RestCountryProfile | null
  worldBankMeta?: any | null
  indicators?: Record<string, WorldBankIndicatorValue>
  wbCode?: string | null
}
