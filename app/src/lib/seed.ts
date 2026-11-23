// Demo data, generated relative to today so the prototype always looks "live":
// ~12 weeks of history (shifts, clock-ins, processed payrolls, paystubs, expenses,
// cards, invoices) plus two weeks of upcoming schedule. Clients come from the
// (pseudonymized) client SOPs, so every client links to its real procedures.
// A seeded PRNG keeps it stable between resets.
import { DOCS, field, parseHours } from './docs'
import type { Client, Expense, Invoice, Shift, State, TimeEntry, User } from './types'
import { addDays, isoAt, parseYmd, shiftHours, today, ymd } from './dates'
import { POLICY, computeStub, periodFor, prevPeriod, r2 } from './payroll'

export const STATE_VERSION = 3

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MOSCOW = { lat: 46.7324, lng: -117.0002 }

const fullOnboarding = { profile: true, w4: true, i9: true, directDeposit: true, handbookSigned: true, agreementSigned: true }

export function makeUsers(t: string): User[] {
  return [
    { id: 'u_owner', name: 'Dustin Sipes', role: 'owner', title: 'Owner / Manager', email: 'owner@gist.demo', phone: '208-555-0100', color: '#4D7393' },
    {
      id: 'u_jamie', name: 'Jamie Rivera', role: 'employee', title: 'Residential Cleaning Tech', email: 'jamie@gist.demo', phone: '208-555-0141', color: '#8FA46A',
      employmentType: 'regular', payRate: 18, startDate: '2026-01-12', department: 'Residential', managerId: 'u_owner', payMethod: 'direct_deposit', bankLast4: '4821', ptoStartBalance: 0,
      onboarding: fullOnboarding, w4: { filingStatus: 'single', multipleJobs: false, dependentsAmount: 0, otherIncome: 0, deductions: 0, extraWithholding: 0 },
    },
    {
      id: 'u_sam', name: 'Sam Okafor', role: 'employee', title: 'Substitute Residential Cleaning Tech', email: 'sam@gist.demo', phone: '208-555-0152', color: '#89C2F0',
      employmentType: 'substitute', payRate: 18, startDate: '2026-06-15', department: 'Residential', managerId: 'u_owner', payMethod: 'check', ptoStartBalance: 0,
      onboarding: fullOnboarding, w4: { filingStatus: 'head', multipleJobs: true, dependentsAmount: 2200, otherIncome: 0, deductions: 0, extraWithholding: 10 },
    },
    {
      id: 'u_taylor', name: 'Taylor Brooks', role: 'employee', title: 'Residential Cleaning Tech (new hire)', email: 'taylor@gist.demo', phone: '208-555-0163', color: '#d99a4e',
      employmentType: 'regular', payRate: 18, startDate: addDays(t, 7), department: 'Residential', managerId: 'u_owner', ptoStartBalance: 0,
      onboarding: { profile: true, w4: false, i9: false, directDeposit: false, handbookSigned: false, agreementSigned: false },
    },
  ]
}

const FREQ = (s: string): Client['frequency'] => (/bi-?weekly/i.test(s) ? 'biweekly' : /weekly/i.test(s) ? 'weekly' : /month/i.test(s) ? 'monthly' : 'as-needed')

export function makeClients(r: () => number): Client[] {
  const docs = DOCS.filter((d) => d.category === 'Client SOPs' || d.category === 'Project Task Lists')
  return docs.map((d, i) => {
    const project = d.category === 'Project Task Lists'
    const household = d.title.replace(/^.*?—\s*/, '')
    const name = field(d.md, 'Name') || household.replace(' Household', '')
    const freqText = field(d.md, 'Frequency')
    const dur = field(d.md, 'Expected/Average Duration') || field(d.md, 'Estimated Duration + Schedule')
    const pets = (d.md.split(/### Pets/)[1] || '').split(/\n###/)[0].replace(/[*#]/g, '').trim().split('\n')[0] || 'None'
    const notes = field(d.md, 'Notes')
    const ang = r() * Math.PI * 2
    const dist = 0.004 + r() * 0.03
    const addOns: Client['addOns'] = []
    if (/tidy/i.test(d.md)) addOns.push('tidying')
    if (/laundry|dishes/i.test(d.md)) addOns.push('washing')
    return {
      id: `c_${d.slug.replace(/^(sop-client-|project-)/, '')}`,
      household,
      contactName: name,
      phone: field(d.md, 'Contact').replace(/[^\d-]/g, '') || `208-555-01${String(i).padStart(2, '0')}`,
      email: `${household.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '')}@client.demo`,
      address: field(d.md, 'Address').replace(/\s*\(demo address\)/, ''),
      lat: r2((MOSCOW.lat + Math.sin(ang) * dist) * 1e5) / 1e5,
      lng: r2((MOSCOW.lng + Math.cos(ang) * dist * 1.4) * 1e5) / 1e5,
      frequency: project ? 'project' : FREQ(freqText),
      durationHours: Math.min(5, project ? 5 : parseHours(dur || '2.5')),
      sopSlug: d.slug,
      service: project ? 'rescue' : 'basic',
      addOns,
      notes,
      pets: pets.length > 140 ? pets.slice(0, 137) + '…' : pets,
      since: ymd(new Date(2023 + Math.floor(r() * 3), Math.floor(r() * 12), 1 + Math.floor(r() * 27))),
      photos: [],
      active: true,
    }
  })
}

const START_SLOTS = ['09:00', '12:30']

function fmtEnd(start: string, hours: number) {
  const [h, m] = start.split(':').map(Number)
  const mins = h * 60 + m + Math.round(hours * 4) * 15
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
}

/** Recurring weekly/biweekly/monthly slots per cleaner, without double-booking. */
function plan(clients: Client[]) {
  const cleaners = ['u_jamie', 'u_jamie', 'u_sam', 'u_owner', 'u_jamie', 'u_owner', 'u_sam', 'u_owner']
  const used: Record<string, boolean> = {}
  const out: { clientId: string; employeeId: string; weekday: number; start: string; weeks: number; phase: number }[] = []
  clients.forEach((c, i) => {
    if (c.frequency === 'project' || c.frequency === 'as-needed') return
    const weeks = c.frequency === 'weekly' ? 1 : c.frequency === 'biweekly' ? 2 : 4
    for (let tryN = 0; tryN < cleaners.length; tryN++) {
      const emp = cleaners[(i + tryN) % cleaners.length]
      for (let k = 0; k < 10; k++) {
        const weekday = 1 + ((i + k) % 5)
        const start = START_SLOTS[Math.floor((i + k) / 5) % 2]
        for (let phase = 0; phase < weeks; phase++) {
          const keys = [0, 1, 2, 3].filter((w) => w % weeks === phase).map((w) => `${emp}|${weekday}|${start}|${w}`)
          if (keys.every((x) => !used[x])) {
            keys.forEach((x) => (used[x] = true))
            out.push({ clientId: c.id, employeeId: emp, weekday, start, weeks, phase })
            return
          }
        }
      }
    }
  })
  return out
}

export function seed(): State {
  const r = rng(20261123)
  const t = today()
  const users = makeUsers(t)
  const clients = makeClients(r)
  clients.forEach((c) => {
    if (c.frequency === 'project') c.notes = `${c.notes} (Deep-clean project — see the task list.)`.trim()
  })
  const slots = plan(clients)
  slots.forEach((s) => {
    const c = clients.find((x) => x.id === s.clientId)!
    c.preferredEmployeeId = s.employeeId
  })

  // --- shifts: 12 weeks back, 2 weeks ahead (week index anchored to a fixed epoch so biweekly stays stable) ---
  const from = addDays(t, -84)
  const to = addDays(t, 14)
  const shifts: Shift[] = []
  const epoch = parseYmd('2026-01-04').getTime()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = parseYmd(d).getDay()
    const wk = Math.floor((parseYmd(d).getTime() - epoch) / (7 * 864e5))
    for (const s of slots) {
      if (s.weekday !== wd || (wk % s.weeks + s.weeks) % s.weeks !== s.phase) continue
      const c = clients.find((x) => x.id === s.clientId)!
      const start = /11:45/.test(c.notes) ? '12:00' : s.start
      shifts.push({
        id: `sh_${d}_${c.id}`, employeeId: s.employeeId, clientId: c.id, date: d, start, end: fmtEnd(start, c.durationHours),
        jobTitle: 'Residential Cleaning Tech', note: '', published: d <= addDays(t, 7),
      })
    }
  }
  // project deep-clean for the Thimbleberry household next week (two 5-hour shifts), plus an open shift
  const proj = clients.find((c) => c.frequency === 'project')
  if (proj) {
    const mon = addDays(t, 8 - parseYmd(t).getDay())
    shifts.push({ id: `sh_proj1`, employeeId: 'u_jamie', clientId: proj.id, date: mon, start: '08:00', end: '13:00', jobTitle: 'Project RCT', note: 'Deep-clean project day 1 of 2 — follow the project task list.', published: true })
    shifts.push({ id: `sh_proj2`, employeeId: 'u_sam', clientId: proj.id, date: addDays(mon, 1), start: '08:00', end: '13:00', jobTitle: 'Project RCT', note: 'Deep-clean project day 2 of 2.', published: true })
  }
  const asNeeded = clients.find((c) => c.frequency === 'as-needed')
  if (asNeeded) shifts.push({ id: 'sh_open1', employeeId: null, clientId: asNeeded.id, date: addDays(t, 4), start: '13:00', end: fmtEnd('13:00', asNeeded.durationHours), jobTitle: 'Residential Cleaning Tech', note: 'Open shift — claim it if you can cover.', published: true })
  shifts.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))

  // --- time entries for past shifts of hourly employees ---
  const time: TimeEntry[] = []
  const curP = periodFor(t)
  for (const s of shifts) {
    if (!s.employeeId || s.employeeId === 'u_owner' || s.date >= t) continue
    const jIn = Math.round((r() - 0.5) * 10)
    const jOut = Math.round((r() - 0.3) * 14)
    const inD = new Date(isoAt(s.date, s.start))
    inD.setMinutes(inD.getMinutes() + jIn)
    const outD = new Date(isoAt(s.date, s.end))
    outD.setMinutes(outD.getMinutes() + jOut)
    const inCurrent = s.date >= curP.start
    time.push({
      id: `te_${s.id}`, employeeId: s.employeeId, shiftId: s.id, clientId: s.clientId,
      clockIn: inD.toISOString(), clockOut: outD.toISOString(), breakMinutes: 0, source: 'clock', onSite: true, distanceM: Math.round(8 + r() * 60),
      status: inCurrent ? (s.employeeId === 'u_sam' ? 'submitted' : 'open') : 'approved', note: '', history: [],
    })
  }
  // a forgotten clock-out that was fixed with a note (the Gusto "change clock-out to scheduled?" flow)
  const fix = [...time].reverse().find((x) => x.employeeId === 'u_jamie' && x.status === 'open')
  if (fix && fix.shiftId) {
    const s = shifts.find((x) => x.id === fix.shiftId)!
    fix.clockOut = isoAt(s.date, s.end)
    fix.history.push({ at: new Date(new Date(fix.clockIn).getTime() + 9 * 3600e3).toISOString(), byId: 'u_jamie', change: 'Clock-out changed from 8:41pm to scheduled end ' + s.end, note: 'Forgot to clock out before driving home — changed to my scheduled end time.' })
  }

  const state: State = {
    version: STATE_VERSION, seededAt: new Date().toISOString(), currentUserId: null,
    users, clients, shifts, time,
    availability: [
      { employeeId: 'u_jamie', weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, kind: day === 0 || day === 6 ? 'none' : 'all' })), notes: 'Kids’ pickup at 3:30 on Wednesdays — I can do mornings that day.', updatedAt: addDays(t, -20) },
      { employeeId: 'u_sam', weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => (day === 2 || day === 4 ? { day, kind: 'custom', from: '09:00', to: '15:00' } : { day, kind: day === 0 ? 'none' : 'all' })), notes: 'Class Tue/Thu evenings.', updatedAt: addDays(t, -40) },
      { employeeId: 'u_taylor', weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, kind: day === 0 ? 'none' : 'all' })), notes: '', updatedAt: addDays(t, -2) },
    ],
    timeOff: [
      { id: 'to1', employeeId: 'u_jamie', start: addDays(t, -40), end: addDays(t, -40), hours: 3, type: 'pto', reason: 'Dentist', status: 'approved', createdAt: addDays(t, -50) },
      { id: 'to2', employeeId: 'u_jamie', start: addDays(t, 24), end: addDays(t, 25), hours: 6, type: 'pto', reason: 'Family visit for the holidays', status: 'pending', createdAt: addDays(t, -1) },
      { id: 'to3', employeeId: 'u_sam', start: addDays(t, 10), end: addDays(t, 10), hours: 0, type: 'unpaid', reason: 'Exam day', status: 'approved', createdAt: addDays(t, -6) },
    ],
    payrolls: [], stubs: [], expenses: [], cardTxns: [], tasks: [], notices: [], bookings: [], invoices: [], messages: [], uploads: [], signatures: [],
    settings: { geofenceMeters: 150, simulateOnSite: true, aiProvider: 'offline', bridgeUrl: 'http://127.0.0.1:8787', bridgeToken: '', anthropicKey: '', anthropicModel: 'claude-sonnet-5-5' },
  }

  // --- expenses + processed payrolls, oldest first, so reimbursements land on the right stub ---
  const periods = []
  for (let p = prevPeriod(curP); p.end >= from; p = prevPeriod(p)) periods.unshift(p)
  const emps = users.filter((u) => u.role === 'employee' && u.startDate! <= t)
  const allExp: Expense[] = []
  for (const p of [...periods, curP]) {
    for (const u of emps) {
      const days = [...new Set(time.filter((x) => x.employeeId === u.id && x.clockIn.slice(0, 10) >= p.start && x.clockIn.slice(0, 10) <= p.end).map((x) => x.clockIn.slice(0, 10)))]
      if (!days.length) continue
      const miles = Math.round(days.length * (6 + r() * 6))
      const cur = p.start === curP.start
      allExp.push({ id: `ex_m_${p.start}_${u.id}`, employeeId: u.id, date: days[days.length - 1], category: 'mileage', miles, amount: r2(miles * POLICY.mileageRate), description: `Between-client driving, ${p.label}`, status: cur ? 'pending' : 'approved' })
      if (u.employmentType === 'regular') allExp.push({ id: `ex_l_${p.start}_${u.id}`, employeeId: u.id, date: days[0], category: 'laundry', amount: 6.5, description: 'Laundromat — rags & mop heads', status: cur ? 'pending' : 'approved' })
      if (r() > 0.4) {
        const tipDay = days[Math.floor(r() * days.length)]
        const c = clients.find((x) => x.id === time.find((e) => e.employeeId === u.id && e.clockIn.startsWith(tipDay))?.clientId)
        allExp.push({ id: `ex_t_${p.start}_${u.id}`, employeeId: u.id, date: tipDay, category: 'other', amount: [10, 15, 20, 25][Math.floor(r() * 4)], description: `Tip — ${c?.household || 'client'} (Venmo)`, status: cur ? 'pending' : 'approved' })
      }
    }
  }
  for (const p of periods) {
    const prId = `pr_${p.start}`
    state.expenses.push(...allExp.filter((e) => e.date >= p.start && e.date <= p.end))
    const stubs = emps.map((u) => computeStub(state, u, p, prId)).filter((s) => s.gross > 0 || s.reimbursements.length)
    state.stubs.push(...stubs)
    state.payrolls.push({ id: prId, periodStart: p.start, periodEnd: p.end, payDate: p.payDate, status: 'processed', processedAt: isoAt(addDays(p.payDate, -2), '10:15'), stubIds: stubs.map((s) => s.id) })
    for (const e of state.expenses) if (e.status === 'approved' && !e.payrollId && !/^tip/i.test(e.description)) { e.payrollId = prId; e.status = 'paid' }
    for (const e of state.expenses) if (/^tip/i.test(e.description) && e.date <= p.end && e.status === 'approved') { e.payrollId = prId; e.status = 'paid' }
    for (const s of stubs) {
      if (s.cards.supply) state.cardTxns.push({ id: `ct_s_${s.id}`, employeeId: s.employeeId, card: 'supply', date: p.payDate, amount: s.cards.supply, description: `Supply card load — ${p.label}` })
      if (s.cards.gas) state.cardTxns.push({ id: `ct_g_${s.id}`, employeeId: s.employeeId, card: 'gas', date: p.payDate, amount: s.cards.gas, description: `Gas card load — ${p.label}` })
      const spendDay = addDays(p.payDate, 2)
      if (spendDay < t) {
        state.cardTxns.push({ id: `ct_ss_${s.id}`, employeeId: s.employeeId, card: 'supply', date: spendDay, amount: -r2(30 + r() * 35), description: ['Rosauers — microfiber, Comet, Dawn', 'Walmart — Murphy’s Oil Soap, sponges', 'Tri-State — mop heads, gloves'][Math.floor(r() * 3)] })
        state.cardTxns.push({ id: `ct_gs_${s.id}`, employeeId: s.employeeId, card: 'gas', date: addDays(spendDay, 1), amount: -r2(28 + r() * 18), description: 'Fuel — Moscow' })
      }
    }
  }
  state.expenses.push(...allExp.filter((e) => e.date >= curP.start))

  // --- invoices: last ~4 weeks of client cleanings at $37/hr ---
  let num = 1001
  const invFrom = addDays(t, -28)
  const byClientWeek: Record<string, Shift[]> = {}
  for (const s of shifts) if (s.date >= invFrom && s.date < t) (byClientWeek[s.clientId] ||= []).push(s)
  const invoices: Invoice[] = []
  Object.entries(byClientWeek).forEach(([clientId, ss]) => {
    for (const s of ss) {
      const hours = r2(shiftHours(s))
      const old = s.date < addDays(t, -3)
      invoices.push({
        id: `inv_${num}`, number: num++, clientId, date: s.date, due: addDays(s.date, 1),
        lines: [{ description: `Residential cleaning — ${s.date}`, hours, rate: 37, amount: r2(hours * 37) }], total: r2(hours * 37),
        status: old && r() > 0.12 ? 'paid' : 'sent', method: old ? (['venmo', 'zelle', 'square'] as const)[Math.floor(r() * 3)] : undefined,
        paidAt: old ? isoAt(addDays(s.date, 1), '09:30') : undefined, shiftIds: [s.id],
      })
    }
  })
  invoices.sort((a, b) => a.number - b.number)
  invoices.forEach((inv) => { if (inv.status !== 'paid') { inv.method = undefined; inv.paidAt = undefined } })
  state.invoices = invoices

  // --- client logins (demo) ---
  const c1 = clients[0]
  const c2 = clients.find((c) => c.household.startsWith('Hawthorne')) || clients[1]
  users.push({ id: 'u_client1', name: c1.contactName, role: 'client', title: `${c1.household} (client)`, email: c1.email, phone: c1.phone, color: '#b87fa8', clientId: c1.id, active: true })
  users.push({ id: 'u_client2', name: c2.contactName, role: 'client', title: `${c2.household} (client)`, email: c2.email, phone: c2.phone, color: '#7f9fb8', clientId: c2.id, active: true })

  // --- docs signed during onboarding ---
  state.signatures.push(
    { docSlug: 'handbook-rct', userId: 'u_jamie', name: 'Jamie Rivera', at: isoAt('2026-01-08', '19:02') },
    { docSlug: 'agreement-rct', userId: 'u_jamie', name: 'Jamie Rivera', at: isoAt('2026-01-08', '19:10') },
    { docSlug: 'sop-general', userId: 'u_jamie', name: 'Jamie Rivera', at: isoAt('2026-01-09', '08:30') },
    { docSlug: 'handbook-subrct', userId: 'u_sam', name: 'Sam Okafor', at: isoAt('2026-06-11', '17:45') },
    { docSlug: 'agreement-subrct', userId: 'u_sam', name: 'Sam Okafor', at: isoAt('2026-06-11', '17:52') },
  )

  // --- tasks & notices ---
  state.tasks.push(
    { id: 'tk1', userId: 'u_jamie', title: `Submit your hours for ${curP.label}`, detail: 'Hours must be in by the last day of the pay period so payroll can run on time.', due: curP.end, done: false, link: '/app/time', kind: 'timesheet' },
    { id: 'tk2', userId: 'u_jamie', title: 'Update your availability for December', detail: 'Schedules are built a week ahead from your availability.', due: addDays(t, 5), done: false, link: '/app/availability', kind: 'availability' },
    { id: 'tk3', userId: 'u_jamie', title: 'Read the project task list before next Monday', detail: 'Deep-clean project — two 5-hour shifts.', due: addDays(t, 6), done: false, link: proj ? `/app/docs/${proj.sopSlug}` : '/app/docs', kind: 'document' },
    { id: 'tk4', userId: 'u_sam', title: `Hours for ${curP.label} submitted`, detail: 'Waiting on manager approval.', due: curP.end, done: true, link: '/app/time', kind: 'timesheet' },
    { id: 'tk5', userId: 'u_taylor', title: 'Fill out your W-4', detail: 'Federal tax withholding.', due: addDays(t, 5), done: false, link: '/app/onboarding', kind: 'onboarding' },
    { id: 'tk6', userId: 'u_taylor', title: 'Complete I-9 section 1 and show ID', detail: 'Bring your documents to your first shadowing day.', due: addDays(t, 7), done: false, link: '/app/onboarding', kind: 'onboarding' },
    { id: 'tk7', userId: 'u_taylor', title: 'Add direct deposit (or choose paper check)', detail: '', due: addDays(t, 6), done: false, link: '/app/onboarding', kind: 'onboarding' },
    { id: 'tk8', userId: 'u_taylor', title: 'Read & sign the Employee Handbook and Employment Agreement', detail: '', due: addDays(t, 6), done: false, link: '/app/onboarding', kind: 'onboarding' },
    { id: 'tk9', userId: 'u_owner', title: `Approve hours for ${curP.label}`, detail: 'Payroll for this period is due by ' + addDays(curP.end, 2), due: addDays(curP.end, 1), done: false, link: '/app/approvals', kind: 'timesheet' },
    { id: 'tk10', userId: 'u_owner', title: 'Publish next week’s schedule', detail: 'Draft shifts exist for the week after next.', due: addDays(t, 3), done: false, link: '/app/schedule', kind: 'general' },
  )
  state.notices.push(
    { id: 'n1', userId: 'u_jamie', text: `Your paystub for ${periods[periods.length - 1]?.label} is ready.`, at: isoAt(periods[periods.length - 1]?.payDate || t, '06:00'), read: false, link: '/app/pay' },
    { id: 'n2', userId: 'u_jamie', text: 'New shifts were published for next week.', at: isoAt(addDays(t, -2), '18:20'), read: false, link: '/app/schedule' },
    { id: 'n3', userId: 'u_owner', text: 'New booking request from the website.', at: isoAt(addDays(t, -1), '21:12'), read: false, link: '/app/bookings' },
    { id: 'n4', userId: 'u_owner', text: 'Jamie Rivera requested PTO.', at: isoAt(addDays(t, -1), '12:03'), read: false, link: '/app/approvals' },
    { id: 'n5', userId: 'u_sam', text: 'An open shift is available this week.', at: isoAt(addDays(t, -1), '09:00'), read: false, link: '/app/schedule' },
    { id: 'n6', userId: 'u_client1', text: 'Your invoice is ready — due within 24 hours.', at: isoAt(addDays(t, -2), '16:00'), read: false, link: '/app/invoices' },
  )

  // --- website booking requests ---
  state.bookings.push(
    { id: 'bk1', createdAt: isoAt(addDays(t, -1), '21:12'), name: 'Morgan Ellery', email: 'morgan@example.com', phone: '208-555-0190', address: '1210 Example Ave, Moscow, ID', service: 'basic', addOns: ['tidying'], frequency: 'biweekly', homeSize: '3 bed / 2 bath', preferredDate: addDays(t, 9), preferredTime: 'Morning', notes: 'Two cats. Would love Friday mornings if possible.', status: 'new' },
    { id: 'bk2', createdAt: isoAt(addDays(t, -3), '10:40'), name: 'Riley Chen', email: 'riley@example.com', phone: '208-555-0191', address: '88 Sample St, Pullman, WA', service: 'white-glove', addOns: [], frequency: 'one-time', homeSize: '2 bed apartment', preferredDate: addDays(t, 12), preferredTime: 'Any', notes: 'Move-out clean, landlord inspection on the 15th.', status: 'contacted' },
    { id: 'bk3', createdAt: isoAt(addDays(t, -6), '14:05'), name: 'Palouse Print Shop (demo)', email: 'shop@example.com', phone: '208-555-0192', address: '5 Main St, Moscow, ID', service: 'commercial', addOns: [], frequency: 'weekly', homeSize: '1,200 sq ft storefront', preferredDate: addDays(t, 14), preferredTime: 'After 6pm', notes: 'Also interested in GIST for Business — our back office files are a disaster.', status: 'new' },
  )

  // --- messages ---
  state.messages.push(
    { id: 'm1', threadId: c1.id, fromId: 'u_client1', text: 'Hi! Could you do the inside of the fridge this week? It’s getting rough.', at: isoAt(addDays(t, -2), '08:12') },
    { id: 'm2', threadId: c1.id, fromId: 'u_owner', text: 'Absolutely — I’ll add it to the checklist for this visit. It may add ~20 minutes.', at: isoAt(addDays(t, -2), '09:03') },
    { id: 'm3', threadId: 'u_jamie', fromId: 'u_owner', text: 'Thanks for covering Thursday! Reminder: project deep clean next Monday, read the task list first.', at: isoAt(addDays(t, -1), '17:30') },
    { id: 'm4', threadId: 'u_jamie', fromId: 'u_jamie', text: 'Will do. Should I bring the oven cleaner or is the client providing it?', at: isoAt(addDays(t, -1), '17:41') },
    { id: 'm5', threadId: 'u_jamie', fromId: 'u_owner', text: 'Client is providing it — coordinate with them before using it (fumes).', at: isoAt(addDays(t, -1), '17:55') },
  )
  return state
}
