// Employee side: what GIST's team uses Gusto for today (time clock, schedule, availability,
// time off, pay, expenses, cards, onboarding) plus each home's SOP checklist.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle, CalendarPlus, Camera, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, CreditCard, Download, Fuel, History, LogIn, LogOut, MapPin,
  Navigation, PenLine, Pencil, Plus, Printer, Send, ShoppingBag,
} from 'lucide-react'
import { useStore, clientOf, userName } from '../lib/store'
import type { Availability, Expense, Paystub, Shift, Task, TimeEntry, TimeOff, User, W4 } from '../lib/types'
import { addDays, fmtDateTime, fmtDay, fmtTime, hhmm, hoursBetween, hrs, isoAt, money, parseYmd, shiftHours, startOfWeek, today, uid, weekdayLong, weekdayShort } from '../lib/dates'
import { POLICY, computeStub, entryDay, entryHours, hoursFor, nextPeriod, periodFor, prevPeriod, ptoBalance, taxTotal, type Period } from '../lib/payroll'
import { checkSite, mapsLink } from '../lib/geo'
import { shiftsToIcs } from '../lib/ics'
import { fileToDataUrl, saveText } from '../lib/download'
import { docBySlug, parseChecklist } from '../lib/docs'
import { AiButton } from '../components/AiChat'
import { Badge, Card, DateBox, Empty, Field, Modal, Progress, Stat, Tabs } from '../components/ui'
import { SIGNABLE } from './Docs'

/* ---------------- helpers ---------------- */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms)
    return () => window.clearInterval(t)
  }, [ms])
  return now
}

const dur = (h: number) => {
  const s = Math.max(0, Math.floor(h * 3600))
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function myShifts(shifts: Shift[], id: string) {
  return shifts.filter((s) => s.employeeId === id && s.published)
}

export function ShiftRow({ s, showWho }: { s: Shift; showWho?: boolean }) {
  const { state } = useStore()
  const c = clientOf(state, s.clientId)
  return (
    <Link to={`/app/shift/${s.id}`} className="list-item">
      <DateBox date={s.date} />
      <div className="grow">
        <div className="title">{c?.household || 'Client'}</div>
        <div className="meta">
          {fmtDay(s.date, { weekday: true })} · {fmtTime(s.start)}–{fmtTime(s.end)} · {shiftHours(s)} hrs
          {showWho && ` · ${userName(state, s.employeeId)}`}
        </div>
      </div>
      {!s.employeeId && <Badge tone="warn">open</Badge>}
      {!s.published && <Badge tone="info">draft</Badge>}
    </Link>
  )
}

/* ---------------- clock ---------------- */
export function ClockCard() {
  const { state, me, update, toast } = useStore()
  const now = useNow()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fixOpen, setFixOpen] = useState(false)
  if (!me) return null
  const t = today()
  const open = state.time.find((x) => x.employeeId === me.id && !x.clockOut)
  const todays = myShifts(state.shifts, me.id).filter((s) => s.date === t)
  const doneIds = new Set(state.time.filter((x) => x.employeeId === me.id && x.clockOut).map((x) => x.shiftId))
  const next = todays.find((s) => !doneIds.has(s.id) && s.id !== open?.shiftId)
  const openShift = open && state.shifts.find((s) => s.id === open.shiftId)
  const target = clientOf(state, open?.clientId || next?.clientId)
  const stale = open && openShift && Date.now() - +new Date(isoAt(openShift.date, openShift.end)) > 2 * 3600e3
  const radius = state.settings.geofenceMeters

  async function clock(dir: 'in' | 'out') {
    if (!target) return
    setBusy(true)
    setErr(null)
    try {
      const r = await checkSite(target, radius, state.settings.simulateOnSite)
      if (dir === 'in') {
        if (!r.onSite) {
          setErr(`You’re ${r.distance} m from ${target.household}. Clock in when you arrive — only on-site time counts (limit ${radius} m).`)
          return
        }
        update((d) =>
          void d.time.push({
            id: uid('te'), employeeId: me!.id, shiftId: next?.id, clientId: target.id, clockIn: new Date().toISOString(), breakMinutes: 0, source: 'clock',
            onSite: true, distanceM: r.distance, status: 'open', note: '', history: [],
          }),
        )
        toast(`Clocked in at ${target.household}`)
      } else {
        update((d) => {
          const e = d.time.find((x) => x.id === open!.id)!
          e.clockOut = new Date().toISOString()
          if (!r.onSite) e.history.push({ at: e.clockOut, byId: me!.id, change: `Clocked out ${r.distance} m from the client`, note: 'Location check at clock-out was off-site.' })
        })
        toast('Clocked out — nice work!')
      }
    } catch (e) {
      setErr(`Couldn’t get your location: ${(e as Error).message}. Allow location, or ask the owner to turn on “Simulate on-site” for the demo.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card clock-card">
      {open ? (
        <>
          <div className="small muted">Clocked in at {target?.household} since {fmtTime(open.clockIn)}</div>
          <div className="big mt" aria-live="off">{dur(hoursBetween(open.clockIn, new Date(now)))}</div>
          <div className="geo small muted mt">
            <MapPin size={14} /> on site ({open.distanceM ?? 0} m away){state.settings.simulateOnSite && ' · simulated location'}
          </div>
          {stale ? (
            <div className="notice warn mt" style={{ color: 'var(--ink)' }}>
              <AlertTriangle size={16} /> Looks like you forgot to clock out after your {fmtTime(openShift!.end)} shift.
              <button className="btn sm mt" style={{ background: 'var(--navy)', color: '#fff' }} onClick={() => setFixOpen(true)}>
                Set clock-out to scheduled end
              </button>
            </div>
          ) : (
            <div className="row mt">
              <button className="btn lg out" disabled={busy} onClick={() => clock('out')}>
                <LogOut size={18} /> {busy ? 'Checking location…' : 'Clock out'}
              </button>
              {openShift && (
                <Link className="btn ghost" to={`/app/shift/${openShift.id}`}>
                  Checklist
                </Link>
              )}
            </div>
          )}
        </>
      ) : next && target ? (
        <>
          <div className="small muted">Next today</div>
          <h2 style={{ margin: '4px 0' }}>{target.household}</h2>
          <div className="muted small">
            {fmtTime(next.start)}–{fmtTime(next.end)} · {target.address}
          </div>
          <div className="row mt">
            <button className="btn lg" disabled={busy} onClick={() => clock('in')}>
              <LogIn size={18} /> {busy ? 'Checking location…' : 'Clock in'}
            </button>
            <a className="btn ghost" href={mapsLink(target.address)} target="_blank" rel="noreferrer">
              <Navigation size={16} /> Directions
            </a>
            <Link className="btn ghost" to={`/app/shift/${next.id}`}>
              Details
            </Link>
          </div>
          <div className="geo tiny muted mt">
            <MapPin size={13} /> Clock-in works within {radius} m of the home{state.settings.simulateOnSite ? ' (demo: location simulated)' : ''}.
          </div>
        </>
      ) : (
        <>
          <div className="small muted">Time clock</div>
          <h2 style={{ margin: '4px 0' }}>{todays.length ? 'All done for today 🎉' : 'No shifts today'}</h2>
          <div className="muted small">Your next shifts are below. You can only clock in for a scheduled shift, at the client’s home.</div>
        </>
      )}
      {err && <div className="notice danger mt" style={{ color: 'var(--ink)' }}>{err}</div>}
      {fixOpen && open && openShift && <FixClockOut entry={open} shift={openShift} onClose={() => setFixOpen(false)} />}
    </div>
  )
}

function FixClockOut({ entry, shift, onClose }: { entry: TimeEntry; shift: Shift; onClose: () => void }) {
  const { me, update, toast } = useStore()
  const [note, setNote] = useState('Forgot to clock out — set to my scheduled end time.')
  return (
    <Modal
      title="Fix a missed clock-out"
      onClose={onClose}
      footer={
        <>
          <button className="btn light" onClick={onClose}>Cancel</button>
          <button
            className="btn sage"
            disabled={note.trim().length < 5}
            onClick={() => {
              update((d) => {
                const e = d.time.find((x) => x.id === entry.id)!
                e.clockOut = isoAt(shift.date, shift.end)
                e.history.push({ at: new Date().toISOString(), byId: me!.id, change: `Clock-out set to scheduled end ${fmtTime(shift.end)}`, note: note.trim() })
              })
              toast('Clock-out fixed')
              onClose()
            }}
          >
            Save
          </button>
        </>
      }
    >
      <p>
        Change your clock-out to the scheduled end, <b>{fmtTime(shift.end)}</b> on {fmtDay(shift.date, { weekday: true })}? A note is required and the change is kept in the
        entry’s history for your manager.
      </p>
      <Field label="Note">
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  )
}

/* ---------------- dashboard ---------------- */
export function EmployeeDashboard() {
  const { state, me } = useStore()
  if (!me) return null
  const t = today()
  const upcoming = myShifts(state.shifts, me.id).filter((s) => s.date >= t).slice(0, 5)
  const tasks = state.tasks.filter((x) => x.userId === me.id && !x.done)
  const p = periodFor(t)
  const h = hoursFor(state, me.id, p)
  const est = computeStub(state, me, p, 'preview', false)
  const pto = ptoBalance(state, me)
  const openShifts = state.shifts.filter((s) => !s.employeeId && s.published && s.date >= t)
  const onboardingLeft = me.onboarding ? Object.values(me.onboarding).filter((v) => !v).length : 0
  return (
    <div className="stack">
      <div>
        <h2 style={{ marginBottom: 0 }}>Hi {me.name.split(' ')[0]} 👋</h2>
        <div className="muted small">{fmtDay(t, { weekday: true, year: true })}</div>
      </div>
      {onboardingLeft > 0 && (
        <Link to="/app/onboarding" className="notice warn" style={{ textDecoration: 'none' }}>
          <AlertTriangle size={16} /> Finish onboarding — {onboardingLeft} step{onboardingLeft > 1 ? 's' : ''} left before your first shift.
        </Link>
      )}
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <ClockCard />
        <div className="grid g2">
          <Stat label="Hours this period" value={h.total.toFixed(2)} sub={`${p.label}`} />
          <Stat label="Est. next paycheck" value={money(est.net)} sub={`Payday ${fmtDay(p.payDate, { weekday: true })}`} />
          <Stat label="PTO balance" value={`${pto.balance.toFixed(2)} h`} sub={`+${pto.pendingAccrual.toFixed(2)} h accruing`} />
          <Stat label="Open tasks" value={tasks.length} sub={<Link to="/app/tasks">View tasks</Link>} />
        </div>
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Upcoming shifts" action={<Link className="small" to="/app/schedule">Full schedule</Link>}>
          {upcoming.length ? <div className="list">{upcoming.map((s) => <ShiftRow key={s.id} s={s} />)}</div> : <Empty>No upcoming shifts.</Empty>}
          {openShifts.length > 0 && (
            <Link to="/app/schedule" className="notice mt" style={{ textDecoration: 'none' }}>
              {openShifts.length} open shift{openShifts.length > 1 ? 's' : ''} available to claim →
            </Link>
          )}
        </Card>
        <Card title="To do" action={<Link className="small" to="/app/tasks">All</Link>}>
          {tasks.length ? <TaskList tasks={tasks.slice(0, 5)} /> : <Empty>You’re all caught up.</Empty>}
        </Card>
      </div>
    </div>
  )
}

/* ---------------- tasks ---------------- */
function TaskList({ tasks }: { tasks: Task[] }) {
  const { update } = useStore()
  return (
    <div className="list">
      {tasks.map((t) => (
        <div key={t.id} className="list-item">
          <button className="icon-btn" aria-label={t.done ? 'Mark not done' : 'Mark done'} onClick={() => update((d) => void (d.tasks.find((x) => x.id === t.id)!.done = !t.done))}>
            {t.done ? <CheckCircle2 color="var(--ok)" /> : <Circle />}
          </button>
          <div className="grow">
            <div className="title" style={t.done ? { textDecoration: 'line-through', color: 'var(--muted)' } : undefined}>
              {t.link ? <Link to={t.link}>{t.title}</Link> : t.title}
            </div>
            <div className="meta">
              {t.detail} {t.due && `· due ${fmtDay(t.due, { weekday: true })}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function Tasks() {
  const { state, me } = useStore()
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const mine = state.tasks.filter((t) => t.userId === me?.id && (tab === 'done' ? t.done : !t.done))
  return (
    <Card>
      <Tabs tabs={[{ id: 'open', label: 'To do' }, { id: 'done', label: 'Done' }]} value={tab} onChange={setTab} />
      {mine.length ? <TaskList tasks={mine} /> : <Empty>{tab === 'open' ? 'Nothing to do — nice.' : 'Nothing completed yet.'}</Empty>}
    </Card>
  )
}

/* ---------------- schedule ---------------- */
export function WeekNav({ week, setWeek }: { week: string; setWeek: (w: string) => void }) {
  return (
    <div className="row nowrap">
      <button className="btn light sm icon" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week">
        <ChevronLeft size={18} />
      </button>
      <button className="btn light sm" onClick={() => setWeek(startOfWeek(today()))}>
        This week
      </button>
      <button className="btn light sm icon" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week">
        <ChevronRight size={18} />
      </button>
      <b className="small nowrap">
        {fmtDay(week)} – {fmtDay(addDays(week, 6), { year: true })}
      </b>
    </div>
  )
}

export function WeekGrid({ week, shifts, onPick, showWho }: { week: string; shifts: Shift[]; onPick: (s: Shift) => void; showWho?: boolean }) {
  const { state } = useStore()
  const t = today()
  return (
    <div className="week">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const day = addDays(week, i)
        const ds = shifts.filter((s) => s.date === day)
        return (
          <div key={day} className={`day${day === t ? ' today' : ''}`}>
            <div className="dh">
              <span>{weekdayShort(i)}</span>
              <span>{parseYmd(day).getDate()}</span>
            </div>
            {ds.map((s) => (
              <button key={s.id} className={`shift-chip${!s.employeeId ? ' open' : ''}${!s.published ? ' draft' : ''}`} onClick={() => onPick(s)}>
                <b>{clientOf(state, s.clientId)?.household.replace(' Household', '')}</b>
                <span className="t">
                  {fmtTime(s.start)}–{fmtTime(s.end)}
                </span>
                {showWho && <div className="t">{s.employeeId ? userName(state, s.employeeId).split(' ')[0] : 'Open'}</div>}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function EmployeeSchedule() {
  const { state, me, update, notify, toast } = useStore()
  const nav = useNavigate()
  const [week, setWeek] = useState(startOfWeek(today()))
  const [view, setView] = useState<'week' | 'list'>(() => (window.innerWidth < 700 ? 'list' : 'week'))
  if (!me) return null
  const mine = myShifts(state.shifts, me.id)
  const open = state.shifts.filter((s) => !s.employeeId && s.published && s.date >= today())
  const inWeek = [...mine, ...open].filter((s) => s.date >= week && s.date <= addDays(week, 6))
  return (
    <div className="stack">
      <div className="row between">
        <WeekNav week={week} setWeek={setWeek} />
        <div className="row">
          <Tabs tabs={[{ id: 'week', label: 'Week' }, { id: 'list', label: 'List' }]} value={view} onChange={setView} />
          <button
            className="btn light sm"
            onClick={() => {
              saveText(shiftsToIcs(mine.filter((s) => s.date >= today()), state.clients), 'gist-shifts.ics', 'text/calendar')
              toast('Calendar file saved — open it to add your shifts')
            }}
          >
            <CalendarPlus size={15} /> Add to calendar
          </button>
        </div>
      </div>
      {view === 'week' ? (
        <WeekGrid week={week} shifts={inWeek} onPick={(s) => nav(`/app/shift/${s.id}`)} />
      ) : (
        <Card>{inWeek.length ? <div className="list">{inWeek.map((s) => <ShiftRow key={s.id} s={s} />)}</div> : <Empty>No shifts this week.</Empty>}</Card>
      )}
      {open.length > 0 && (
        <Card title="Open shifts you can claim">
          <div className="list">
            {open.map((s) => (
              <div key={s.id} className="list-item">
                <DateBox date={s.date} />
                <div className="grow">
                  <div className="title">{clientOf(state, s.clientId)?.household}</div>
                  <div className="meta">
                    {fmtDay(s.date, { weekday: true })} · {fmtTime(s.start)}–{fmtTime(s.end)} · {s.note}
                  </div>
                </div>
                <button
                  className="btn sage sm"
                  onClick={() => {
                    update((d) => {
                      const x = d.shifts.find((y) => y.id === s.id)!
                      x.employeeId = me.id
                      x.note = `Claimed by ${me.name}`
                      notify(d, 'u_owner', `${me.name} claimed the open shift at ${clientOf(d, s.clientId)?.household} on ${fmtDay(s.date)}.`, '/app/schedule')
                    })
                    toast('Shift claimed — it’s on your schedule')
                  }}
                >
                  Claim
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ---------------- shift detail + SOP checklist ---------------- */
export function ShiftDetail() {
  const { id = '' } = useParams()
  const { state, me, role, update } = useStore()
  const s = state.shifts.find((x) => x.id === id)
  const c = clientOf(state, s?.clientId)
  const sop = c?.sopSlug ? docBySlug(c.sopSlug) : undefined
  const sections = useMemo(() => (sop ? parseChecklist(sop.md) : []), [sop])
  if (!s || !c) return <Empty>Shift not found.</Empty>
  const prog = s.checklist || {}
  const total = sections.reduce((n, x) => n + x.items.length, 0)
  const done = Object.values(prog).filter(Boolean).length
  const entries = state.time.filter((t) => t.shiftId === s.id)
  const canTick = role !== 'client'
  const toggle = (k: string) => update((d) => {
    const x = d.shifts.find((y) => y.id === s.id)!
    x.checklist = { ...(x.checklist || {}), [k]: !(x.checklist || {})[k] }
  })
  return (
    <div className="stack">
      <Link to={role === 'owner' ? '/app/schedule' : '/app/schedule'} className="small row" style={{ gap: 4 }}>
        <ChevronLeft size={16} /> Schedule
      </Link>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title={c.household} action={!s.employeeId ? <Badge tone="warn">open</Badge> : <Badge tone="ok">{userName(state, s.employeeId)}</Badge>}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row"><Clock size={16} /> {fmtDay(s.date, { weekday: true, year: true })} · {fmtTime(s.start)}–{fmtTime(s.end)} ({shiftHours(s)} hrs)</div>
            <a className="row" href={mapsLink(c.address)} target="_blank" rel="noreferrer"><MapPin size={16} /> {c.address}</a>
            {s.note && <div className="notice small">{s.note}</div>}
            <div className="small"><b>Pets:</b> {c.pets || 'None'}</div>
            {c.notes && <div className="small"><b>Notes:</b> {c.notes}</div>}
            <div className="small"><b>Add-ons:</b> {c.addOns.length ? c.addOns.join(', ') : 'none'}</div>
            {sop && <Link className="btn light sm" to={`/app/docs/${sop.slug}`} style={{ alignSelf: 'flex-start' }}>Open the full SOP</Link>}
            {me?.id === s.employeeId && s.date === today() && <ClockCard />}
          </div>
          {entries.length > 0 && (
            <>
              <h4 className="mt">Time on this shift</h4>
              {entries.map((e) => (
                <div key={e.id} className="small">
                  {fmtTime(e.clockIn)}–{e.clockOut ? fmtTime(e.clockOut) : 'now'} · {hrs(entryHours(e))} · <Badge>{e.status}</Badge>
                </div>
              ))}
            </>
          )}
        </Card>
        <Card title="Checklist" action={total ? <span className="small muted">{done}/{total}</span> : undefined}>
          {total ? (
            <>
              <Progress value={done / total} />
              <div className="checklist">
                {sections.map((sec) => {
                  const d = sec.items.filter((i) => prog[i.id]).length
                  return (
                    <div key={sec.title}>
                      <h4>
                        <span>{sec.title}</span>
                        <span className="tiny muted">{d}/{sec.items.length}</span>
                      </h4>
                      {sec.items.map((i) => (
                        <label key={i.id} className={`${prog[i.id] ? 'done' : ''} d${i.depth}`}>
                          <input type="checkbox" checked={!!prog[i.id]} disabled={!canTick} onChange={() => toggle(i.id)} />
                          <span>{i.text}</span>
                        </label>
                      ))}
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <Empty>This home has no checklist yet.</Empty>
          )}
        </Card>
      </div>
    </div>
  )
}

/* ---------------- availability ---------------- */
export function AvailabilityPage() {
  const { state, me, update, toast } = useStore()
  const cur = state.availability.find((a) => a.employeeId === me?.id)
  const [a, setA] = useState<Availability>(() => cur || { employeeId: me!.id, weekly: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, kind: 'all' as const })), notes: '', updatedAt: today() })
  if (!me) return null
  const setDay = (day: number, patch: Partial<Availability['weekly'][0]>) => setA({ ...a, weekly: a.weekly.map((w) => (w.day === day ? { ...w, ...patch } : w)) })
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <div className="notice">Schedules are built a week ahead from your availability. Last updated {fmtDay(a.updatedAt, { year: true })}.</div>
      <Card>
        <div className="list">
          {a.weekly.map((w) => (
            <div key={w.day} className="list-item" style={{ flexWrap: 'wrap' }}>
              <b style={{ width: 110 }}>{weekdayLong(w.day)}</b>
              <div className="chips">
                {(['all', 'custom', 'none'] as const).map((k) => (
                  <button key={k} className={`chip${w.kind === k ? ' on' : ''}`} onClick={() => setDay(w.day, { kind: k, from: w.from || '09:00', to: w.to || '15:00' })}>
                    {k === 'all' ? 'All day' : k === 'none' ? 'Unavailable' : 'Custom'}
                  </button>
                ))}
              </div>
              {w.kind === 'custom' && (
                <div className="row nowrap">
                  <input type="time" value={w.from} onChange={(e) => setDay(w.day, { from: e.target.value })} aria-label={`${weekdayLong(w.day)} from`} />
                  –
                  <input type="time" value={w.to} onChange={(e) => setDay(w.day, { to: e.target.value })} aria-label={`${weekdayLong(w.day)} to`} />
                </div>
              )}
            </div>
          ))}
        </div>
        <Field label="Notes for your manager">
          <textarea rows={3} value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} placeholder="e.g. kids’ pickup at 3:30 Wednesdays" />
        </Field>
        <button
          className="btn sage mt"
          onClick={() => {
            update((d) => {
              const next = { ...a, updatedAt: today() }
              const i = d.availability.findIndex((x) => x.employeeId === me.id)
              if (i >= 0) d.availability[i] = next
              else d.availability.push(next)
              d.tasks.filter((t) => t.userId === me.id && t.kind === 'availability').forEach((t) => (t.done = true))
              d.notices.unshift({ id: uid('n'), userId: 'u_owner', text: `${me.name} updated their availability.`, at: new Date().toISOString(), read: false, link: `/app/team/${me.id}` })
            })
            toast('Availability saved')
          }}
        >
          Save availability
        </button>
      </Card>
    </div>
  )
}

/* ---------------- time ---------------- */
export function PeriodNav({ p, setP }: { p: Period; setP: (p: Period) => void }) {
  return (
    <div className="row nowrap">
      <button className="btn light sm icon" onClick={() => setP(prevPeriod(p))} aria-label="Previous pay period"><ChevronLeft size={18} /></button>
      <b className="small nowrap">{p.label}</b>
      <button className="btn light sm icon" onClick={() => setP(nextPeriod(p))} aria-label="Next pay period"><ChevronRight size={18} /></button>
    </div>
  )
}

export function TimePage({ employeeId }: { employeeId?: string }) {
  const { state, me, update, notify, toast } = useStore()
  const id = employeeId || me!.id
  const emp = state.users.find((u) => u.id === id)!
  const [p, setP] = useState(periodFor(today()))
  const [edit, setEdit] = useState<TimeEntry | 'new' | null>(null)
  const [hist, setHist] = useState<TimeEntry | null>(null)
  const entries = state.time.filter((t) => t.employeeId === id && entryDay(t) >= p.start && entryDay(t) <= p.end).sort((a, b) => b.clockIn.localeCompare(a.clockIn))
  const h = hoursFor(state, id, p)
  const unsubmitted = entries.filter((e) => e.status === 'open' && e.clockOut)
  const daysLeft = Math.round((+parseYmd(p.end) - +parseYmd(today())) / 864e5)
  const isMe = id === me?.id
  return (
    <div className="stack">
      <div className="row between">
        <PeriodNav p={p} setP={setP} />
        {isMe && (
          <div className="row">
            <button className="btn light sm" onClick={() => setEdit('new')}><Plus size={15} /> Add missed time</button>
            <button
              className="btn sage sm"
              disabled={!unsubmitted.length}
              onClick={() => {
                update((d) => {
                  d.time.filter((t) => unsubmitted.some((u) => u.id === t.id)).forEach((t) => (t.status = 'submitted'))
                  d.tasks.filter((t) => t.userId === id && t.kind === 'timesheet' && !t.done).forEach((t) => (t.done = true))
                  notify(d, 'u_owner', `${emp.name} submitted ${hrs(unsubmitted.reduce((s, e) => s + entryHours(e), 0))} for ${p.label}.`, '/app/approvals')
                })
                toast('Hours submitted for approval')
              }}
            >
              <Send size={15} /> Submit hours ({unsubmitted.length})
            </button>
          </div>
        )}
      </div>
      <div className="grid g4">
        <Stat label="Total hours" value={h.total.toFixed(2)} />
        <Stat label="Regular" value={h.regular.toFixed(2)} />
        <Stat label="Overtime (1.5×)" value={h.overtime.toFixed(2)} sub="Over 40 hrs in a Sun–Sat week" />
        <Stat label="Hours due by" value={fmtDay(p.end, { weekday: true })} sub={daysLeft >= 0 ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'period closed'} />
      </div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Client</th>
                <th>In</th>
                <th>Out</th>
                <th className="num">Hours</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="nowrap">{fmtDay(entryDay(e), { weekday: true })}</td>
                  <td>{clientOf(state, e.clientId)?.household.replace(' Household', '') || '—'}</td>
                  <td>{fmtTime(e.clockIn)}</td>
                  <td>{e.clockOut ? fmtTime(e.clockOut) : <Badge tone="info">on the clock</Badge>}</td>
                  <td className="num">{entryHours(e).toFixed(2)}</td>
                  <td>
                    <Badge>{e.status}</Badge> {e.source === 'manual' && <Badge tone="info">manual</Badge>} {!e.onSite && <Badge tone="danger">off-site</Badge>}
                  </td>
                  <td className="nowrap right">
                    {e.history.length > 0 && (
                      <button className="icon-btn" title="Edit history" aria-label="Edit history" onClick={() => setHist(e)}><History size={16} /></button>
                    )}
                    {(e.status === 'open' || e.status === 'rejected' || !isMe) && e.clockOut && (
                      <button className="icon-btn" title="Edit" aria-label="Edit entry" onClick={() => setEdit(e)}><Pencil size={16} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length && <Empty>No time in this period.</Empty>}
      </Card>
      {edit && <EditEntry employeeId={id} entry={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
      {hist && (
        <Modal title="Edit history" onClose={() => setHist(null)}>
          <div className="list">
            {hist.history.map((x, i) => (
              <div key={i} className="list-item">
                <div>
                  <div className="title">{x.change}</div>
                  <div className="meta">{userName(state, x.byId)} · {fmtDateTime(x.at)}</div>
                  <div className="small">“{x.note}”</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}

function EditEntry({ employeeId, entry, onClose }: { employeeId: string; entry?: TimeEntry; onClose: () => void }) {
  const { state, me, update, toast } = useStore()
  const [day, setDay] = useState(entry ? entryDay(entry) : today())
  const [inT, setIn] = useState(entry ? hhmm(new Date(entry.clockIn)) : '09:00')
  const [outT, setOut] = useState(entry?.clockOut ? hhmm(new Date(entry.clockOut)) : '11:30')
  const [clientId, setClient] = useState(entry?.clientId || state.clients[0]?.id)
  const [brk, setBrk] = useState(entry?.breakMinutes || 0)
  const [note, setNote] = useState('')
  const valid = note.trim().length >= 5 && outT > inT
  return (
    <Modal
      title={entry ? 'Edit time entry' : 'Add missed time'}
      onClose={onClose}
      footer={
        <>
          <button className="btn light" onClick={onClose}>Cancel</button>
          <button
            className="btn sage"
            disabled={!valid}
            onClick={() => {
              update((d) => {
                const now = new Date().toISOString()
                if (entry) {
                  const e = d.time.find((x) => x.id === entry.id)!
                  const before = `${fmtTime(e.clockIn)}–${e.clockOut ? fmtTime(e.clockOut) : '?'}`
                  e.clockIn = isoAt(day, inT)
                  e.clockOut = isoAt(day, outT)
                  e.breakMinutes = brk
                  e.clientId = clientId
                  if (e.status === 'rejected') e.status = 'open'
                  e.history.push({ at: now, byId: me!.id, change: `Changed ${before} → ${fmtTime(inT)}–${fmtTime(outT)}${brk ? ` (${brk} min break)` : ''}`, note: note.trim() })
                } else {
                  d.time.push({
                    id: uid('te'), employeeId, clientId, clockIn: isoAt(day, inT), clockOut: isoAt(day, outT), breakMinutes: brk, source: 'manual', onSite: true, status: 'open', note: note.trim(),
                    history: [{ at: now, byId: me!.id, change: `Added manually: ${fmtTime(inT)}–${fmtTime(outT)}`, note: note.trim() }],
                  })
                }
              })
              toast('Saved — your manager will see the note')
              onClose()
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Day"><input type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Client">
          <select value={clientId} onChange={(e) => setClient(e.target.value)}>
            {state.clients.map((c) => <option key={c.id} value={c.id}>{c.household}</option>)}
          </select>
        </Field>
        <Field label="Clock in"><input type="time" value={inT} onChange={(e) => setIn(e.target.value)} /></Field>
        <Field label="Clock out"><input type="time" value={outT} onChange={(e) => setOut(e.target.value)} /></Field>
        <Field label="Unpaid break (minutes)"><input type="number" min={0} step={5} value={brk} onChange={(e) => setBrk(Number(e.target.value))} /></Field>
        <Field label="Reason (required)" full hint="Every change is kept in the entry’s history.">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. phone died before I could clock in" />
        </Field>
      </div>
    </Modal>
  )
}

/* ---------------- pay ---------------- */
export function StubView({ stub, user }: { stub: Paystub; user: User }) {
  const reimb = stub.reimbursements.reduce((s, r) => s + r.amount, 0)
  return (
    <div className="stub">
      <div className="hdr">
        <div>
          <div className="serif" style={{ fontSize: '1.3rem', color: 'var(--navy)' }}>GIST Cleaning LLC</div>
          <div className="tiny muted">Moscow, ID · Earnings statement</div>
        </div>
        <div className="right">
          <div><b>{user.name}</b></div>
          <div className="tiny muted">{user.title}</div>
        </div>
      </div>
      <div className="grid g3 small" style={{ margin: '12px 0' }}>
        <div><div className="muted tiny">Pay period</div>{fmtDay(stub.periodStart)} – {fmtDay(stub.periodEnd, { year: true })}</div>
        <div><div className="muted tiny">Pay date</div>{fmtDay(stub.payDate, { weekday: true, year: true })}</div>
        <div><div className="muted tiny">Paid by</div>{stub.method === 'check' ? 'Paper check' : `Direct deposit${user.bankLast4 ? ` ••${user.bankLast4}` : ''}`}</div>
      </div>
      <table>
        <thead><tr><th>Earnings</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Regular</td><td className="num">{stub.regularHours.toFixed(2)}</td><td className="num">{money(stub.rate)}</td><td className="num">{money(stub.regularPay)}</td></tr>
          {stub.overtimeHours > 0 && <tr><td>Overtime (1.5×)</td><td className="num">{stub.overtimeHours.toFixed(2)}</td><td className="num">{money(stub.rate * 1.5)}</td><td className="num">{money(stub.overtimePay)}</td></tr>}
          {stub.ptoHours > 0 && <tr><td>Paid time off</td><td className="num">{stub.ptoHours.toFixed(2)}</td><td className="num">{money(stub.rate)}</td><td className="num">{money(stub.ptoPay)}</td></tr>}
          {stub.tips > 0 && <tr><td>Tips (paid in full)</td><td /><td /><td className="num">{money(stub.tips)}</td></tr>}
          <tr><td><b>Gross pay</b></td><td /><td /><td className="num"><b>{money(stub.gross)}</b></td></tr>
        </tbody>
      </table>
      <table className="mt">
        <thead><tr><th>Taxes withheld (estimate)</th><th className="num">Amount</th></tr></thead>
        <tbody>
          <tr><td>Federal income tax</td><td className="num">{money(stub.taxes.federal)}</td></tr>
          <tr><td>Social Security (6.2%)</td><td className="num">{money(stub.taxes.socialSecurity)}</td></tr>
          <tr><td>Medicare (1.45%)</td><td className="num">{money(stub.taxes.medicare)}</td></tr>
          <tr><td>Idaho state income tax</td><td className="num">{money(stub.taxes.state)}</td></tr>
        </tbody>
      </table>
      {stub.reimbursements.length > 0 && (
        <table className="mt">
          <thead><tr><th>Reimbursements (not taxed)</th><th className="num">Amount</th></tr></thead>
          <tbody>{stub.reimbursements.map((r, i) => <tr key={i}><td>{r.label}</td><td className="num">{money(r.amount)}</td></tr>)}</tbody>
        </table>
      )}
      <div className="net">
        <span>Net pay</span>
        <span>{money(stub.net)}</span>
      </div>
      <div className="grid g3 tiny muted mt">
        <div>Taxes: {money(taxTotal(stub))}</div>
        <div>Reimbursed: {money(reimb)}</div>
        <div>PTO accrued: {stub.ptoAccrued.toFixed(2)} h</div>
      </div>
      {(stub.cards.supply > 0 || stub.cards.gas > 0) && (
        <div className="tiny muted mt">Card loads this period (separate from pay): supply {money(stub.cards.supply)} · gas {money(stub.cards.gas)}</div>
      )}
    </div>
  )
}

export function stubText(stub: Paystub, u: User) {
  return [
    `GIST Cleaning LLC — Earnings statement`,
    `${u.name} (${u.title})`,
    `Pay period ${stub.periodStart} to ${stub.periodEnd}, paid ${stub.payDate} by ${stub.method === 'check' ? 'check' : 'direct deposit'}`,
    `Rate ${money(stub.rate)}/hr`,
    `Regular ${stub.regularHours} h = ${money(stub.regularPay)}`,
    stub.overtimeHours ? `Overtime ${stub.overtimeHours} h at 1.5x = ${money(stub.overtimePay)}` : '',
    stub.ptoHours ? `PTO ${stub.ptoHours} h = ${money(stub.ptoPay)}` : '',
    stub.tips ? `Tips ${money(stub.tips)}` : '',
    `Gross ${money(stub.gross)}`,
    `Federal ${money(stub.taxes.federal)}, Social Security ${money(stub.taxes.socialSecurity)}, Medicare ${money(stub.taxes.medicare)}, Idaho ${money(stub.taxes.state)}`,
    ...stub.reimbursements.map((r) => `Reimbursement: ${r.label} ${money(r.amount)}`),
    `Net pay ${money(stub.net)}`,
    `PTO accrued ${stub.ptoAccrued} h; card loads supply ${money(stub.cards.supply)}, gas ${money(stub.cards.gas)}`,
  ]
    .filter(Boolean)
    .join('\n')
}

export function PayPage({ employeeId }: { employeeId?: string }) {
  const { state, me } = useStore()
  const id = employeeId || me!.id
  const u = state.users.find((x) => x.id === id)!
  const [open, setOpen] = useState<Paystub | null>(null)
  const stubs = state.stubs.filter((s) => s.employeeId === id).sort((a, b) => b.payDate.localeCompare(a.payDate))
  const p = periodFor(today())
  const est = computeStub(state, u, p, 'preview', false)
  const ytd = stubs.filter((s) => s.payDate.slice(0, 4) === today().slice(0, 4))
  const sum = (f: (s: Paystub) => number) => ytd.reduce((n, s) => n + f(s), 0)
  return (
    <div className="stack">
      <Card title="Pay tracker — this period" className="butter">
        <div className="grid g4">
          <Stat label="Hours so far" value={est.regularHours + est.overtimeHours} sub={p.label} />
          <Stat label="Est. gross" value={money(est.gross)} />
          <Stat label="Est. take-home" value={money(est.net)} sub="after estimated taxes" />
          <Stat label="Payday" value={fmtDay(p.payDate, { weekday: true })} sub={u.payMethod === 'check' ? 'paper check' : 'direct deposit'} />
        </div>
      </Card>
      <div className="grid g4">
        <Stat label="Gross YTD" value={money(sum((s) => s.gross))} />
        <Stat label="Net YTD" value={money(sum((s) => s.net))} />
        <Stat label="Taxes YTD" value={money(sum(taxTotal))} />
        <Stat label="Tips YTD" value={money(sum((s) => s.tips))} />
      </div>
      <Card title="Paystubs">
        {stubs.length ? (
          <div className="list">
            {stubs.map((s) => (
              <button key={s.id} className="list-item" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => setOpen(s)}>
                <DateBox date={s.payDate} />
                <div className="grow">
                  <div className="title">{money(s.net)} net</div>
                  <div className="meta">{fmtDay(s.periodStart)}–{fmtDay(s.periodEnd, { year: true })} · {(s.regularHours + s.overtimeHours).toFixed(2)} hrs · gross {money(s.gross)}</div>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            ))}
          </div>
        ) : (
          <Empty>No paystubs yet — your first one arrives after your first pay period.</Empty>
        )}
      </Card>
      {open && (
        <Modal
          wide
          title="Paystub"
          onClose={() => setOpen(null)}
          footer={
            <>
              <AiButton task="explain-stub" label="Explain this paystub" prompt="Explain my paystub." extra={stubText(open, u)} className="btn light" />
              <button className="btn light" onClick={() => saveText(stubText(open, u), `paystub-${open.payDate}.txt`)}><Download size={16} /> Download</button>
              <button className="btn" onClick={() => window.print()}><Printer size={16} /> Print / PDF</button>
            </>
          }
        >
          <StubView stub={open} user={u} />
        </Modal>
      )}
    </div>
  )
}

/* ---------------- time off ---------------- */
export function TimeOffPage() {
  const { state, me, update, notify, toast } = useStore()
  const [f, setF] = useState({ start: addDays(today(), 14), end: addDays(today(), 14), hours: 3, type: 'pto' as TimeOff['type'], reason: '' })
  if (!me) return null
  const bal = ptoBalance(state, me)
  const mine = state.timeOff.filter((t) => t.employeeId === me.id).sort((a, b) => b.start.localeCompare(a.start))
  const over = f.type === 'pto' && f.hours > bal.balance
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <div className="grid g2">
          <Stat label="PTO available" value={`${bal.balance.toFixed(2)} h`} sub={`${bal.accrued.toFixed(2)} earned · ${bal.used.toFixed(2)} used`} />
          <Stat label="Accruing this period" value={`+${bal.pendingAccrual.toFixed(2)} h`} sub={`1 h per ${POLICY.ptoHoursPer} h worked`} />
        </div>
        <Card title="Requests">
          {mine.length ? (
            <div className="list">
              {mine.map((t) => (
                <div key={t.id} className="list-item">
                  <DateBox date={t.start} />
                  <div className="grow">
                    <div className="title">{t.type === 'pto' ? 'PTO' : t.type === 'sick' ? 'Sick' : 'Unpaid'} · {t.hours} h</div>
                    <div className="meta">{fmtDay(t.start)}{t.end !== t.start && `–${fmtDay(t.end)}`} · {t.reason}</div>
                  </div>
                  <Badge>{t.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <Empty>No requests yet.</Empty>
          )}
        </Card>
      </div>
      <Card title="Request time off">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            update((d) => {
              d.timeOff.push({ id: uid('to'), employeeId: me.id, ...f, end: f.end < f.start ? f.start : f.end, status: 'pending', createdAt: today() })
              notify(d, 'u_owner', `${me.name} requested ${f.hours} h of ${f.type === 'pto' ? 'PTO' : 'time off'} (${fmtDay(f.start)}).`, '/app/approvals')
            })
            toast('Request sent to your manager')
            setF({ ...f, reason: '' })
          }}
        >
          <Field label="Type" full>
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TimeOff['type'] })}>
              <option value="pto">Paid time off (PTO)</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </Field>
          <Field label="First day"><input type="date" min={today()} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} /></Field>
          <Field label="Last day"><input type="date" min={f.start} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
          <Field label="Hours" hint="Scheduled hours you’ll miss"><input type="number" min={0} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} /></Field>
          <Field label="Reason" full><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required /></Field>
          {over && <div className="notice warn full">That’s more PTO than you have — the extra will be unpaid unless approved otherwise.</div>}
          <div className="notice full small">Per the handbook, request time off as early as you can (ideally before the schedule is built, a week ahead) so your clients can be covered.</div>
          <button className="btn sage full">Send request</button>
        </form>
      </Card>
    </div>
  )
}

/* ---------------- expenses ---------------- */
export function ExpensesPage() {
  const { state, me, update, notify, toast } = useStore()
  const [f, setF] = useState({ date: today(), category: 'mileage' as Expense['category'], miles: 10, amount: 0, description: '', receipt: '' })
  if (!me) return null
  const mine = state.expenses.filter((e) => e.employeeId === me.id).sort((a, b) => b.date.localeCompare(a.date))
  const amount = f.category === 'mileage' ? Math.round(f.miles * POLICY.mileageRate * 100) / 100 : f.amount
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card title="Submit an expense">
        <form
          className="form-grid"
          onSubmit={(e) => {
            e.preventDefault()
            update((d) => {
              d.expenses.push({ id: uid('ex'), employeeId: me.id, date: f.date, category: f.category, amount, miles: f.category === 'mileage' ? f.miles : undefined, description: f.description, receipt: f.receipt || undefined, status: 'pending' })
              notify(d, 'u_owner', `${me.name} submitted a ${money(amount)} ${f.category} expense.`, '/app/approvals')
            })
            toast('Expense submitted — reimbursed on your next paycheck once approved')
            setF({ ...f, description: '', receipt: '', amount: 0 })
          }}
        >
          <Field label="Type">
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Expense['category'] })}>
              <option value="mileage">Mileage (between clients)</option>
              <option value="laundry">Laundry (rags, mop heads)</option>
              <option value="supplies">Supplies (not on supply card)</option>
              <option value="other">Other / tip received</option>
            </select>
          </Field>
          <Field label="Date"><input type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          {f.category === 'mileage' ? (
            <Field label="Miles" hint={`${money(POLICY.mileageRate)}/mile = ${money(amount)}`}><input type="number" min={0} step={0.1} value={f.miles} onChange={(e) => setF({ ...f, miles: Number(e.target.value) })} /></Field>
          ) : (
            <Field label="Amount"><input type="number" min={0} step={0.01} value={f.amount || ''} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} required /></Field>
          )}
          <Field label="Description" full hint={f.category === 'other' ? 'Start with “Tip” for tips received by Venmo etc. — they’re paid out in full on your check.' : undefined}>
            <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />
          </Field>
          <div className="full">
            <label className="btn light sm" style={{ cursor: 'pointer' }}>
              <Camera size={15} /> {f.receipt ? 'Replace receipt photo' : 'Add receipt photo'}
              <input type="file" accept="image/*,application/pdf" capture="environment" hidden onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) setF({ ...f, receipt: await fileToDataUrl(file, 1000) })
              }} />
            </label>
            {f.receipt && f.receipt.startsWith('data:image') && <img src={f.receipt} alt="Receipt preview" style={{ maxHeight: 140, marginTop: 8, borderRadius: 8 }} />}
          </div>
          <button className="btn sage full">Submit</button>
        </form>
      </Card>
      <Card title="Your expenses">
        {mine.length ? (
          <div className="list">
            {mine.slice(0, 40).map((e) => (
              <div key={e.id} className="list-item">
                <DateBox date={e.date} />
                <div className="grow">
                  <div className="title">{money(e.amount)} · {e.category}</div>
                  <div className="meta">{e.description}</div>
                </div>
                <Badge>{e.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No expenses yet.</Empty>
        )}
      </Card>
    </div>
  )
}

/* ---------------- cards ---------------- */
export function CardsPage() {
  const { state, me, update, toast } = useStore()
  const [spend, setSpend] = useState<'supply' | 'gas' | null>(null)
  const [amt, setAmt] = useState(0)
  const [desc, setDesc] = useState('')
  if (!me) return null
  const txns = state.cardTxns.filter((t) => t.employeeId === me.id).sort((a, b) => b.date.localeCompare(a.date))
  const bal = (c: 'supply' | 'gas') => txns.filter((t) => t.card === c).reduce((s, t) => s + t.amount, 0)
  const half = me.employmentType === 'substitute'
  return (
    <div className="stack">
      <div className="grid g2">
        {(['supply', 'gas'] as const).map((c) => (
          <div key={c} className="card" style={{ background: c === 'supply' ? 'var(--sage-soft)' : 'var(--sky-soft)' }}>
            <div className="row between">
              <div className="row">{c === 'supply' ? <ShoppingBag /> : <Fuel />} <b>{c === 'supply' ? 'Supply card' : 'Gas card'}</b></div>
              <CreditCard className="muted" />
            </div>
            <div className="serif" style={{ fontSize: '2.2rem', color: 'var(--navy)', margin: '8px 0' }}>{money(bal(c))}</div>
            <div className="tiny muted">
              Loaded {money(c === 'supply' ? POLICY.supplyCard : POLICY.gasCard)} each pay period you work{half ? ` (half if under ${POLICY.substituteHalfUnderHours} hrs as a substitute)` : ''}.
            </div>
            <button className="btn light sm mt" onClick={() => { setSpend(c); setAmt(0); setDesc('') }}>Log a purchase</button>
          </div>
        ))}
      </div>
      <Card title="Activity">
        {txns.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Card</th><th>Description</th><th className="num">Amount</th></tr></thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="nowrap">{fmtDay(t.date)}</td>
                    <td>{t.card}</td>
                    <td>{t.description}</td>
                    <td className="num" style={{ color: t.amount > 0 ? 'var(--ok)' : undefined }}>{t.amount > 0 ? '+' : ''}{money(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No card activity yet.</Empty>
        )}
      </Card>
      {spend && (
        <Modal
          title={`Log a ${spend} card purchase`}
          onClose={() => setSpend(null)}
          footer={
            <button className="btn sage" disabled={!amt || !desc} onClick={() => {
              update((d) => void d.cardTxns.push({ id: uid('ct'), employeeId: me.id, card: spend, date: today(), amount: -Math.abs(amt), description: desc }))
              toast('Purchase logged')
              setSpend(null)
            }}>Save</button>
          }
        >
          <div className="form-grid">
            <Field label="Amount"><input type="number" min={0} step={0.01} value={amt || ''} onChange={(e) => setAmt(Number(e.target.value))} autoFocus /></Field>
            <Field label="Where / what"><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Rosauers — microfiber cloths" /></Field>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- onboarding ---------------- */
export function OnboardingPage() {
  const { state, me, update, notify, toast } = useStore()
  const [step, setStep] = useState<'w4' | 'i9' | 'pay' | null>(null)
  if (!me || !me.onboarding) return null
  const o = me.onboarding
  const handbook = me.employmentType === 'substitute' ? 'handbook-subrct' : 'handbook-rct'
  const agreement = me.employmentType === 'substitute' ? 'agreement-subrct' : 'agreement-rct'
  const steps: { key: keyof typeof o; title: string; body: string; action: React.ReactNode }[] = [
    { key: 'profile', title: 'Personal details', body: 'Name, phone, email and emergency contact.', action: <Link className="btn light sm" to="/app/profile">Edit profile</Link> },
    { key: 'w4', title: 'Federal W-4', body: 'Tax withholding: filing status, dependents, extra withholding.', action: <button className="btn light sm" onClick={() => setStep('w4')}>{o.w4 ? 'Update' : 'Fill out'}</button> },
    { key: 'i9', title: 'I-9 employment eligibility', body: 'Section 1 here; show your ID documents to Dustin at your first shadowing day.', action: <button className="btn light sm" onClick={() => setStep('i9')}>{o.i9 ? 'View' : 'Start'}</button> },
    { key: 'directDeposit', title: 'How you get paid', body: 'Direct deposit or paper check.', action: <button className="btn light sm" onClick={() => setStep('pay')}>{o.directDeposit ? 'Change' : 'Choose'}</button> },
    { key: 'handbookSigned', title: 'Employee Handbook', body: 'Read and sign.', action: <Link className="btn light sm" to={`/app/docs/${handbook}`}>Read & sign</Link> },
    { key: 'agreementSigned', title: 'Employment Agreement', body: 'Read and sign.', action: <Link className="btn light sm" to={`/app/docs/${agreement}`}>Read & sign</Link> },
  ]
  const done = steps.filter((s) => o[s.key]).length
  const mark = (k: keyof typeof o, extra?: (u: User) => void) =>
    update((d) => {
      const u = d.users.find((x) => x.id === me.id)!
      u.onboarding![k] = true
      extra?.(u)
      const titles: Record<string, RegExp> = { w4: /W-4/, i9: /I-9/, directDeposit: /deposit/ }
      d.tasks.filter((t) => t.userId === me.id && titles[k]?.test(t.title)).forEach((t) => (t.done = true))
      if (Object.values(u.onboarding!).every(Boolean)) notify(d, 'u_owner', `${me.name} finished onboarding.`, `/app/team/${me.id}`)
    })
  const mySigs = state.signatures.filter((s) => s.userId === me.id)
  const myDocs = state.uploads.filter((u) => u.employeeId === me.id)
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <Card title="Onboarding" action={<span className="small muted">{done}/{steps.length} done</span>}>
        <Progress value={done / steps.length} />
        <div className="list mt">
          {steps.map((s) => (
            <div key={s.key} className="list-item">
              {o[s.key] ? <CheckCircle2 color="var(--ok)" /> : <Circle className="muted" />}
              <div className="grow">
                <div className="title">{s.title}</div>
                <div className="meta">{s.body}</div>
              </div>
              {s.action}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Your documents">
        <div className="list">
          {mySigs.map((s) => (
            <Link key={s.docSlug} to={`/app/docs/${s.docSlug}`} className="list-item">
              <PenLine size={18} />
              <div className="grow">
                <div className="title">{docBySlug(s.docSlug)?.title}</div>
                <div className="meta">Signed {fmtDateTime(s.at)} as “{s.name}”</div>
              </div>
            </Link>
          ))}
          {myDocs.map((d) => (
            <div key={d.id} className="list-item"><div className="grow"><div className="title">{d.title}</div><div className="meta">{d.category}</div></div></div>
          ))}
          <Link to="/app/pay" className="list-item"><Download size={18} /><div className="grow"><div className="title">Paystubs</div><div className="meta">{state.stubs.filter((s) => s.employeeId === me.id).length} available</div></div></Link>
          {SIGNABLE.filter((x) => !mySigs.some((s) => s.docSlug === x) && (x === handbook || x === agreement || x === 'sop-general')).map((x) => (
            <Link key={x} to={`/app/docs/${x}`} className="list-item"><Circle size={18} className="muted" /><div className="grow"><div className="title">{docBySlug(x)?.title}</div><div className="meta">Not signed yet</div></div></Link>
          ))}
        </div>
      </Card>
      {step === 'w4' && <W4Form onClose={() => setStep(null)} onSave={(w4) => { mark('w4', (u) => (u.w4 = w4)); toast('W-4 saved'); setStep(null) }} initial={me.w4} />}
      {step === 'i9' && <I9Form onClose={() => setStep(null)} onSave={() => { mark('i9'); toast('I-9 section 1 saved'); setStep(null) }} done={o.i9} />}
      {step === 'pay' && <PayMethodForm onClose={() => setStep(null)} onSave={(m, last4) => { mark('directDeposit', (u) => { u.payMethod = m; u.bankLast4 = last4 }); toast('Payment method saved'); setStep(null) }} user={me} />}
    </div>
  )
}

function W4Form({ initial, onSave, onClose }: { initial?: W4; onSave: (w: W4) => void; onClose: () => void }) {
  const [w, setW] = useState<W4>(initial || { filingStatus: 'single', multipleJobs: false, dependentsAmount: 0, otherIncome: 0, deductions: 0, extraWithholding: 0 })
  return (
    <Modal title="Form W-4 (2026) — Employee’s Withholding Certificate" onClose={onClose} footer={<button className="btn sage" onClick={() => onSave(w)}>Sign & save</button>}>
      <div className="form-grid">
        <Field label="Step 1(c): Filing status" full>
          <select value={w.filingStatus} onChange={(e) => setW({ ...w, filingStatus: e.target.value as W4['filingStatus'] })}>
            <option value="single">Single or Married filing separately</option>
            <option value="married">Married filing jointly</option>
            <option value="head">Head of household</option>
          </select>
        </Field>
        <label className="check full"><input type="checkbox" checked={w.multipleJobs} onChange={(e) => setW({ ...w, multipleJobs: e.target.checked })} /> Step 2(c): I have more than one job, or my spouse works</label>
        <Field label="Step 3: Dependents amount ($)" hint="$2,200 per child under 17, $500 per other dependent"><input type="number" min={0} step={100} value={w.dependentsAmount} onChange={(e) => setW({ ...w, dependentsAmount: Number(e.target.value) })} /></Field>
        <Field label="Step 4(a): Other income ($/yr)"><input type="number" min={0} value={w.otherIncome} onChange={(e) => setW({ ...w, otherIncome: Number(e.target.value) })} /></Field>
        <Field label="Step 4(b): Deductions ($/yr)"><input type="number" min={0} value={w.deductions} onChange={(e) => setW({ ...w, deductions: Number(e.target.value) })} /></Field>
        <Field label="Step 4(c): Extra withholding per paycheck ($)"><input type="number" min={0} value={w.extraWithholding} onChange={(e) => setW({ ...w, extraWithholding: Number(e.target.value) })} /></Field>
      </div>
      <div className="tiny muted mt">Demo form — the real one is filed through payroll. Your SSN is never entered here.</div>
    </Modal>
  )
}

function I9Form({ onSave, onClose, done }: { onSave: () => void; onClose: () => void; done: boolean }) {
  const [status, setStatus] = useState('citizen')
  const [attest, setAttest] = useState(done)
  return (
    <Modal title="Form I-9 — Section 1" onClose={onClose} footer={<button className="btn sage" disabled={!attest} onClick={onSave}>Sign & save</button>}>
      <Field label="I attest, under penalty of perjury, that I am:">
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="citizen">A citizen of the United States</option>
          <option value="national">A noncitizen national of the United States</option>
          <option value="lpr">A lawful permanent resident</option>
          <option value="authorized">A noncitizen authorized to work</option>
        </select>
      </Field>
      <label className="check mt"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} /> The information I provided is true and correct.</label>
      <div className="notice small mt">Section 2: bring an acceptable ID (e.g. passport, or driver’s license + Social Security card) to your first day. Dustin verifies it within 3 business days. Document numbers are not stored in this demo.</div>
    </Modal>
  )
}

function PayMethodForm({ user, onSave, onClose }: { user: User; onSave: (m: 'direct_deposit' | 'check', last4?: string) => void; onClose: () => void }) {
  const [m, setM] = useState<'direct_deposit' | 'check'>(user.payMethod || 'direct_deposit')
  const [acct, setAcct] = useState('')
  const [routing, setRouting] = useState('')
  const ok = m === 'check' || (routing.length === 9 && acct.length >= 4)
  return (
    <Modal title="How do you want to be paid?" onClose={onClose} footer={<button className="btn sage" disabled={!ok} onClick={() => onSave(m, m === 'direct_deposit' ? acct.slice(-4) : undefined)}>Save</button>}>
      <div className="chips">
        <button className={`chip${m === 'direct_deposit' ? ' on' : ''}`} onClick={() => setM('direct_deposit')}>Direct deposit</button>
        <button className={`chip${m === 'check' ? ' on' : ''}`} onClick={() => setM('check')}>Paper check</button>
      </div>
      {m === 'direct_deposit' ? (
        <div className="form-grid mt">
          <Field label="Routing number (9 digits)"><input inputMode="numeric" maxLength={9} value={routing} onChange={(e) => setRouting(e.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Account number"><input inputMode="numeric" value={acct} onChange={(e) => setAcct(e.target.value.replace(/\D/g, ''))} /></Field>
          <div className="tiny muted full">Demo: only the last 4 digits are kept, on this device. Use made-up numbers.</div>
        </div>
      ) : (
        <p className="small mt">Checks are handed out on payday.</p>
      )}
    </Modal>
  )
}

/* ---------------- profile ---------------- */
export function ProfilePage() {
  const { me, update, toast, reset } = useStore()
  const [f, setF] = useState({ name: me?.name || '', phone: me?.phone || '', email: me?.email || '' })
  if (!me) return null
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <Card title="Profile">
        <form className="form-grid" onSubmit={(e) => { e.preventDefault(); update((d) => { Object.assign(d.users.find((u) => u.id === me.id)!, f) }); toast('Profile saved') }}>
          <Field label="Name" full><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <button className="btn sage full">Save</button>
        </form>
      </Card>
      {me.role === 'employee' && (
        <Card title="Job">
          <div className="grid g2 small">
            <div><div className="muted tiny">Title</div>{me.title}</div>
            <div><div className="muted tiny">Type</div>{me.employmentType}</div>
            <div><div className="muted tiny">Pay rate</div>{money(me.payRate || 18)}/hr</div>
            <div><div className="muted tiny">Start date</div>{me.startDate && fmtDay(me.startDate, { year: true })}</div>
            <div><div className="muted tiny">Manager</div>Dustin Sipes</div>
            <div><div className="muted tiny">Paid by</div>{me.payMethod === 'check' ? 'Check' : me.payMethod ? 'Direct deposit' : 'Not set'}</div>
          </div>
        </Card>
      )}
      <Card title="Demo">
        <p className="small muted">All data lives on this device. Reset puts every screen back to the starting demo data.</p>
        <button className="btn light" onClick={() => { if (confirm('Reset all demo data?')) { reset(); toast('Demo data reset') } }}>Reset demo data</button>
      </Card>
    </div>
  )
}

