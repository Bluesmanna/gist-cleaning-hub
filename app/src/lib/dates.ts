// Small date helpers. All "day" strings are local YYYY-MM-DD.

export const pad = (n: number) => String(n).padStart(2, '0')

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseYmd(s)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export function today(): string {
  return ymd(new Date())
}

export function at(day: string, hhmm: string): Date {
  const d = parseYmd(day)
  const [h, m] = hhmm.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

export function isoAt(day: string, hhmm: string): string {
  return at(day, hhmm).toISOString()
}

export function hoursBetween(a: string | Date, b: string | Date): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3600000
}

export function startOfWeek(s: string): string {
  // Workweek runs Sunday–Saturday (used for overtime).
  const d = parseYmd(s)
  d.setDate(d.getDate() - d.getDay())
  return ymd(d)
}

export function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WDL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const weekdayShort = (i: number) => WD[i]
export const weekdayLong = (i: number) => WDL[i]

export function fmtDay(s: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseYmd(s)
  let out = `${MO[d.getMonth()]} ${d.getDate()}`
  if (opts.weekday) out = `${WD[d.getDay()]}, ${out}`
  if (opts.year) out += `, ${d.getFullYear()}`
  return out
}

export function fmtTime(hhmmOrIso: string): string {
  let h: number, m: number
  if (hhmmOrIso.includes('T')) {
    const d = new Date(hhmmOrIso)
    h = d.getHours()
    m = d.getMinutes()
  } else {
    ;[h, m] = hhmmOrIso.split(':').map(Number)
  }
  const ap = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 || 12
  return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`
}

export function fmtDateTime(iso: string): string {
  return `${fmtDay(ymd(new Date(iso)), { weekday: true })} ${fmtTime(iso)}`
}

export function hhmm(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return fmtDay(ymd(new Date(iso)), { year: true })
}

export const money = (n: number) =>
  (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const hrs = (n: number) => `${(Math.round(n * 100) / 100).toFixed(2)} hrs`

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`
}

export const mins = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const shiftHours = (s: { start: string; end: string }) => (mins(s.end) - mins(s.start)) / 60
