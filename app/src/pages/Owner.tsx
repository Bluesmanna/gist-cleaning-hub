// Owner / manager side: the Gusto admin screens Dustin uses (schedule builder, approvals,
// payroll, team) plus the business side Gusto doesn't do (clients, bookings, invoices).
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, Check, ChevronLeft, Copy, Download, Eye, ImagePlus, Plus, Send, Trash2, Upload, UserPlus, X } from 'lucide-react'
import { useStore, clientOf, userName } from '../lib/store'
import type { Booking, Client, Invoice, Paystub, Payroll, Shift, State, User } from '../lib/types'
import { addDays, fmtDateTime, fmtDay, fmtTime, hrs, money, parseYmd, relTime, shiftHours, startOfWeek, today, uid } from '../lib/dates'
import { POLICY, computeStub, entryDay, entryHours, hoursFor, periodFor, prevPeriod, r2, type Period } from '../lib/payroll'
import { DOCS } from '../lib/docs'
import { bridgeHealth } from '../lib/ai/bridge'
import { saveText } from '../lib/download'
import { ADDONS, SERVICES } from '../data/site'
import { estimate } from './Public'
import { AiButton } from '../components/AiChat'
import { Avatar, Badge, Card, DateBox, Empty, Field, Lightbox, Modal, Progress, Stat, Tabs } from '../components/ui'
import { PayPage, PeriodNav, ShiftRow, StubView, TimePage, WeekGrid, WeekNav } from './Employee'
import { fileToDataUrl } from '../lib/download'

const employees = (s: State) => s.users.filter((u) => u.role === 'employee' && u.active !== false)
const svcRate = (c?: Client) => SERVICES.find((x) => x.key === c?.service)?.rate || 37

/* ---------------- dashboard ---------------- */
export function OwnerDashboard() {
  const { state } = useStore()
  const t = today()
  const todays = state.shifts.filter((s) => s.date === t).sort((a, b) => a.start.localeCompare(b.start))
  const onClock = state.time.filter((x) => !x.clockOut)
  const pendTime = state.time.filter((x) => x.status === 'submitted').length
  const pendPto = state.timeOff.filter((x) => x.status === 'pending').length
  const pendExp = state.expenses.filter((x) => x.status === 'pending').length
  const unpaid = state.invoices.filter((i) => i.status === 'sent')
  const newBk = state.bookings.filter((b) => b.status === 'new')
  const p = periodFor(t)
  const labor = employees(state).reduce((n, u) => n + computeStub(state, u, p, 'preview', false).gross, 0)
  const monthRev = state.invoices.filter((i) => i.date.slice(0, 7) === t.slice(0, 7) && i.status !== 'void').reduce((n, i) => n + i.total, 0)
  const openShifts = state.shifts.filter((s) => !s.employeeId && s.date >= t)
  const tasks = state.tasks.filter((x) => x.userId === 'u_owner' && !x.done)
  return (
    <div className="stack">
      <div className="grid g4">
        <Stat label="Cleanings today" value={todays.length} sub={`${onClock.length} on the clock now`} />
        <Stat label="Needs approval" value={pendTime + pendPto + pendExp} sub={<Link to="/app/approvals">{pendTime} time · {pendPto} PTO · {pendExp} expenses</Link>} />
        <Stat label="Unpaid invoices" value={money(unpaid.reduce((n, i) => n + i.total, 0))} sub={<Link to="/app/invoices">{unpaid.length} open</Link>} />
        <Stat label="This month billed" value={money(monthRev)} sub={`Labor this period ≈ ${money(labor)}`} />
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Today" action={<Link className="small" to="/app/schedule">Schedule</Link>}>
          {todays.length ? (
            <div className="list">
              {todays.map((s) => {
                const e = state.time.find((x) => x.shiftId === s.id)
                return (
                  <Link key={s.id} to={`/app/shift/${s.id}`} className="list-item">
                    <Avatar name={userName(state, s.employeeId)} color={state.users.find((u) => u.id === s.employeeId)?.color} />
                    <div className="grow">
                      <div className="title">{clientOf(state, s.clientId)?.household}</div>
                      <div className="meta">{fmtTime(s.start)}–{fmtTime(s.end)} · {userName(state, s.employeeId)}</div>
                    </div>
                    {e ? e.clockOut ? <Badge tone="ok">done {fmtTime(e.clockOut)}</Badge> : <Badge tone="info">in since {fmtTime(e.clockIn)}</Badge> : <Badge>not started</Badge>}
                  </Link>
                )
              })}
            </div>
          ) : <Empty>No cleanings today.</Empty>}
          {openShifts.length > 0 && <div className="notice warn mt"><AlertTriangle size={16} /> {openShifts.length} open shift{openShifts.length > 1 ? 's' : ''} still need someone.</div>}
        </Card>
        <div className="stack">
          <Card title="New booking requests" action={<Link className="small" to="/app/bookings">All</Link>}>
            {newBk.length ? <div className="list">{newBk.map((b) => (
              <Link key={b.id} to="/app/bookings" className="list-item">
                <div className="grow"><div className="title">{b.name}</div><div className="meta">{SERVICES.find((s) => s.key === b.service)?.name} · {b.frequency} · {relTime(b.createdAt)}</div></div>
                <Badge tone="warn">new</Badge>
              </Link>
            ))}</div> : <Empty>No new requests.</Empty>}
          </Card>
          <Card title="Your to-dos">
            {tasks.length ? <div className="list">{tasks.map((x) => (
              <Link key={x.id} to={x.link || '/app'} className="list-item"><div className="grow"><div className="title">{x.title}</div><div className="meta">{x.detail}</div></div></Link>
            ))}</div> : <Empty>All clear.</Empty>}
          </Card>
        </div>
      </div>
    </div>
  )
}

/* ---------------- schedule builder ---------------- */
function availabilityConflict(state: State, empId: string | null, date: string, start: string, end: string): string | null {
  if (!empId) return null
  const a = state.availability.find((x) => x.employeeId === empId)
  const day = parseYmd(date).getDay()
  const w = a?.weekly.find((x) => x.day === day)
  if (w?.kind === 'none') return `${userName(state, empId)} is unavailable on ${fmtDay(date, { weekday: true })}s.`
  if (w?.kind === 'custom' && (start < (w.from || '00:00') || end > (w.to || '23:59'))) return `${userName(state, empId)} is only available ${fmtTime(w.from!)}–${fmtTime(w.to!)} that day.`
  const off = state.timeOff.find((x) => x.employeeId === empId && x.status !== 'denied' && date >= x.start && date <= x.end)
  if (off) return `${userName(state, empId)} has ${off.status} time off that day.`
  return null
}

export function OwnerSchedule() {
  const { state, update, notify, toast } = useStore()
  const nav = useNavigate()
  const [week, setWeek] = useState(startOfWeek(today()))
  const [who, setWho] = useState('all')
  const [edit, setEdit] = useState<Shift | 'new' | null>(null)
  const inWeek = state.shifts.filter((s) => s.date >= week && s.date <= addDays(week, 6) && (who === 'all' || (who === 'open' ? !s.employeeId : s.employeeId === who)))
  const drafts = state.shifts.filter((s) => s.date >= week && s.date <= addDays(week, 6) && !s.published)
  const weekHours = (id: string) => state.shifts.filter((s) => s.employeeId === id && s.date >= week && s.date <= addDays(week, 6)).reduce((n, s) => n + shiftHours(s), 0)
  return (
    <div className="stack">
      <div className="row between">
        <WeekNav week={week} setWeek={setWeek} />
        <div className="row">
          <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter by employee" style={{ width: 'auto' }}>
            <option value="all">Everyone</option>
            <option value="open">Open shifts</option>
            {employees(state).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button className="btn light sm" title="Copy last week’s shifts into this week as drafts" onClick={() => {
            const last = state.shifts.filter((s) => s.date >= addDays(week, -7) && s.date < week)
            const exists = (s: Shift) => state.shifts.some((x) => x.clientId === s.clientId && x.date === addDays(s.date, 7))
            const add = last.filter((s) => !exists(s))
            update((d) => void d.shifts.push(...add.map((s) => ({ ...s, id: uid('sh'), date: addDays(s.date, 7), published: false, checklist: undefined, note: '' }))))
            toast(add.length ? `Copied ${add.length} shifts as drafts` : 'Nothing new to copy')
          }}><Copy size={15} /> Copy last week</button>
          <button className="btn light sm" onClick={() => setEdit('new')}><Plus size={15} /> Add shift</button>
          <button className="btn sage sm" disabled={!drafts.length} onClick={() => {
            update((d) => {
              const ids = new Set(drafts.map((x) => x.id))
              d.shifts.filter((s) => ids.has(s.id)).forEach((s) => (s.published = true))
              const people = new Set(drafts.map((s) => s.employeeId).filter(Boolean) as string[])
              people.forEach((p) => notify(d, p, `Your schedule for the week of ${fmtDay(week)} is published.`, '/app/schedule'))
              if (drafts.some((s) => !s.employeeId)) employees(d).forEach((u) => notify(d, u.id, `Open shifts are available the week of ${fmtDay(week)}.`, '/app/schedule'))
              d.tasks.filter((t) => t.userId === 'u_owner' && /publish/i.test(t.title)).forEach((t) => (t.done = true))
            })
            toast(`Published ${drafts.length} shifts — the team was notified`)
          }}><Send size={15} /> Publish ({drafts.length})</button>
        </div>
      </div>
      <WeekGrid week={week} shifts={inWeek} showWho onPick={(s) => setEdit(s)} />
      <Card title="Hours scheduled this week">
        <div className="grid g4">
          {employees(state).map((u) => <Stat key={u.id} label={u.name} value={`${weekHours(u.id).toFixed(1)} h`} sub={weekHours(u.id) > POLICY.overtimeAfterWeeklyHours ? 'overtime!' : u.employmentType} />)}
        </div>
      </Card>
      {edit && <ShiftEditor shift={edit === 'new' ? undefined : edit} defaultDate={week} onClose={() => setEdit(null)} onOpen={(id) => nav(`/app/shift/${id}`)} />}
    </div>
  )
}

function ShiftEditor({ shift, defaultDate, onClose, onOpen }: { shift?: Shift; defaultDate: string; onClose: () => void; onOpen: (id: string) => void }) {
  const { state, update, notify, toast } = useStore()
  const [f, setF] = useState<Shift>(() => shift || { id: uid('sh'), employeeId: 'u_jamie', clientId: state.clients[0].id, date: today() > defaultDate ? today() : defaultDate, start: '09:00', end: '12:00', jobTitle: 'Housekeeper', note: '', published: false })
  const conflict = availabilityConflict(state, f.employeeId, f.date, f.start, f.end)
  const c = clientOf(state, f.clientId)
  return (
    <Modal title={shift ? 'Edit shift' : 'Add shift'} onClose={onClose} footer={
      <>
        {shift && <button className="btn light" onClick={() => { update((d) => void (d.shifts = d.shifts.filter((x) => x.id !== shift.id))); toast('Shift deleted'); onClose() }}><Trash2 size={15} /> Delete</button>}
        {shift && <button className="btn light" onClick={() => onOpen(shift.id)}><Eye size={15} /> Details</button>}
        <button className="btn sage" disabled={f.end <= f.start} onClick={() => {
          update((d) => {
            const i = d.shifts.findIndex((x) => x.id === f.id)
            if (i >= 0) {
              const before = d.shifts[i]
              d.shifts[i] = f
              if (f.published && before.employeeId !== f.employeeId && f.employeeId) notify(d, f.employeeId, `You were assigned ${clientOf(d, f.clientId)?.household} on ${fmtDay(f.date)}.`, `/app/shift/${f.id}`)
            } else d.shifts.push(f)
            d.shifts.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
          })
          toast('Shift saved')
          onClose()
        }}>Save</button>
      </>
    }>
      <div className="form-grid">
        <Field label="Client" full>
          <select value={f.clientId} onChange={(e) => {
            const cl = clientOf(state, e.target.value)
            const end = cl ? `${String(Math.floor(Number(f.start.slice(0, 2)) + cl.durationHours)).padStart(2, '0')}:${cl.durationHours % 1 ? '30' : '00'}` : f.end
            setF({ ...f, clientId: e.target.value, end: end <= '21:00' ? end : f.end, employeeId: f.employeeId ?? cl?.preferredEmployeeId ?? null })
          }}>
            {state.clients.filter((x) => x.active).map((x) => <option key={x.id} value={x.id}>{x.household}</option>)}
          </select>
        </Field>
        <Field label="Who">
          <select value={f.employeeId || ''} onChange={(e) => setF({ ...f, employeeId: e.target.value || null })}>
            <option value="">Open shift (anyone can claim)</option>
            {employees(state).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Start"><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
        <Field label="End"><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
        <Field label="Note for the cleaner" full><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. inside of fridge this week" /></Field>
        <label className="check full"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published (visible to the team)</label>
      </div>
      {c && <div className="tiny muted mt">{c.household}: usually {c.durationHours} h, {c.frequency}{c.preferredEmployeeId ? `, prefers ${userName(state, c.preferredEmployeeId)}` : ''}.</div>}
      {conflict && <div className="notice warn mt"><AlertTriangle size={16} /> {conflict}</div>}
    </Modal>
  )
}

/* ---------------- approvals ---------------- */
export function Approvals() {
  const { state, update, notify, toast } = useStore()
  const [tab, setTab] = useState<'time' | 'pto' | 'exp'>('time')
  const [img, setImg] = useState<string | null>(null)
  const sub = state.time.filter((x) => x.status === 'submitted')
  const pto = state.timeOff.filter((x) => x.status === 'pending')
  const exp = state.expenses.filter((x) => x.status === 'pending')
  const byEmp = Object.entries(sub.reduce<Record<string, typeof sub>>((m, e) => ((m[e.employeeId] ||= []).push(e), m), {}))
  function decideTime(ids: string[], ok: boolean, empId: string) {
    update((d) => {
      d.time.filter((t) => ids.includes(t.id)).forEach((t) => {
        t.status = ok ? 'approved' : 'rejected'
        t.history.push({ at: new Date().toISOString(), byId: 'u_owner', change: ok ? 'Approved' : 'Sent back', note: ok ? 'Approved for payroll' : 'Please check this entry and resubmit.' })
      })
      notify(d, empId, ok ? `${ids.length} time entr${ids.length > 1 ? 'ies were' : 'y was'} approved.` : 'A time entry was sent back — please check it.', '/app/time')
      if (!d.time.some((t) => t.status === 'submitted')) d.tasks.filter((t) => t.userId === 'u_owner' && /approve hours/i.test(t.title)).forEach((t) => (t.done = true))
    })
    toast(ok ? 'Approved' : 'Sent back to the employee')
  }
  return (
    <div className="stack">
      <Tabs tabs={[{ id: 'time', label: `Time (${sub.length})` }, { id: 'pto', label: `Time off (${pto.length})` }, { id: 'exp', label: `Expenses (${exp.length})` }]} value={tab} onChange={setTab} />
      {tab === 'time' && (byEmp.length ? byEmp.map(([empId, list]) => (
        <Card key={empId} title={`${userName(state, empId)} — ${list.reduce((n, e) => n + entryHours(e), 0).toFixed(2)} hrs`} action={<button className="btn sage sm" onClick={() => decideTime(list.map((e) => e.id), true, empId)}><Check size={15} /> Approve all</button>}>
          <div className="table-wrap"><table>
            <thead><tr><th>Day</th><th>Client</th><th>Time</th><th className="num">Hours</th><th>Flags</th><th /></tr></thead>
            <tbody>{list.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{fmtDay(entryDay(e), { weekday: true })}</td>
                <td>{clientOf(state, e.clientId)?.household.replace(' Household', '')}</td>
                <td className="nowrap">{fmtTime(e.clockIn)}–{e.clockOut && fmtTime(e.clockOut)}</td>
                <td className="num">{entryHours(e).toFixed(2)}</td>
                <td>{e.source === 'manual' && <Badge tone="info">manual</Badge>} {e.history.length > 0 && <span className="tiny" title={e.history.map((h) => `${h.change}: ${h.note}`).join('\n')}>edited ({e.history.length})</span>} {!e.onSite && <Badge tone="danger">off-site</Badge>}</td>
                <td className="nowrap right">
                  <button className="icon-btn" aria-label="Approve" onClick={() => decideTime([e.id], true, empId)}><Check size={16} color="var(--ok)" /></button>
                  <button className="icon-btn" aria-label="Send back" onClick={() => decideTime([e.id], false, empId)}><X size={16} color="var(--danger)" /></button>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        </Card>
      )) : <Card><Empty>No hours waiting for approval.</Empty></Card>)}
      {tab === 'pto' && <Card>{pto.length ? <div className="list">{pto.map((t) => (
        <div key={t.id} className="list-item">
          <DateBox date={t.start} />
          <div className="grow"><div className="title">{userName(state, t.employeeId)} · {t.hours} h {t.type}</div><div className="meta">{fmtDay(t.start)}{t.end !== t.start && `–${fmtDay(t.end)}`} · {t.reason}</div></div>
          {(['approved', 'denied'] as const).map((st) => (
            <button key={st} className={`btn sm ${st === 'approved' ? 'sage' : 'light'}`} onClick={() => {
              update((d) => { d.timeOff.find((x) => x.id === t.id)!.status = st; notify(d, t.employeeId, `Your time-off request for ${fmtDay(t.start)} was ${st}.`, '/app/time-off') })
              toast(`Request ${st}`)
            }}>{st === 'approved' ? 'Approve' : 'Deny'}</button>
          ))}
        </div>
      ))}</div> : <Empty>No time-off requests.</Empty>}</Card>}
      {tab === 'exp' && <Card>{exp.length ? <div className="list">{exp.map((e) => (
        <div key={e.id} className="list-item">
          <DateBox date={e.date} />
          <div className="grow"><div className="title">{userName(state, e.employeeId)} · {money(e.amount)} {e.category}</div><div className="meta">{e.description}{e.miles ? ` · ${e.miles} mi` : ''}</div></div>
          {e.receipt && <button className="btn light sm" onClick={() => setImg(e.receipt!)}>Receipt</button>}
          {(['approved', 'rejected'] as const).map((st) => (
            <button key={st} className={`btn sm ${st === 'approved' ? 'sage' : 'light'}`} onClick={() => {
              update((d) => { d.expenses.find((x) => x.id === e.id)!.status = st; notify(d, e.employeeId, `Your ${money(e.amount)} expense was ${st}${st === 'approved' ? ' — it’ll be on your next paycheck' : ''}.`, '/app/expenses') })
              toast(`Expense ${st}`)
            }}>{st === 'approved' ? 'Approve' : 'Reject'}</button>
          ))}
        </div>
      ))}</div> : <Empty>No expenses to review.</Empty>}</Card>}
      {img && <Lightbox images={[img]} index={0} onClose={() => setImg(null)} />}
    </div>
  )
}

/* ---------------- payroll ---------------- */
function defaultPayPeriod(state: State): Period {
  // the most recent ended period that hasn't been processed yet, else the current one
  let p = prevPeriod(periodFor(today()))
  for (let i = 0; i < 6; i++) {
    if (!state.payrolls.some((r) => r.periodStart === p.start && r.status === 'processed')) {
      const older = prevPeriod(p)
      if (state.payrolls.some((r) => r.periodStart === older.start) || i === 5) return p
      p = older
    } else return periodFor(today())
  }
  return p
}

export function PayrollPage() {
  const { state, update, notify, toast } = useStore()
  const [p, setP] = useState<Period>(() => defaultPayPeriod(state))
  const [view, setView] = useState<{ stub: Paystub; user: User } | null>(null)
  const [hist, setHist] = useState<Payroll | null>(null)
  const done = state.payrolls.find((r) => r.periodStart === p.start && r.status === 'processed')
  const emps = employees(state)
  const preview = emps.map((u) => ({ u, stub: computeStub(state, u, p, 'preview', true), pending: state.time.filter((t) => t.employeeId === u.id && entryDay(t) >= p.start && entryDay(t) <= p.end && t.status !== 'approved' && t.status !== 'rejected') }))
    .filter((x) => x.stub.gross > 0 || x.pending.length || x.stub.reimbursements.length)
  const totals = preview.reduce((m, x) => ({ gross: m.gross + x.stub.gross, net: m.net + x.stub.net, tax: m.tax + x.stub.gross - (x.stub.net - x.stub.reimbursements.reduce((n, r) => n + r.amount, 0)) }), { gross: 0, net: 0, tax: 0 })
  const employerTax = r2(totals.gross * (POLICY.socialSecurity + POLICY.medicare))
  const pendingCount = preview.reduce((n, x) => n + x.pending.length, 0)
  const ended = p.end < today()

  function run() {
    const id = uid('pr')
    update((d) => {
      const stubs = emps.map((u) => computeStub(d, u, p, id, true)).filter((s) => s.gross > 0 || s.reimbursements.length)
      d.payrolls.push({ id, periodStart: p.start, periodEnd: p.end, payDate: p.payDate, status: 'processed', processedAt: new Date().toISOString(), stubIds: stubs.map((s) => s.id) })
      d.stubs.push(...stubs)
      for (const s of stubs) {
        d.expenses.filter((e) => e.employeeId === s.employeeId && e.status === 'approved').forEach((e) => { e.status = 'paid'; e.payrollId = id })
        if (s.cards.supply) d.cardTxns.push({ id: uid('ct'), employeeId: s.employeeId, card: 'supply', date: p.payDate, amount: s.cards.supply, description: `Load for ${p.label}` })
        if (s.cards.gas) d.cardTxns.push({ id: uid('ct'), employeeId: s.employeeId, card: 'gas', date: p.payDate, amount: s.cards.gas, description: `Load for ${p.label}` })
        notify(d, s.employeeId, `Payroll processed: ${money(s.net)} on ${fmtDay(s.payDate, { weekday: true })}. Your paystub is ready.`, '/app/pay')
      }
    })
    toast('Payroll processed — paystubs are out')
  }

  return (
    <div className="stack">
      <div className="row between">
        <PeriodNav p={p} setP={setP} />
        <div className="small">Pay date <b>{fmtDay(p.payDate, { weekday: true, year: true })}</b> · {POLICY.payDelayDays} days after the period ends, weekends move to Friday</div>
      </div>
      {done ? (
        <div className="notice ok"><Check size={16} /> Processed {fmtDateTime(done.processedAt!)} — {done.stubIds.length} paystubs.</div>
      ) : (
        <>
          {!ended && <div className="notice"><AlertTriangle size={16} /> This period hasn’t ended yet — figures will change as hours come in.</div>}
          {pendingCount > 0 && <div className="notice warn"><AlertTriangle size={16} /> {pendingCount} time entr{pendingCount > 1 ? 'ies aren’t' : 'y isn’t'} approved yet and won’t be paid. <Link to="/app/approvals">Review</Link></div>}
        </>
      )}
      <div className="grid g4">
        <Stat label="Gross pay" value={money(totals.gross)} />
        <Stat label="Employee take-home" value={money(totals.net)} />
        <Stat label="Employer taxes (FICA)" value={money(employerTax)} sub="plus FUTA/SUTA quarterly" />
        <Stat label="Total cost" value={money(totals.gross + employerTax)} />
      </div>
      <Card title={done ? 'Paystubs' : 'Preview'} action={!done && <button className="btn sage" disabled={!preview.length} onClick={run}><Send size={16} /> Process payroll</button>}>
        <div className="table-wrap"><table>
          <thead><tr><th>Employee</th><th className="num">Reg</th><th className="num">OT</th><th className="num">PTO</th><th className="num">Gross</th><th className="num">Reimb.</th><th className="num">Net</th><th>Cards</th><th /></tr></thead>
          <tbody>{(done ? done.stubIds.map((sid) => state.stubs.find((s) => s.id === sid)!).filter(Boolean).map((s) => ({ u: state.users.find((u) => u.id === s.employeeId)!, stub: s, pending: [] })) : preview).map(({ u, stub, pending }) => (
            <tr key={u.id}>
              <td className="nowrap"><b>{u.name}</b> <span className="tiny muted">{u.employmentType}</span> {pending.length > 0 && <Badge tone="warn">{pending.length} unapproved</Badge>}</td>
              <td className="num">{stub.regularHours.toFixed(2)}</td>
              <td className="num">{stub.overtimeHours.toFixed(2)}</td>
              <td className="num">{stub.ptoHours.toFixed(2)}</td>
              <td className="num">{money(stub.gross)}</td>
              <td className="num">{money(stub.reimbursements.reduce((n, r) => n + r.amount, 0))}</td>
              <td className="num"><b>{money(stub.net)}</b></td>
              <td className="tiny nowrap">{money(stub.cards.supply)} / {money(stub.cards.gas)}</td>
              <td><button className="icon-btn" aria-label="View stub" onClick={() => setView({ stub, user: u })}><Eye size={16} /></button></td>
            </tr>
          ))}</tbody>
        </table></div>
        {!done && !preview.length && <Empty>No approved hours in this period.</Empty>}
      </Card>
      <Card title="Payroll history">
        {state.payrolls.length ? <div className="list">{[...state.payrolls].reverse().map((r) => (
          <button key={r.id} className="list-item linkbtn" style={{ width: '100%' }} onClick={() => setHist(r)}>
            <DateBox date={r.payDate} />
            <div className="grow" style={{ textAlign: 'left' }}><div className="title">{fmtDay(r.periodStart)} – {fmtDay(r.periodEnd, { year: true })}</div><div className="meta">{r.stubIds.length} paystubs · {money(r.stubIds.reduce((n, id) => n + (state.stubs.find((s) => s.id === id)?.gross || 0), 0))} gross</div></div>
            <Badge tone="ok">{r.status}</Badge>
          </button>
        ))}</div> : <Empty>No payrolls yet.</Empty>}
      </Card>
      {hist && <Modal title={`Payroll ${fmtDay(hist.periodStart)} – ${fmtDay(hist.periodEnd)}`} onClose={() => setHist(null)}>
        <div className="list">{hist.stubIds.map((id) => state.stubs.find((s) => s.id === id)).filter(Boolean).map((s) => {
          const u = state.users.find((x) => x.id === s!.employeeId)!
          return <button key={s!.id} className="list-item linkbtn" style={{ width: '100%' }} onClick={() => { setHist(null); setView({ stub: s!, user: u }) }}><div className="grow" style={{ textAlign: 'left' }}><div className="title">{u.name}</div><div className="meta">gross {money(s!.gross)} · net {money(s!.net)}</div></div></button>
        })}</div>
      </Modal>}
      {view && <Modal wide title={`${view.user.name} — paystub`} onClose={() => setView(null)} footer={<button className="btn" onClick={() => window.print()}>Print / PDF</button>}><StubView stub={view.stub} user={view.user} /></Modal>}
    </div>
  )
}

/* ---------------- team ---------------- */
export function Team() {
  const { state, update, toast } = useStore()
  const [add, setAdd] = useState(false)
  const [f, setF] = useState({ name: '', email: '', phone: '', employmentType: 'regular' as 'regular' | 'substitute', payRate: 18, startDate: addDays(today(), 7) })
  const t = today()
  return (
    <div className="stack">
      <div className="row between">
        <div className="small muted">{employees(state).length} people on the team</div>
        <button className="btn sage sm" onClick={() => setAdd(true)}><UserPlus size={15} /> Add a new hire</button>
      </div>
      <div className="grid g3">
        {employees(state).map((u) => {
          const ob = u.onboarding ? Object.values(u.onboarding).filter(Boolean).length : 6
          const on = state.time.find((x) => x.employeeId === u.id && !x.clockOut)
          const next = state.shifts.find((s) => s.employeeId === u.id && s.date >= t)
          return (
            <Link key={u.id} to={`/app/team/${u.id}`} className="card link stack" style={{ gap: 8 }}>
              <div className="row nowrap"><Avatar name={u.name} color={u.color} lg /><div><b>{u.name}</b><div className="tiny muted">{u.title} · {u.employmentType}</div></div></div>
              {ob < 6 ? <><div className="tiny">Onboarding {ob}/6</div><Progress value={ob / 6} /></> : <div className="tiny muted">{money(u.payRate || 18)}/hr · since {u.startDate && fmtDay(u.startDate, { year: true })}</div>}
              <div className="tiny">{on ? <Badge tone="info">on the clock at {clientOf(state, on.clientId)?.household.replace(' Household', '')}</Badge> : next ? `Next: ${fmtDay(next.date, { weekday: true })} ${fmtTime(next.start)}` : 'No upcoming shifts'}</div>
            </Link>
          )
        })}
      </div>
      {add && <Modal title="Add a new hire" onClose={() => setAdd(false)} footer={
        <button className="btn sage" disabled={!f.name || !f.email} onClick={() => {
          const id = uid('u')
          update((d) => {
            d.users.push({ id, name: f.name, role: 'employee', title: f.employmentType === 'substitute' ? 'Substitute Housekeeper' : 'Housekeeper', email: f.email, phone: f.phone, color: '#7a9e7e', employmentType: f.employmentType, payRate: f.payRate, startDate: f.startDate, managerId: 'u_owner', ptoStartBalance: 0, active: true, onboarding: { profile: true, w4: false, i9: false, directDeposit: false, handbookSigned: false, agreementSigned: false } })
            const tasks: [string, string][] = [['Fill out your W-4', 'Federal tax withholding.'], ['Complete I-9 section 1 and show ID', 'Bring your documents to your first shadowing day.'], ['Add direct deposit (or choose paper check)', ''], ['Read & sign the Employee Handbook and Employment Agreement', '']]
            tasks.forEach(([title, detail]) => d.tasks.push({ id: uid('tk'), userId: id, title, detail, due: f.startDate, done: false, link: '/app/onboarding', kind: 'onboarding' }))
          })
          toast(`${f.name} added — they’ll see their onboarding checklist when they sign in`)
          setAdd(false)
        }}>Add & send onboarding</button>
      }>
        <div className="form-grid">
          <Field label="Full name" full><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Type"><select value={f.employmentType} onChange={(e) => setF({ ...f, employmentType: e.target.value as 'regular' })}><option value="regular">Regular (RCT)</option><option value="substitute">Substitute (SubRCT)</option></select></Field>
          <Field label="Pay rate ($/hr)"><input type="number" step={0.25} value={f.payRate} onChange={(e) => setF({ ...f, payRate: Number(e.target.value) })} /></Field>
          <Field label="Start date"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
        </div>
      </Modal>}
    </div>
  )
}

export function TeamMember() {
  const { id = '' } = useParams()
  const { state, update, toast } = useStore()
  const u = state.users.find((x) => x.id === id)
  const [tab, setTab] = useState<'time' | 'pay' | 'profile' | 'docs'>('time')
  if (!u) return <Empty>Not found.</Empty>
  const a = state.availability.find((x) => x.employeeId === u.id)
  const sigs = state.signatures.filter((s) => s.userId === u.id)
  return (
    <div className="stack">
      <Link to="/app/team" className="small row" style={{ gap: 4 }}><ChevronLeft size={16} /> Team</Link>
      <div className="row"><Avatar name={u.name} color={u.color} lg /><div><h2 style={{ margin: 0 }}>{u.name}</h2><div className="small muted">{u.title} · {u.employmentType} · {money(u.payRate || 18)}/hr</div></div></div>
      <Tabs tabs={[{ id: 'time', label: 'Time' }, { id: 'pay', label: 'Pay' }, { id: 'profile', label: 'Job & availability' }, { id: 'docs', label: 'Onboarding & docs' }]} value={tab} onChange={setTab} />
      {tab === 'time' && <TimePage employeeId={u.id} />}
      {tab === 'pay' && <PayPage employeeId={u.id} />}
      {tab === 'profile' && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <Card title="Job">
            <div className="form-grid">
              <Field label="Pay rate ($/hr)"><input type="number" step={0.25} defaultValue={u.payRate || 18} onBlur={(e) => { update((d) => void (d.users.find((x) => x.id === u.id)!.payRate = Number(e.target.value))); toast('Pay rate updated') }} /></Field>
              <Field label="Type"><select value={u.employmentType} onChange={(e) => update((d) => void (d.users.find((x) => x.id === u.id)!.employmentType = e.target.value as 'regular'))}><option value="regular">Regular</option><option value="substitute">Substitute</option></select></Field>
              <Field label="Phone"><input defaultValue={u.phone} readOnly /></Field>
              <Field label="Email"><input defaultValue={u.email} readOnly /></Field>
            </div>
            <button className="btn light sm mt" onClick={() => { if (confirm(`Deactivate ${u.name}? Their history is kept.`)) update((d) => void (d.users.find((x) => x.id === u.id)!.active = false)) }}>Deactivate</button>
          </Card>
          <Card title="Availability" action={a && <span className="tiny muted">updated {fmtDay(a.updatedAt)}</span>}>
            {a ? <div className="list">{a.weekly.map((w) => <div key={w.day} className="list-item small"><b style={{ width: 90 }}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][w.day]}</b>{w.kind === 'all' ? 'All day' : w.kind === 'none' ? <span className="muted">Unavailable</span> : `${fmtTime(w.from!)}–${fmtTime(w.to!)}`}</div>)}{a.notes && <div className="small mt">“{a.notes}”</div>}</div> : <Empty>Not set yet.</Empty>}
          </Card>
        </div>
      )}
      {tab === 'docs' && (
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <Card title="Onboarding">
            {u.onboarding ? <div className="list">{Object.entries(u.onboarding).map(([k, v]) => <div key={k} className="list-item small">{v ? <Check size={16} color="var(--ok)" /> : <X size={16} className="muted" />} {({ profile: 'Personal details', w4: 'W-4', i9: 'I-9 section 1', directDeposit: 'Payment method', handbookSigned: 'Handbook signed', agreementSigned: 'Agreement signed' } as Record<string, string>)[k]}</div>)}</div> : <Empty>—</Empty>}
            {u.w4 && <div className="tiny muted mt">W-4: {u.w4.filingStatus}{u.w4.multipleJobs ? ', multiple jobs' : ''}, dependents ${u.w4.dependentsAmount}, extra ${u.w4.extraWithholding}/check</div>}
            <div className="tiny muted">Paid by {u.payMethod === 'check' ? 'check' : u.payMethod ? `direct deposit ••${u.bankLast4 || '—'}` : 'not set'}</div>
          </Card>
          <Card title="Signed documents">{sigs.length ? <div className="list">{sigs.map((s) => <Link key={s.docSlug} to={`/app/docs/${s.docSlug}`} className="list-item"><div className="grow"><div className="title">{DOCS.find((d) => d.slug === s.docSlug)?.title}</div><div className="meta">Signed “{s.name}” · {fmtDateTime(s.at)}</div></div></Link>)}</div> : <Empty>Nothing signed yet.</Empty>}</Card>
        </div>
      )}
    </div>
  )
}

/* ---------------- clients ---------------- */
export function Clients() {
  const { state, update, toast } = useStore()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [add, setAdd] = useState(false)
  const list = state.clients.filter((c) => !q || (c.household + c.address + c.contactName).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="stack">
      <div className="row between">
        <input placeholder="Search clients…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
        <button className="btn sage sm" onClick={() => setAdd(true)}><Plus size={15} /> Add client</button>
      </div>
      <Card>
        <div className="table-wrap"><table>
          <thead><tr><th>Household</th><th>Service</th><th>Frequency</th><th className="num">Hours</th><th>Usual cleaner</th><th className="num">Owed</th></tr></thead>
          <tbody>{list.map((c) => {
            const owed = state.invoices.filter((i) => i.clientId === c.id && i.status === 'sent').reduce((n, i) => n + i.total, 0)
            return (
              <tr key={c.id} onClick={() => nav(`/app/clients/${c.id}`)} style={{ cursor: 'pointer', opacity: c.active ? 1 : 0.5 }}>
                <td><Link to={`/app/clients/${c.id}`}><b>{c.household}</b></Link><div className="tiny muted">{c.address}</div></td>
                <td className="small">{SERVICES.find((s) => s.key === c.service)?.name.replace(' Package', '')}</td>
                <td className="small">{c.frequency}</td>
                <td className="num">{c.durationHours}</td>
                <td className="small">{c.preferredEmployeeId ? userName(state, c.preferredEmployeeId) : '—'}</td>
                <td className="num">{owed ? <Badge tone="warn">{money(owed)}</Badge> : '—'}</td>
              </tr>
            )
          })}</tbody>
        </table></div>
      </Card>
      {add && <ClientEditor onClose={() => setAdd(false)} onSave={(c) => { update((d) => void d.clients.push(c)); toast('Client added'); setAdd(false); nav(`/app/clients/${c.id}`) }} />}
    </div>
  )
}

export function ClientEditor({ client, onSave, onClose }: { client?: Client; onSave: (c: Client) => void; onClose: () => void }) {
  const { state } = useStore()
  const [c, setC] = useState<Client>(() => client || { id: uid('c'), household: '', contactName: '', phone: '', email: '', address: '', lat: 46.7324, lng: -117.0002, frequency: 'biweekly', durationHours: 3, service: 'basic', addOns: [], notes: '', pets: '', since: today(), photos: [], active: true })
  return (
    <Modal title={client ? 'Edit client' : 'New client'} onClose={onClose} footer={<button className="btn sage" disabled={!c.household || !c.address} onClick={() => onSave(c)}>Save</button>}>
      <div className="form-grid">
        <Field label="Household name" full><input value={c.household} onChange={(e) => setC({ ...c, household: e.target.value })} placeholder="Smith Household" /></Field>
        <Field label="Contact"><input value={c.contactName} onChange={(e) => setC({ ...c, contactName: e.target.value })} /></Field>
        <Field label="Phone"><input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
        <Field label="Email"><input value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
        <Field label="Address" full><input value={c.address} onChange={(e) => setC({ ...c, address: e.target.value })} /></Field>
        <Field label="Latitude" hint="For the clock-in geofence"><input type="number" step="0.0001" value={c.lat} onChange={(e) => setC({ ...c, lat: Number(e.target.value) })} /></Field>
        <Field label="Longitude"><input type="number" step="0.0001" value={c.lng} onChange={(e) => setC({ ...c, lng: Number(e.target.value) })} /></Field>
        <Field label="Service"><select value={c.service} onChange={(e) => setC({ ...c, service: e.target.value as Client['service'] })}>{SERVICES.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select></Field>
        <Field label="Frequency"><select value={c.frequency} onChange={(e) => setC({ ...c, frequency: e.target.value as Client['frequency'] })}>{['weekly', 'biweekly', 'monthly', 'as-needed', 'project'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Usual hours"><input type="number" step={0.5} value={c.durationHours} onChange={(e) => setC({ ...c, durationHours: Number(e.target.value) })} /></Field>
        <Field label="Usual cleaner"><select value={c.preferredEmployeeId || ''} onChange={(e) => setC({ ...c, preferredEmployeeId: e.target.value || undefined })}><option value="">—</option>{employees(state).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Checklist (SOP)" full><select value={c.sopSlug || ''} onChange={(e) => setC({ ...c, sopSlug: e.target.value || undefined })}><option value="">General SOP only</option>{DOCS.filter((d) => d.category === 'Client SOPs' || d.category === 'Project Task Lists').map((d) => <option key={d.slug} value={d.slug}>{d.title}</option>)}</select></Field>
        <div className="full chips">{ADDONS.map((a) => <button key={a.key} type="button" className={`chip${c.addOns.includes(a.key) ? ' on' : ''}`} onClick={() => setC({ ...c, addOns: c.addOns.includes(a.key) ? c.addOns.filter((x) => x !== a.key) : [...c.addOns, a.key] })}>{a.name}</button>)}</div>
        <Field label="Pets" full><input value={c.pets} onChange={(e) => setC({ ...c, pets: e.target.value })} /></Field>
        <Field label="Notes" full><textarea rows={3} value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} /></Field>
      </div>
    </Modal>
  )
}

export function PhotoStrip({ client, canEdit }: { client: Client; canEdit: boolean }) {
  const { update, toast } = useStore()
  const [idx, setIdx] = useState<number | null>(null)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <div className="gallery">
        {client.photos.map((p, i) => <button key={p.id} className="linkbtn" onClick={() => setIdx(i)}><img src={p.dataUrl} alt={p.caption} /></button>)}
        {canEdit && <button className="btn light" onClick={() => ref.current?.click()} style={{ minHeight: 90 }}><ImagePlus size={18} /> Add photo</button>}
      </div>
      {!client.photos.length && !canEdit && <Empty>No photos.</Empty>}
      <input ref={ref} type="file" accept="image/*" hidden multiple onChange={async (e) => {
        const files = [...(e.target.files || [])]
        e.target.value = ''
        const urls = await Promise.all(files.map((f) => fileToDataUrl(f, 1000)))
        update((d) => void d.clients.find((x) => x.id === client.id)!.photos.push(...urls.map((u, i) => ({ id: uid('ph'), caption: files[i].name.replace(/\.\w+$/, ''), dataUrl: u }))))
        toast(`${urls.length} photo${urls.length > 1 ? 's' : ''} added`)
      }} />
      {idx !== null && <Lightbox images={client.photos.map((p) => p.dataUrl)} index={idx} onClose={() => setIdx(null)} />}
    </>
  )
}

export function ClientDetail() {
  const { id = '' } = useParams()
  const { state, update, toast } = useStore()
  const [edit, setEdit] = useState(false)
  const c = clientOf(state, id)
  if (!c) return <Empty>Client not found.</Empty>
  const t = today()
  const upcoming = state.shifts.filter((s) => s.clientId === c.id && s.date >= t).slice(0, 6)
  const past = state.shifts.filter((s) => s.clientId === c.id && s.date < t).slice(-5).reverse()
  const inv = state.invoices.filter((i) => i.clientId === c.id).slice(-6).reverse()
  const sop = DOCS.find((d) => d.slug === c.sopSlug)
  return (
    <div className="stack">
      <Link to="/app/clients" className="small row" style={{ gap: 4 }}><ChevronLeft size={16} /> Clients</Link>
      <div className="row between">
        <div><h2 style={{ margin: 0 }}>{c.household}</h2><div className="small muted">{c.contactName} · {c.phone} · {c.email}</div></div>
        <button className="btn light sm" onClick={() => setEdit(true)}>Edit</button>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Home">
          <div className="stack small" style={{ gap: 6 }}>
            <div>{c.address}</div>
            <div><b>Service:</b> {SERVICES.find((s) => s.key === c.service)?.name} ({money(svcRate(c))}/hr) · {c.frequency} · {c.durationHours} h</div>
            <div><b>Add-ons:</b> {c.addOns.length ? c.addOns.join(', ') : 'none'}</div>
            <div><b>Pets:</b> {c.pets || 'none'}</div>
            <div><b>Usual cleaner:</b> {c.preferredEmployeeId ? userName(state, c.preferredEmployeeId) : '—'}</div>
            {c.notes && <div className="notice">{c.notes}</div>}
            {sop ? <Link className="btn light sm" style={{ alignSelf: 'flex-start' }} to={`/app/docs/${sop.slug}`}>Checklist: {sop.title}</Link> : <span className="muted">Uses the general SOP</span>}
          </div>
        </Card>
        <Card title="Upcoming">{upcoming.length ? <div className="list">{upcoming.map((s) => <ShiftRow key={s.id} s={s} showWho />)}</div> : <Empty>Nothing scheduled.</Empty>}</Card>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Recent visits">{past.length ? <div className="list">{past.map((s) => <ShiftRow key={s.id} s={s} showWho />)}</div> : <Empty>No visits yet.</Empty>}</Card>
        <Card title="Invoices" action={<Link className="small" to="/app/invoices">All</Link>}>{inv.length ? <div className="list">{inv.map((i) => <div key={i.id} className="list-item"><div className="grow"><div className="title">#{i.number} · {money(i.total)}</div><div className="meta">{fmtDay(i.date)}</div></div><Badge>{i.status}</Badge></div>)}</div> : <Empty>No invoices.</Empty>}</Card>
      </div>
      <Card title="Photos"><PhotoStrip client={c} canEdit /></Card>
      {edit && <ClientEditor client={c} onClose={() => setEdit(false)} onSave={(n) => { update((d) => { const i = d.clients.findIndex((x) => x.id === n.id); d.clients[i] = n }); toast('Saved'); setEdit(false) }} />}
    </div>
  )
}

/* ---------------- bookings ---------------- */
export function Bookings() {
  const { state, update, toast } = useStore()
  const nav = useNavigate()
  const [tab, setTab] = useState<'open' | 'all'>('open')
  const list = [...state.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter((b) => tab === 'all' || b.status === 'new' || b.status === 'contacted')
  const set = (b: Booking, status: Booking['status']) => update((d) => void (d.bookings.find((x) => x.id === b.id)!.status = status))
  function convert(b: Booking) {
    const id = uid('c')
    update((d) => {
      d.clients.push({ id, household: `${b.name.split(' ').slice(-1)[0]} Household`, contactName: b.name, phone: b.phone, email: b.email, address: b.address, lat: 46.7324, lng: -117.0002, frequency: b.frequency === 'one-time' ? 'as-needed' : b.frequency, durationHours: 3, service: b.service, addOns: b.addOns, notes: b.notes, pets: '', since: today(), photos: [], active: true })
      const x = d.bookings.find((y) => y.id === b.id)!
      x.status = 'scheduled'
      x.clientId = id
      d.shifts.push({ id: uid('sh'), employeeId: null, clientId: id, date: b.preferredDate, start: /after|evening|pm/i.test(b.preferredTime) ? '18:00' : '09:00', end: /after|evening|pm/i.test(b.preferredTime) ? '21:00' : '12:00', jobTitle: 'Housekeeper', note: 'First cleaning', published: false })
    })
    toast('Client created with a draft first cleaning — assign it on the schedule')
    nav(`/app/clients/${id}`)
  }
  return (
    <div className="stack">
      <Tabs tabs={[{ id: 'open', label: 'Open' }, { id: 'all', label: 'All' }]} value={tab} onChange={setTab} />
      {list.length ? list.map((b) => {
        const est = estimate(b.service, 3, b.addOns)
        return (
          <Card key={b.id} title={<div><h3 style={{ margin: 0 }}>{b.name}</h3><div className="tiny muted">{relTime(b.createdAt)} · {b.email} · {b.phone}</div></div>} action={<Badge>{b.status}</Badge>}>
            <div className="grid g2 small">
              <div><b>Service:</b> {SERVICES.find((s) => s.key === b.service)?.name}{b.addOns.length ? ` + ${b.addOns.join(', ')}` : ''}</div>
              <div><b>How often:</b> {b.frequency}</div>
              <div><b>Home:</b> {b.homeSize}</div>
              <div><b>Wants:</b> {fmtDay(b.preferredDate, { weekday: true })}, {b.preferredTime}</div>
              <div style={{ gridColumn: '1 / -1' }}><b>Address:</b> {b.address}</div>
              {b.notes && <div className="notice" style={{ gridColumn: '1 / -1' }}>{b.notes}</div>}
              <div className="tiny muted" style={{ gridColumn: '1 / -1' }}>Rough estimate for 3 hours: {money(est.perVisit)} ({money(est.rate)}/hr)</div>
            </div>
            <div className="row mt">
              {b.status !== 'scheduled' && <button className="btn sage sm" onClick={() => convert(b)}><UserPlus size={15} /> Make client & schedule</button>}
              {b.status === 'new' && <button className="btn light sm" onClick={() => set(b, 'contacted')}>Mark contacted</button>}
              {b.status !== 'declined' && b.status !== 'scheduled' && <button className="btn light sm" onClick={() => set(b, 'declined')}>Decline</button>}
              <a className="btn light sm" href={`mailto:${b.email}?subject=${encodeURIComponent('Your GIST Cleaning request')}`}>Email</a>
              <AiButton task="quote" label="Draft a quote reply" prompt="Draft a friendly reply to this booking request with a price estimate and next steps." extra={JSON.stringify({ ...b, estimate: est })} onUse={(txt) => { navigator.clipboard?.writeText(txt); toast('Copied to clipboard') }} useLabel="Copy" />
            </div>
          </Card>
        )
      }) : <Card><Empty>No open requests. New ones from the website’s booking form land here.</Empty></Card>}
    </div>
  )
}

/* ---------------- invoices (owner + client) ---------------- */
export function Invoices() {
  const { state, me, role, update, notify, toast } = useStore()
  const isClient = role === 'client'
  const [tab, setTab] = useState<'open' | 'paid' | 'all'>('open')
  const [view, setView] = useState<Invoice | null>(null)
  const [gen, setGen] = useState(false)
  const mine = state.invoices.filter((i) => !isClient || i.clientId === me?.clientId)
  const list = mine.filter((i) => tab === 'all' || (tab === 'paid' ? i.status === 'paid' : i.status === 'sent' || i.status === 'draft')).sort((a, b) => b.number - a.number)
  const owed = mine.filter((i) => i.status === 'sent').reduce((n, i) => n + i.total, 0)
  return (
    <div className="stack">
      <div className="row between">
        <Tabs tabs={[{ id: 'open', label: 'Open' }, { id: 'paid', label: 'Paid' }, { id: 'all', label: 'All' }]} value={tab} onChange={setTab} />
        <div className="row">
          <span className="small">Outstanding: <b>{money(owed)}</b></span>
          {!isClient && <button className="btn sage sm" onClick={() => setGen(true)}><Plus size={15} /> Invoice completed cleanings</button>}
        </div>
      </div>
      <Card>
        {list.length ? <div className="table-wrap"><table>
          <thead><tr><th>#</th>{!isClient && <th>Client</th>}<th>Date</th><th>Due</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
          <tbody>{list.map((i) => (
            <tr key={i.id}>
              <td>{i.number}</td>
              {!isClient && <td>{clientOf(state, i.clientId)?.household}</td>}
              <td className="nowrap">{fmtDay(i.date)}</td>
              <td className="nowrap">{fmtDay(i.due)}</td>
              <td className="num">{money(i.total)}</td>
              <td><Badge tone={i.status === 'sent' && i.due < today() ? 'danger' : undefined}>{i.status === 'sent' && i.due < today() ? 'overdue' : i.status}</Badge></td>
              <td className="right"><button className="btn light sm" onClick={() => setView(i)}>{isClient && i.status === 'sent' ? 'Pay' : 'View'}</button></td>
            </tr>
          ))}</tbody>
        </table></div> : <Empty>No invoices here.</Empty>}
      </Card>
      {view && <InvoiceModal inv={view} onClose={() => setView(null)} onPay={(method) => {
        update((d) => {
          const x = d.invoices.find((y) => y.id === view.id)!
          x.status = 'paid'; x.method = method; x.paidAt = new Date().toISOString()
          if (isClient) notify(d, 'u_owner', `${clientOf(d, x.clientId)?.household} paid invoice #${x.number} (${money(x.total)}) by ${method}.`, '/app/invoices')
        })
        toast('Marked paid — thank you!')
        setView(null)
      }} onStatus={(st) => {
        update((d) => {
          const x = d.invoices.find((y) => y.id === view.id)!
          x.status = st
          const cu = d.users.find((u) => u.clientId === x.clientId)
          if (st === 'sent' && cu) notify(d, cu.id, `Invoice #${x.number} for ${money(x.total)} is ready.`, '/app/invoices')
        })
        toast(`Invoice ${st}`)
        setView(null)
      }} />}
      {gen && <GenerateInvoices onClose={() => setGen(false)} />}
    </div>
  )
}

function InvoiceModal({ inv, onClose, onPay, onStatus }: { inv: Invoice; onClose: () => void; onPay: (m: 'venmo' | 'zelle' | 'square') => void; onStatus: (s: Invoice['status']) => void }) {
  const { state, role } = useStore()
  const c = clientOf(state, inv.clientId)
  const [method, setMethod] = useState<'venmo' | 'zelle' | 'square'>('venmo')
  const isClient = role === 'client'
  const text = [`GIST Cleaning — Invoice #${inv.number}`, `${c?.household}`, `Date ${inv.date}, due ${inv.due}`, ...inv.lines.map((l) => `${l.description}: ${l.hours} h × ${money(l.rate)} = ${money(l.amount)}`), `Total ${money(inv.total)}`, `Status: ${inv.status}`].join('\n')
  return (
    <Modal wide title={`Invoice #${inv.number}`} onClose={onClose} footer={
      <>
        <button className="btn light" onClick={() => saveText(text, `gist-invoice-${inv.number}.txt`)}><Download size={15} /> Download</button>
        <button className="btn light" onClick={() => window.print()}>Print</button>
        {!isClient && inv.status === 'draft' && <button className="btn sage" onClick={() => onStatus('sent')}><Send size={15} /> Send to client</button>}
        {!isClient && inv.status !== 'paid' && inv.status !== 'void' && <button className="btn light" onClick={() => onStatus('void')}>Void</button>}
        {inv.status === 'sent' && <button className="btn sage" onClick={() => onPay(method)}>{isClient ? `I paid with ${method}` : `Mark paid (${method})`}</button>}
      </>
    }>
      <div className="stub">
        <div className="hdr"><div><div className="serif" style={{ fontSize: '1.3rem', color: 'var(--navy)' }}>GIST Cleaning LLC</div><div className="tiny muted">Moscow, ID · gistcleaning@gmail.com · 208-310-0809</div></div><div className="right"><b>{c?.household}</b><div className="tiny muted">{c?.address}</div></div></div>
        <div className="grid g3 small" style={{ margin: '12px 0' }}><div><div className="tiny muted">Invoice date</div>{fmtDay(inv.date, { year: true })}</div><div><div className="tiny muted">Due</div>{fmtDay(inv.due, { year: true })}</div><div><div className="tiny muted">Status</div>{inv.status}{inv.paidAt && ` · ${inv.method} ${fmtDay(inv.paidAt.slice(0, 10))}`}</div></div>
        <table><thead><tr><th>Description</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
          <tbody>{inv.lines.map((l, i) => <tr key={i}><td>{l.description}</td><td className="num">{l.hours || ''}</td><td className="num">{l.rate ? money(l.rate) : ''}</td><td className="num">{money(l.amount)}</td></tr>)}</tbody></table>
        <div className="net"><span>Total</span><span>{money(inv.total)}</span></div>
      </div>
      {inv.status === 'sent' && (
        <div className="mt">
          <div className="small"><b>Pay by:</b></div>
          <div className="chips mt">{(['venmo', 'zelle', 'square'] as const).map((m) => <button key={m} className={`chip${method === m ? ' on' : ''}`} onClick={() => setMethod(m)}>{m[0].toUpperCase() + m.slice(1)}</button>)}</div>
          <div className="tiny muted mt">Demo: no money moves. In production this opens Venmo/Zelle with the amount filled in, or a Square checkout link. Payment is due within 24 hours of your cleaning.</div>
        </div>
      )}
    </Modal>
  )
}

function GenerateInvoices({ onClose }: { onClose: () => void }) {
  const { state, update, notify, toast } = useStore()
  const billed = new Set(state.invoices.flatMap((i) => i.shiftIds))
  const done = new Set(state.time.filter((t) => t.clockOut).map((t) => t.shiftId))
  const unbilled = state.shifts.filter((s) => s.date <= today() && !billed.has(s.id) && (s.date < today() || done.has(s.id)) && s.employeeId)
  const byClient = Object.entries(unbilled.reduce<Record<string, Shift[]>>((m, s) => ((m[s.clientId] ||= []).push(s), m), {}))
  const [send, setSend] = useState(true)
  return (
    <Modal title="Invoice completed cleanings" onClose={onClose} footer={
      <button className="btn sage" disabled={!byClient.length} onClick={() => {
        update((d) => {
          let n = Math.max(1000, ...d.invoices.map((i) => i.number))
          for (const [cid, ss] of byClient) {
            const c = clientOf(d, cid)
            const rate = svcRate(c)
            const lines = ss.map((s) => {
              const actual = d.time.filter((t) => t.shiftId === s.id && t.clockOut).reduce((h, t) => h + entryHours(t), 0)
              const h = r2(actual || shiftHours(s))
              return { description: `Cleaning ${fmtDay(s.date)}`, hours: h, rate, amount: r2(h * rate) }
            })
            const total = r2(lines.reduce((x, l) => x + l.amount, 0))
            const inv: Invoice = { id: uid('inv'), number: ++n, clientId: cid, date: today(), due: addDays(today(), 1), lines, total, status: send ? 'sent' : 'draft', shiftIds: ss.map((s) => s.id) }
            d.invoices.push(inv)
            const cu = d.users.find((u) => u.clientId === cid)
            if (send && cu) notify(d, cu.id, `Invoice #${inv.number} for ${money(total)} is ready.`, '/app/invoices')
          }
        })
        toast(`Created ${byClient.length} invoice${byClient.length > 1 ? 's' : ''}`)
        onClose()
      }}>Create {byClient.length} invoice{byClient.length === 1 ? '' : 's'}</button>
    }>
      {byClient.length ? <div className="list">{byClient.map(([cid, ss]) => {
        const c = clientOf(state, cid)
        return <div key={cid} className="list-item"><div className="grow"><div className="title">{c?.household}</div><div className="meta">{ss.length} cleaning{ss.length > 1 ? 's' : ''} · {ss.reduce((n, s) => n + shiftHours(s), 0)} h × {money(svcRate(c))}</div></div><b>{money(ss.reduce((n, s) => n + shiftHours(s), 0) * svcRate(c))}</b></div>
      })}</div> : <Empty>Every completed cleaning is already invoiced.</Empty>}
      <label className="check mt"><input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} /> Send to clients now (otherwise save as drafts)</label>
      <div className="tiny muted mt">Uses clocked hours when available, otherwise the scheduled hours, at each client’s service rate.</div>
    </Modal>
  )
}

/* ---------------- reports ---------------- */
function Bars({ data, fmt = (n: number) => String(n) }: { data: { label: string; value: number; sub?: string }[]; fmt?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="stack" style={{ gap: 8 }}>
      {data.map((d) => (
        <div key={d.label}>
          <div className="row between small"><span>{d.label}</span><b>{fmt(d.value)}</b></div>
          <div className="progress"><div style={{ width: `${(d.value / max) * 100}%` }} /></div>
          {d.sub && <div className="tiny muted">{d.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export function Reports() {
  const { state } = useStore()
  const [p, setP] = useState(periodFor(today()))
  const emps = employees(state)
  const hours = emps.map((u) => ({ u, h: hoursFor(state, u.id, p) }))
  const months = useMemo(() => {
    const m: Record<string, { billed: number; paid: number }> = {}
    state.invoices.filter((i) => i.status !== 'void').forEach((i) => { const k = i.date.slice(0, 7); m[k] ||= { billed: 0, paid: 0 }; m[k].billed += i.total; if (i.status === 'paid') m[k].paid += i.total })
    return Object.entries(m).sort().slice(-6)
  }, [state.invoices])
  const laborByMonth = (k: string) => state.stubs.filter((s) => s.payDate.slice(0, 7) === k).reduce((n, s) => n + s.gross, 0)
  const topClients = state.clients.map((c) => ({ c, v: state.invoices.filter((i) => i.clientId === c.id && i.status !== 'void').reduce((n, i) => n + i.total, 0) })).sort((a, b) => b.v - a.v).slice(0, 8)
  const exportCsv = () => {
    const rows = [['employee', 'period', 'regular', 'overtime', 'total'], ...hours.map(({ u, h }) => [u.name, p.label, h.regular, h.overtime, h.total])]
    saveText(rows.map((r) => r.join(',')).join('\n'), `gist-hours-${p.start}.csv`, 'text/csv')
  }
  const onSite = state.time.filter((t) => entryDay(t) >= p.start && entryDay(t) <= p.end)
  const manual = onSite.filter((t) => t.source === 'manual').length
  return (
    <div className="stack">
      <div className="row between"><PeriodNav p={p} setP={setP} /><button className="btn light sm" onClick={exportCsv}><Download size={15} /> Hours CSV</button></div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Hours by person (this period)"><Bars data={hours.map(({ u, h }) => ({ label: u.name, value: r2(h.total), sub: h.overtime ? `${h.overtime} h overtime` : undefined }))} fmt={(n) => `${n.toFixed(2)} h`} /></Card>
        <Card title="Time clock health">
          <div className="grid g2">
            <Stat label="Entries" value={onSite.length} />
            <Stat label="Manual / edited" value={`${manual} / ${onSite.filter((t) => t.history.length).length}`} sub="missed clock-ins and fixes" />
            <Stat label="Clocked hours" value={r2(onSite.reduce((n, t) => n + entryHours(t), 0))} />
            <Stat label="Avg visit" value={hrs(onSite.length ? onSite.reduce((n, t) => n + entryHours(t), 0) / onSite.length : 0)} />
          </div>
        </Card>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Billed vs. labor by month">
          {months.length ? <div className="table-wrap"><table><thead><tr><th>Month</th><th className="num">Billed</th><th className="num">Collected</th><th className="num">Gross wages</th><th className="num">Margin</th></tr></thead>
            <tbody>{months.map(([k, v]) => { const l = laborByMonth(k); return <tr key={k}><td>{new Date(k + '-15').toLocaleString(undefined, { month: 'short', year: 'numeric' })}</td><td className="num">{money(v.billed)}</td><td className="num">{money(v.paid)}</td><td className="num">{money(l)}</td><td className="num">{v.billed ? `${Math.round(((v.billed - l) / v.billed) * 100)}%` : '—'}</td></tr> })}</tbody></table></div> : <Empty>No invoices yet.</Empty>}
        </Card>
        <Card title="Top clients (billed)"><Bars data={topClients.map(({ c, v }) => ({ label: c.household, value: r2(v) }))} fmt={money} /></Card>
      </div>
    </div>
  )
}

/* ---------------- settings ---------------- */
export function SettingsPage() {
  const { state, update, toast, reset, replace } = useStore()
  const s = state.settings
  const [health, setHealth] = useState<string | null>(null)
  const set = (patch: Partial<typeof s>) => update((d) => void Object.assign(d.settings, patch))
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <Card title="Time clock">
        <div className="form-grid">
          <Field label="Geofence radius (meters)" hint="How close to the client’s home an employee must be to clock in"><input type="number" min={25} step={25} value={s.geofenceMeters} onChange={(e) => set({ geofenceMeters: Number(e.target.value) })} /></Field>
          <label className="check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={s.simulateOnSite} onChange={(e) => set({ simulateOnSite: e.target.checked })} /> Simulate being on-site (demo: testers aren’t in Moscow)</label>
        </div>
      </Card>
      <Card title="AI assistant">
        <div className="form-grid">
          <Field label="Provider" full>
            <select value={s.aiProvider} onChange={(e) => set({ aiProvider: e.target.value as typeof s.aiProvider })}>
              <option value="offline">Built-in (offline: searches the docs and app data, no network)</option>
              <option value="bridge">Claude via local bridge (proof of concept: Rob’s Claude Code)</option>
              <option value="anthropic">Anthropic API key (direct from this browser)</option>
            </select>
          </Field>
          {s.aiProvider === 'bridge' && <>
            <Field label="Bridge URL"><input value={s.bridgeUrl} onChange={(e) => set({ bridgeUrl: e.target.value })} /></Field>
            <Field label="Bridge token"><input type="password" value={s.bridgeToken} onChange={(e) => set({ bridgeToken: e.target.value })} autoComplete="off" /></Field>
            <div className="full row">
              <button className="btn light sm" onClick={async () => { setHealth('Checking…'); const r = await bridgeHealth(s.bridgeUrl, s.bridgeToken); setHealth(r.detail) }}>Test connection</button>
              {health && <span className="small">{health}</span>}
            </div>
            <div className="tiny muted full">Run <code>npm run bridge</code> in the repo on the computer with Claude Code. It answers only GIST questions: no tools, no files, no MCP, a fixed GIST system prompt.</div>
          </>}
          {s.aiProvider === 'anthropic' && <>
            <Field label="API key" hint="Stored only on this device"><input type="password" value={s.anthropicKey} onChange={(e) => set({ anthropicKey: e.target.value })} autoComplete="off" /></Field>
            <Field label="Model"><input value={s.anthropicModel} onChange={(e) => set({ anthropicModel: e.target.value })} /></Field>
          </>}
        </div>
      </Card>
      <Card title="Demo data">
        <p className="small muted">Everything is stored on this device only. Export a backup, load one, or start over.</p>
        <div className="row">
          <button className="btn light sm" onClick={() => saveText(JSON.stringify({ ...state, settings: { ...state.settings, anthropicKey: '', bridgeToken: '' } }, null, 1), `gist-hub-backup-${today()}.json`, 'application/json')}><Download size={15} /> Export backup</button>
          <button className="btn light sm" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import backup</button>
          <button className="btn light sm" onClick={() => { if (confirm('Reset all demo data to the starting point?')) { reset(); toast('Demo data reset') } }}>Reset demo</button>
        </div>
        <input ref={fileRef} type="file" accept=".json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const j = JSON.parse(await f.text()) as State
            if (!j.users || !j.shifts) throw new Error('Not a GIST Hub backup')
            replace({ ...j, settings: { ...state.settings, ...j.settings, anthropicKey: state.settings.anthropicKey, bridgeToken: state.settings.bridgeToken } })
            toast('Backup loaded')
          } catch (err) { toast((err as Error).message) }
        }} />
      </Card>
      <Card title="Policies used for pay">
        <div className="grid g3 small">
          <div>Default rate <b>{money(POLICY.defaultRate)}/hr</b></div>
          <div>Overtime over <b>{POLICY.overtimeAfterWeeklyHours} h/week</b> at {POLICY.overtimeMultiplier}×</div>
          <div>PTO <b>1 h per {POLICY.ptoHoursPer} h</b> worked</div>
          <div>Supply card <b>{money(POLICY.supplyCard)}</b> / period</div>
          <div>Gas card <b>{money(POLICY.gasCard)}</b> / period</div>
          <div>Mileage <b>{money(POLICY.mileageRate)}/mi</b></div>
          <div>Pay periods <b>1st–15th, 16th–end</b></div>
          <div>Payday <b>{POLICY.payDelayDays} days</b> after period end</div>
          <div>Idaho withholding ≈ <b>{(POLICY.idahoRate * 100).toFixed(1)}%</b></div>
        </div>
      </Card>
    </div>
  )
}

