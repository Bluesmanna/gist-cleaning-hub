// Pay rules researched from GIST's Gusto account, handbook and employment agreements:
// - Hourly, $18/hr for Residential Cleaning Techs
// - Semi-monthly pay periods: 1st–15th and 16th–end of month
// - Payday ~5 days after the period closes (Nov 1–15 was paid Fri Nov 20); weekend paydays move to the Friday before
// - Overtime at 1.5x for hours over 40 in a Sun–Sat workweek (FLSA; Idaho follows federal)
// - Only on-site (geofenced) hours count; travel between homes is not paid time
// - PTO accrues 1 hour per 25 hours worked
// - Supply card $75 / gas card $50 per pay period; half for substitutes under 20 hrs in the period
// - Full tips, mileage + laundry reimbursements pass through untaxed
// Tax withholding below is an ESTIMATE (2026 federal percentage method + Idaho flat rate)
// so paystubs look realistic. Real payroll would stay in Gusto (or a payroll API).

import type { Expense, Paystub, State, TimeEntry, User } from './types'
import { addDays, daysInMonth, hoursBetween, parseYmd, startOfWeek, ymd } from './dates'

export const POLICY = {
  defaultRate: 18,
  overtimeAfterWeeklyHours: 40,
  overtimeMultiplier: 1.5,
  ptoHoursPer: 25,
  supplyCard: 75,
  gasCard: 50,
  substituteHalfUnderHours: 20,
  mileageRate: 0.725, // 2026 IRS business rate (approx.)
  payDelayDays: 5,
  socialSecurity: 0.062,
  medicare: 0.0145,
  idahoRate: 0.053,
}

export interface Period {
  start: string
  end: string
  payDate: string
  label: string
}

export function periodFor(day: string): Period {
  const d = parseYmd(day)
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = d.getDate() <= 15
  const start = ymd(new Date(y, m, first ? 1 : 16))
  const end = ymd(new Date(y, m, first ? 15 : daysInMonth(y, m)))
  return { start, end, payDate: payDateFor(end), label: periodLabel(start, end) }
}

export function payDateFor(periodEnd: string): string {
  let p = addDays(periodEnd, POLICY.payDelayDays)
  const wd = parseYmd(p).getDay()
  if (wd === 6) p = addDays(p, -1)
  if (wd === 0) p = addDays(p, -2)
  return p
}

export function prevPeriod(p: Period): Period {
  return periodFor(addDays(p.start, -1))
}
export function nextPeriod(p: Period): Period {
  return periodFor(addDays(p.end, 1))
}

function periodLabel(start: string, end: string) {
  const a = parseYmd(start)
  const b = parseYmd(end)
  const mo = a.toLocaleString('en-US', { month: 'short' })
  return `${mo} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`
}

export const entryDay = (t: TimeEntry) => ymd(new Date(t.clockIn))

export function entryHours(t: TimeEntry): number {
  if (!t.clockOut) return 0
  return Math.max(0, hoursBetween(t.clockIn, t.clockOut) - t.breakMinutes / 60)
}

export interface HoursBreakdown {
  regular: number
  overtime: number
  total: number
  byDay: Record<string, number>
  pending: number
}

/** Regular/OT hours for one employee inside a pay period, with OT computed per Sun–Sat workweek. */
export function hoursFor(state: State, employeeId: string, p: Period, opts: { approvedOnly?: boolean } = {}): HoursBreakdown {
  const entries = state.time
    .filter((t) => t.employeeId === employeeId && t.clockOut && t.onSite && t.status !== 'rejected')
    .filter((t) => !opts.approvedOnly || t.status === 'approved')
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn))
  const weekTotals: Record<string, number> = {}
  let regular = 0
  let overtime = 0
  let pending = 0
  const byDay: Record<string, number> = {}
  for (const t of entries) {
    const day = entryDay(t)
    const wk = startOfWeek(day)
    const h = entryHours(t)
    const before = weekTotals[wk] || 0
    weekTotals[wk] = before + h
    if (day < p.start || day > p.end) continue
    const room = Math.max(0, POLICY.overtimeAfterWeeklyHours - before)
    const reg = Math.min(h, room)
    regular += reg
    overtime += h - reg
    byDay[day] = (byDay[day] || 0) + h
    if (t.status !== 'approved') pending += h
  }
  return { regular: r2(regular), overtime: r2(overtime), total: r2(regular + overtime), byDay, pending: r2(pending) }
}

export const r2 = (n: number) => Math.round(n * 100) / 100

// --- tax estimate (2026, simplified percentage method, semi-monthly = 24 periods) ---
const BRACKETS_SINGLE: [number, number][] = [
  [12400, 0.1],
  [50400, 0.12],
  [105700, 0.22],
  [201775, 0.24],
  [256225, 0.32],
  [640600, 0.35],
  [Infinity, 0.37],
]
const STD = { single: 16100, married: 32200, head: 24150 }

export function federalWithholding(gross: number, u: User): number {
  const w4 = u.w4 || { filingStatus: 'single', multipleJobs: false, dependentsAmount: 0, otherIncome: 0, deductions: 0, extraWithholding: 0 }
  const periods = 24
  let annual = gross * periods + w4.otherIncome - w4.deductions
  const std = STD[w4.filingStatus] * (w4.multipleJobs ? 0.5 : 1)
  annual -= std
  if (annual <= 0) return r2(w4.extraWithholding)
  const mult = w4.filingStatus === 'married' ? 2 : w4.filingStatus === 'head' ? 1.5 : 1
  let tax = 0
  let prev = 0
  for (const [cap, rate] of BRACKETS_SINGLE) {
    const top = cap * mult
    if (annual > prev) tax += (Math.min(annual, top) - prev) * rate
    prev = top
  }
  tax = Math.max(0, tax - w4.dependentsAmount)
  return r2(tax / periods + w4.extraWithholding)
}

export function cardAmounts(u: User, totalHours: number) {
  const half = u.employmentType === 'substitute' && totalHours < POLICY.substituteHalfUnderHours
  if (totalHours <= 0) return { supply: 0, gas: 0 }
  return { supply: half ? POLICY.supplyCard / 2 : POLICY.supplyCard, gas: half ? POLICY.gasCard / 2 : POLICY.gasCard }
}

export function ptoUsedHours(state: State, employeeId: string, p: Period): number {
  return state.timeOff
    .filter((o) => o.employeeId === employeeId && o.type === 'pto' && o.status === 'approved' && o.start >= p.start && o.start <= p.end)
    .reduce((s, o) => s + o.hours, 0)
}

export function ptoBalance(state: State, u: User): { balance: number; accrued: number; used: number; pendingAccrual: number } {
  const accrued = state.stubs.filter((s) => s.employeeId === u.id).reduce((s, x) => s + x.ptoAccrued, 0)
  const used = state.timeOff.filter((o) => o.employeeId === u.id && o.type === 'pto' && o.status === 'approved').reduce((s, o) => s + o.hours, 0)
  const cur = periodFor(ymd(new Date()))
  const pendingAccrual = hoursFor(state, u.id, cur).total / POLICY.ptoHoursPer
  return { balance: r2((u.ptoStartBalance || 0) + accrued - used), accrued: r2(accrued), used: r2(used), pendingAccrual: r2(pendingAccrual) }
}

export function reimbursableExpenses(state: State, employeeId: string): Expense[] {
  return state.expenses.filter((e) => e.employeeId === employeeId && e.status === 'approved' && !e.payrollId)
}

export function tipsFor(state: State, employeeId: string, p: Period): number {
  // tips recorded as 'other' expenses with description starting "Tip" are paid out in full
  return state.expenses
    .filter((e) => e.employeeId === employeeId && e.category === 'other' && /^tip/i.test(e.description) && e.date >= p.start && e.date <= p.end && e.status !== 'rejected')
    .reduce((s, e) => s + e.amount, 0)
}

/** Build (not save) a paystub for one employee for a period. */
export function computeStub(state: State, u: User, p: Period, payrollId: string, approvedOnly = true): Paystub {
  const rate = u.payRate || POLICY.defaultRate
  const h = hoursFor(state, u.id, p, { approvedOnly })
  const ptoHours = ptoUsedHours(state, u.id, p)
  const regularPay = r2(h.regular * rate)
  const overtimePay = r2(h.overtime * rate * POLICY.overtimeMultiplier)
  const ptoPay = r2(ptoHours * rate)
  const tips = r2(tipsFor(state, u.id, p))
  const gross = r2(regularPay + overtimePay + ptoPay + tips)
  const taxes = {
    federal: federalWithholding(gross, u),
    socialSecurity: r2(gross * POLICY.socialSecurity),
    medicare: r2(gross * POLICY.medicare),
    state: r2(Math.max(0, (gross * 24 - 5000) * POLICY.idahoRate) / 24),
  }
  const reimb = reimbursableExpenses(state, u.id).filter((e) => !/^tip/i.test(e.description))
  const reimbursements = reimb.map((e) => ({ label: `${e.category === 'mileage' ? `Mileage (${e.miles} mi)` : e.category[0].toUpperCase() + e.category.slice(1)}: ${e.description}`, amount: e.amount }))
  const taxTotal = taxes.federal + taxes.socialSecurity + taxes.medicare + taxes.state
  const net = r2(gross - taxTotal + reimbursements.reduce((s, r) => s + r.amount, 0))
  return {
    id: `stub_${payrollId}_${u.id}`,
    payrollId,
    employeeId: u.id,
    periodStart: p.start,
    periodEnd: p.end,
    payDate: p.payDate,
    rate,
    regularHours: h.regular,
    overtimeHours: h.overtime,
    ptoHours,
    regularPay,
    overtimePay,
    ptoPay,
    tips,
    gross,
    taxes,
    reimbursements,
    cards: cardAmounts(u, h.total),
    net,
    ptoAccrued: r2(h.total / POLICY.ptoHoursPer),
    method: u.payMethod || 'direct_deposit',
  }
}

export const taxTotal = (s: Paystub) => r2(s.taxes.federal + s.taxes.socialSecurity + s.taxes.medicare + s.taxes.state)

/** Deadline rule from the handbook: hours must be entered by the last day of the pay period. */
export function timesheetDeadline(p: Period) {
  return p.end
}
