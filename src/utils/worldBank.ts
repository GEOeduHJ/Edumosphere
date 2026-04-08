export function parseLatestIndicator(json: any): { value: number | null; year: number | null } {
  try {
    if (!Array.isArray(json) || !Array.isArray(json[1])) return { value: null, year: null }
    const series = json[1]
    for (const entry of series) {
      if (!entry) continue
      // World Bank entries have `value` (number|null) and `date` (string year)
      if (entry.value != null) {
        const value = typeof entry.value === 'number' ? entry.value : Number(entry.value)
        const year = entry.date ? Number(entry.date) : null
        return { value: Number.isFinite(value) ? value : null, year: Number.isFinite(year) ? year : null }
      }
    }
    return { value: null, year: null }
  } catch (e) {
    return { value: null, year: null }
  }
}
