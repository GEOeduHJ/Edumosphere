import { useEffect, useState } from 'react'
import { SelectedCountry, CountryProfile } from '../types/country'
import { fetchRestCountriesByIso3 } from '../services/restCountries'
import { fetchWorldBankMeta, fetchWorldBankIndicators } from '../services/worldBank'

const DEFAULT_INDICATORS = ['SP.POP.TOTL', 'NY.GDP.PCAP.CD']

export function useCountryProfiles(iso3List: string[], indicators: string[] = DEFAULT_INDICATORS) {
  const [profiles, setProfiles] = useState<Record<string, CountryProfile | null>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const uniq = Array.from(new Set((iso3List || []).map(s => (s || '').toUpperCase()).filter(Boolean)))
        if (uniq.length === 0) {
          if (mounted) { setProfiles({}); setLoading(false) }
          return
        }

        // fetch restcountries in batch
        const restMap = await fetchRestCountriesByIso3(uniq)

        const out: Record<string, CountryProfile | null> = {}

        await Promise.all(uniq.map(async iso => {
          try {
            const rest = restMap[iso] || null
            const meta = await fetchWorldBankMeta(iso)
            const inds = await fetchWorldBankIndicators(iso, indicators)
            out[iso] = {
              iso3: iso,
              iso2: rest && (rest as any).iso2 ? (rest as any).iso2 : undefined,
              name: rest && (rest as any).commonName ? (rest as any).commonName : undefined,
              restCountry: rest,
              worldBankMeta: meta,
              indicators: inds,
              wbCode: meta && meta.id ? meta.id : null
            }
          } catch (e) {
            out[iso] = { iso3: iso, restCountry: null, worldBankMeta: null, indicators: {}, wbCode: null }
          }
        }))

        if (mounted) {
          setProfiles(out)
          setLoading(false)
        }
      } catch (e: any) {
        if (mounted) {
          setError(String(e || 'error'))
          setLoading(false)
        }
      }
    }
    run()
    return () => { mounted = false }
  }, [JSON.stringify(iso3List || []), JSON.stringify(indicators || [])])

  return { profiles, loading, error }
}

export default useCountryProfiles
