export function formatDateIso(dateIso: string): string {
  // expecting YYYY-MM-DD
  return dateIso
}

export function formatNumberWithUnit(value?: number | null, unit?: string): string {
  if (value == null) return '—'
  const rounded = Math.round((value + Number.EPSILON) * 10) / 10
  return `${rounded}${unit ? ' ' + unit : ''}`
}

export function exportCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return
  const keys = Object.keys(rows[0])
  const escape = (v: any) => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('\n') || s.includes('"')) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const csv = [keys.join(',')]
    .concat(rows.map(r => keys.map(k => escape(r[k] ?? '')).join(',')))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
