// Client portal: what a GIST household sees (upcoming visits, cancel/reschedule with the
// real cancellation policy, request extra cleanings, pay invoices, keep preferences).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarPlus, MessageSquare, Receipt } from 'lucide-react'
import { useStore, clientOf, userName } from '../lib/store'
import type { AddOnKey, Booking, Shift } from '../lib/types'
import { addDays, at, fmtDay, fmtTime, money, shiftHours, today, uid } from '../lib/dates'
import { ADDONS, CANCELLATION, SERVICES, cancellationFee } from '../data/site'
import { estimate } from './Public'
import { Badge, Card, DateBox, Empty, Field, Modal, Stat } from '../components/ui'
import { PhotoStrip } from './Owner'

function useMyClient() {
  const { state, me } = useStore()
  return clientOf(state, me?.clientId)
}

function VisitRow({ s, onCancel }: { s: Shift; onCancel?: (s: Shift) => void }) {
  const { state } = useStore()
  return (
    <div className="list-item">
      <DateBox date={s.date} />
      <div className="grow">
        <div className="title">{fmtDay(s.date, { weekday: true })} · {fmtTime(s.start)}–{fmtTime(s.end)}</div>
        <div className="meta">{s.employeeId ? `with ${userName(state, s.employeeId)}` : 'cleaner being assigned'}{s.note ? ` · ${s.note}` : ''}</div>
      </div>
      {onCancel && <button className="btn light sm" onClick={() => onCancel(s)}>Cancel / reschedule</button>}
    </div>
  )
}

export function ClientHome() {
  const { state, me } = useStore()
  const c = useMyClient()
  if (!c) return <Empty>No household is linked to this account.</Empty>
  const t = today()
  const next = state.shifts.filter((s) => s.clientId === c.id && s.date >= t && s.published)
  const owed = state.invoices.filter((i) => i.clientId === c.id && i.status === 'sent')
  const last = state.shifts.filter((s) => s.clientId === c.id && s.date < t).slice(-1)[0]
  return (
    <div className="stack">
      <h2 className="serif" style={{ margin: 0 }}>Hi {me?.name.split(' ')[0]}!</h2>
      <div className="grid g3">
        <Stat label="Next cleaning" value={next[0] ? fmtDay(next[0].date, { weekday: true }) : '—'} sub={next[0] ? `${fmtTime(next[0].start)} with ${userName(state, next[0].employeeId)}` : <Link to="/app/request">Request one</Link>} />
        <Stat label="Balance due" value={money(owed.reduce((n, i) => n + i.total, 0))} sub={owed.length ? <Link to="/app/invoices">Pay now</Link> : 'All paid — thank you!'} />
        <Stat label="Your plan" value={SERVICES.find((s) => s.key === c.service)?.name.replace(' Package', '')} sub={`${c.frequency}, about ${c.durationHours} h`} />
      </div>
      <div className="grid g2" style={{ alignItems: 'start' }}>
        <Card title="Upcoming visits" action={<Link className="small" to="/app/visits">Manage</Link>}>
          {next.length ? <div className="list">{next.slice(0, 4).map((s) => <VisitRow key={s.id} s={s} />)}</div> : <Empty>Nothing scheduled yet.</Empty>}
        </Card>
        <Card title="Quick actions">
          <div className="stack">
            <Link className="btn light" to="/app/request"><CalendarPlus size={16} /> Request an extra cleaning</Link>
            <Link className="btn light" to="/app/messages"><MessageSquare size={16} /> Message GIST</Link>
            <Link className="btn light" to="/app/invoices"><Receipt size={16} /> Invoices & payment</Link>
            {last && <div className="tiny muted">Last visit: {fmtDay(last.date, { weekday: true })} with {userName(state, last.employeeId)}.</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}

export function Visits() {
  const { state, update, notify, toast } = useStore()
  const c = useMyClient()
  const [cancel, setCancel] = useState<Shift | null>(null)
  const [newDate, setNewDate] = useState('')
  if (!c) return <Empty>No household linked.</Empty>
  const t = today()
  const upcoming = state.shifts.filter((s) => s.clientId === c.id && s.date >= t && s.published)
  const past = state.shifts.filter((s) => s.clientId === c.id && s.date < t).slice(-8).reverse()
  const rate = SERVICES.find((x) => x.key === c.service)?.rate || 37
  const hoursAhead = cancel ? (at(cancel.date, cancel.start).getTime() - Date.now()) / 3.6e6 : 0
  const fee = cancel ? cancellationFee(hoursAhead, shiftHours(cancel), rate) : 0

  function doCancel(reschedule: boolean) {
    if (!cancel) return
    update((d) => {
      d.shifts = d.shifts.filter((s) => s.id !== cancel.id)
      if (fee > 0) {
        const n = Math.max(1000, ...d.invoices.map((i) => i.number)) + 1
        d.invoices.push({ id: uid('inv'), number: n, clientId: c!.id, date: today(), due: addDays(today(), 1), lines: [{ description: `Late cancellation, ${fmtDay(cancel.date)} (${Math.max(0, Math.round(hoursAhead))} h notice)`, hours: 0, rate: 0, amount: fee }], total: fee, status: 'sent', shiftIds: [] })
      }
      if (reschedule && newDate) {
        d.bookings.push({ id: uid('bk'), createdAt: new Date().toISOString(), name: c!.contactName, email: c!.email, phone: c!.phone, address: c!.address, service: c!.service, addOns: c!.addOns, frequency: 'one-time', homeSize: '', preferredDate: newDate, preferredTime: fmtTime(cancel.start), notes: `Reschedule of ${fmtDay(cancel.date)} visit`, status: 'new', clientId: c!.id })
      }
      notify(d, 'u_owner', `${c!.household} cancelled ${fmtDay(cancel.date)} ${fmtTime(cancel.start)}${reschedule && newDate ? ` and asked to reschedule for ${fmtDay(newDate)}` : ''}.${fee ? ` Fee ${money(fee)} invoiced.` : ''}`, reschedule ? '/app/bookings' : '/app/schedule')
      if (cancel.employeeId) notify(d, cancel.employeeId, `${c!.household} on ${fmtDay(cancel.date)} was cancelled.`, '/app/schedule')
    })
    toast(reschedule ? 'Cancelled — GIST will confirm your new time' : 'Visit cancelled')
    setCancel(null)
    setNewDate('')
  }

  return (
    <div className="stack">
      <Card title="Upcoming">
        {upcoming.length ? <div className="list">{upcoming.map((s) => <VisitRow key={s.id} s={s} onCancel={setCancel} />)}</div> : <Empty>No upcoming visits. <Link to="/app/request">Request one</Link></Empty>}
      </Card>
      <Card title="Past visits">{past.length ? <div className="list">{past.map((s) => <VisitRow key={s.id} s={s} />)}</div> : <Empty>No visits yet.</Empty>}</Card>
      <Card title="Cancellation policy">
        <p className="small">{CANCELLATION.intro}</p>
        <ul className="small">{CANCELLATION.tiers.map((x) => <li key={x.label}><b>{x.label}:</b> {x.fee}</li>)}</ul>
        <p className="tiny muted">{CANCELLATION.footnote}</p>
      </Card>
      {cancel && (
        <Modal title="Cancel or reschedule" onClose={() => setCancel(null)} footer={
          <>
            <button className="btn light" onClick={() => doCancel(false)}>Cancel visit</button>
            <button className="btn sage" disabled={!newDate} onClick={() => doCancel(true)}>Cancel & request new date</button>
          </>
        }>
          <p className="small"><b>{fmtDay(cancel.date, { weekday: true })} {fmtTime(cancel.start)}</b> is {hoursAhead > 48 ? `${Math.round(hoursAhead / 24)} days` : `${Math.max(0, Math.round(hoursAhead))} hours`} away.</p>
          {fee > 0 ? <div className="notice warn"><AlertTriangle size={16} /> Under GIST’s policy this cancellation has a <b>{money(fee)}</b> fee, added to an invoice.</div> : <div className="notice ok">No fee: more than 48 hours’ notice.</div>}
          <p className="tiny muted mt">{CANCELLATION.reschedule}</p>
          <Field label="Prefer a different day? (optional)"><input type="date" min={addDays(today(), 1)} value={newDate} onChange={(e) => setNewDate(e.target.value)} /></Field>
        </Modal>
      )}
    </div>
  )
}

export function RequestCleaning() {
  const { state, update, notify, toast } = useStore()
  const c = useMyClient()
  const [f, setF] = useState({ service: c?.service || 'basic', hours: c?.durationHours || 3, addOns: (c?.addOns || []) as AddOnKey[], date: addDays(today(), 3), time: 'Morning', notes: '' })
  const [sent, setSent] = useState(false)
  if (!c) return <Empty>No household linked.</Empty>
  const est = estimate(f.service, f.hours, f.addOns)
  const open = state.bookings.filter((b) => b.clientId === c.id && (b.status === 'new' || b.status === 'contacted'))
  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card title="Request a cleaning">
        {sent ? <div className="notice ok">Request sent! Dustin will confirm the time with you, usually the same day.</div> : (
          <div className="form-grid">
            <Field label="Service" full><select value={f.service} onChange={(e) => setF({ ...f, service: e.target.value as Booking['service'] })}>{SERVICES.map((s) => <option key={s.key} value={s.key}>{s.name} — {s.rateLabel}</option>)}</select></Field>
            <Field label="Date"><input type="date" min={addDays(today(), 1)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Time of day"><select value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>{['Morning', 'Midday', 'Afternoon', 'After 6pm', 'Any'].map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="About how many hours?"><input type="number" min={1} step={0.5} value={f.hours} onChange={(e) => setF({ ...f, hours: Number(e.target.value) })} /></Field>
            <div className="full chips">{ADDONS.map((a) => <button key={a.key} type="button" className={`chip${f.addOns.includes(a.key) ? ' on' : ''}`} onClick={() => setF({ ...f, addOns: f.addOns.includes(a.key) ? f.addOns.filter((x) => x !== a.key) : [...f.addOns, a.key] })}>{a.name}</button>)}</div>
            <Field label="Anything we should know?" full><textarea rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. guests coming Saturday, focus on the kitchen" /></Field>
            <div className="full row between">
              <span className="small">Estimate: <b>{money(est.perVisit)}</b> <span className="muted">({money(est.rate)}/hr)</span></span>
              <button className="btn sage" onClick={() => {
                update((d) => {
                  d.bookings.push({ id: uid('bk'), createdAt: new Date().toISOString(), name: c.contactName, email: c.email, phone: c.phone, address: c.address, service: f.service, addOns: f.addOns, frequency: 'one-time', homeSize: `${f.hours} h requested`, preferredDate: f.date, preferredTime: f.time, notes: f.notes, status: 'new', clientId: c.id })
                  notify(d, 'u_owner', `${c.household} requested an extra cleaning on ${fmtDay(f.date)}.`, '/app/bookings')
                })
                setSent(true)
                toast('Request sent')
              }}>Send request</button>
            </div>
          </div>
        )}
      </Card>
      <Card title="Waiting for confirmation">
        {open.length ? <div className="list">{open.map((b) => <div key={b.id} className="list-item"><DateBox date={b.preferredDate} /><div className="grow"><div className="title">{SERVICES.find((s) => s.key === b.service)?.name}</div><div className="meta">{b.preferredTime}{b.notes ? ` · ${b.notes}` : ''}</div></div><Badge tone="warn">{b.status === 'new' ? 'sent' : 'in progress'}</Badge></div>)}</div> : <Empty>No pending requests.</Empty>}
      </Card>
    </div>
  )
}

export function Preferences() {
  const { state, update, toast } = useStore()
  const c = useMyClient()
  const [notes, setNotes] = useState(c?.notes || '')
  const [pets, setPets] = useState(c?.pets || '')
  if (!c) return <Empty>No household linked.</Empty>
  const save = (patch: Partial<typeof c>) => update((d) => void Object.assign(d.clients.find((x) => x.id === c.id)!, patch))
  return (
    <div className="stack" style={{ maxWidth: 860 }}>
      <Card title="Your home">
        <div className="form-grid">
          <Field label="Notes for your cleaner" full hint="Entry instructions, rooms to skip, products you prefer"><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <Field label="Pets" full><input value={pets} onChange={(e) => setPets(e.target.value)} /></Field>
          <Field label="Preferred cleaner"><select value={c.preferredEmployeeId || ''} onChange={(e) => save({ preferredEmployeeId: e.target.value || undefined })}><option value="">No preference</option>{state.users.filter((u) => u.role === 'employee' && u.active !== false && u.onboarding?.i9 !== false).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
          <Field label="How often"><select value={c.frequency} onChange={(e) => save({ frequency: e.target.value as typeof c.frequency })}>{['weekly', 'biweekly', 'monthly', 'as-needed'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <div className="full"><div className="small" style={{ marginBottom: 6 }}>Add-ons every visit</div><div className="chips">{ADDONS.map((a) => <button key={a.key} type="button" className={`chip${c.addOns.includes(a.key) ? ' on' : ''}`} onClick={() => save({ addOns: c.addOns.includes(a.key) ? c.addOns.filter((x) => x !== a.key) : [...c.addOns, a.key] })}>{a.name} · {a.price}</button>)}</div></div>
        </div>
        <button className="btn sage mt" onClick={() => { save({ notes, pets }); toast('Saved') }}>Save</button>
      </Card>
      <Card title="Photos for your cleaner" action={<span className="tiny muted">e.g. how you like the bed made</span>}><PhotoStrip client={c} canEdit /></Card>
    </div>
  )
}
