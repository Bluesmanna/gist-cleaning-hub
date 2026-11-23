// What the assistant is allowed to know about the person asking. Built per role, so an
// employee's assistant sees their own shifts and pay, a client's sees their own visits
// and invoices, and the owner's sees the business. Nothing else is sent to any model.
import type { State, User } from '../types'
import { addDays, fmtDay, fmtTime, money, today } from '../dates'
import { computeStub, hoursFor, periodFor, ptoBalance } from '../payroll'

export function buildContext(s: State, me: User | null): string {
  const t = today()
  const p = periodFor(t)
  const L: string[] = [`Today is ${fmtDay(t, { weekday: true, year: true })}. Current pay period ${p.label}; hours due ${fmtDay(p.end)}; payday ${fmtDay(p.payDate, { weekday: true })}.`]
  const client = (id?: string) => s.clients.find((c) => c.id === id)
  if (!me) {
    L.push('The person is a public website visitor (not signed in). Help them understand services, pricing and booking; send them to "Book a cleaning".')
    return L.join('\n')
  }
  L.push(`Signed in as ${me.name} — role: ${me.role}, ${me.title}.`)
  if (me.role === 'employee') {
    const h = hoursFor(s, me.id, p)
    const est = computeStub(s, me, p, 'preview', false)
    const pto = ptoBalance(s, me)
    L.push(`Pay: $${me.payRate}/hr, ${me.employmentType}, paid by ${me.payMethod === 'check' ? 'check' : 'direct deposit'}. This period so far: ${h.total} hrs (${h.overtime} OT), ${h.pending} hrs not yet approved; estimated gross ${money(est.gross)}, net ≈ ${money(est.net)}. PTO balance ${pto.balance} hrs (+${pto.pendingAccrual} accruing this period).`)
    const open = s.time.find((x) => x.employeeId === me.id && !x.clockOut)
    if (open) L.push(`Currently CLOCKED IN since ${fmtTime(open.clockIn)} at ${client(open.clientId)?.household || 'a job'}.`)
    const next = s.shifts.filter((x) => x.employeeId === me.id && x.published && x.date >= t).slice(0, 8)
    L.push('Upcoming shifts:\n' + (next.map((x) => `- ${fmtDay(x.date, { weekday: true })} ${fmtTime(x.start)}–${fmtTime(x.end)}: ${client(x.clientId)?.household} (${client(x.clientId)?.address}); SOP doc: ${client(x.clientId)?.sopSlug}${x.note ? `; note: ${x.note}` : ''}`).join('\n') || '- none'))
    const openShifts = s.shifts.filter((x) => !x.employeeId && x.published && x.date >= t)
    if (openShifts.length) L.push(`Open shifts anyone can claim: ${openShifts.map((x) => `${fmtDay(x.date)} ${fmtTime(x.start)} ${client(x.clientId)?.household}`).join('; ')}`)
    const last = s.stubs.filter((x) => x.employeeId === me.id).sort((a, b) => b.payDate.localeCompare(a.payDate))[0]
    if (last) L.push(`Last paystub (${fmtDay(last.periodStart)}–${fmtDay(last.periodEnd)}, paid ${fmtDay(last.payDate)}): ${last.regularHours} reg + ${last.overtimeHours} OT hrs @ $${last.rate}, PTO ${last.ptoHours} hrs, tips ${money(last.tips)}, gross ${money(last.gross)}, federal ${money(last.taxes.federal)}, SS ${money(last.taxes.socialSecurity)}, Medicare ${money(last.taxes.medicare)}, Idaho ${money(last.taxes.state)}, reimbursements ${money(last.reimbursements.reduce((a, r) => a + r.amount, 0))}, net ${money(last.net)}; cards loaded supply ${money(last.cards.supply)}, gas ${money(last.cards.gas)}; PTO accrued ${last.ptoAccrued} hrs.`)
    const tasks = s.tasks.filter((x) => x.userId === me.id && !x.done)
    if (tasks.length) L.push('Open tasks: ' + tasks.map((x) => `${x.title} (due ${fmtDay(x.due)})`).join('; '))
    const ob = me.onboarding
    if (ob && Object.values(ob).some((v) => !v)) L.push('Onboarding still to do: ' + Object.entries(ob).filter(([, v]) => !v).map(([k]) => k).join(', '))
  }
  if (me.role === 'owner' || me.role === 'manager') {
    const emps = s.users.filter((u) => u.role === 'employee')
    const todays = s.shifts.filter((x) => x.date === t)
    L.push(`Team: ${emps.map((u) => `${u.name} (${u.title}, $${u.payRate}/hr, ${hoursFor(s, u.id, p).total} hrs this period)`).join('; ')}.`)
    L.push(`Clients: ${s.clients.filter((c) => c.active).length} active households.`)
    L.push(`Today's jobs: ${todays.map((x) => `${fmtTime(x.start)} ${client(x.clientId)?.household} — ${s.users.find((u) => u.id === x.employeeId)?.name || 'OPEN'}`).join('; ') || 'none'}.`)
    L.push(`Waiting on you: ${s.time.filter((x) => x.status === 'submitted').length} submitted time entries, ${s.timeOff.filter((x) => x.status === 'pending').length} time-off requests, ${s.expenses.filter((x) => x.status === 'pending').length} expenses, ${s.bookings.filter((b) => b.status === 'new').length} new booking requests.`)
    const unpaid = s.invoices.filter((i) => i.status === 'sent')
    L.push(`Unpaid invoices: ${unpaid.length} totalling ${money(unpaid.reduce((a, i) => a + i.total, 0))}. Paid last 30 days: ${money(s.invoices.filter((i) => i.status === 'paid' && i.date >= addDays(t, -30)).reduce((a, i) => a + i.total, 0))}.`)
    const nb = s.bookings.filter((b) => b.status === 'new')
    if (nb.length) L.push('New booking requests: ' + nb.map((b) => `${b.name} — ${b.service}, ${b.frequency}, ${b.homeSize}, wants ${b.preferredDate} ${b.preferredTime}; notes: ${b.notes}`).join(' | '))
  }
  if (me.role === 'client') {
    const c = client(me.clientId)
    if (c) {
      L.push(`Client household: ${c.household}, ${c.address}. Service: ${c.service}, ${c.frequency}, about ${c.durationHours} hrs per visit at $37/hr. Add-ons: ${c.addOns.join(', ') || 'none'}.`)
      const up = s.shifts.filter((x) => x.clientId === c.id && x.date >= t && x.published).slice(0, 4)
      L.push('Upcoming visits: ' + (up.map((x) => `${fmtDay(x.date, { weekday: true })} ${fmtTime(x.start)}–${fmtTime(x.end)}`).join('; ') || 'none scheduled'))
      const inv = s.invoices.filter((i) => i.clientId === c.id && i.status === 'sent')
      L.push(`Unpaid invoices: ${inv.map((i) => `#${i.number} ${money(i.total)} due ${fmtDay(i.due)}`).join('; ') || 'none'}.`)
    }
  }
  return L.join('\n')
}
