// Offline provider: no model at all. Answers common questions straight from the app's
// data (shifts, hours, pay, PTO, invoices, prices, policy math) and otherwise returns
// the most relevant passages from the company docs. It always works, on any device,
// and is the fallback when the Claude bridge or API is unreachable.
import type { State, User } from '../types'
import { addDays, fmtDay, fmtTime, money, today } from '../dates'
import { POLICY, computeStub, hoursFor, periodFor, ptoBalance } from '../payroll'
import { ADDONS, CANCELLATION, COMPANY, SERVICES, cancellationFee } from '../../data/site'
import { search } from './knowledge'
import type { AiRequest, AiResult } from './provider'

const has = (q: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, 'i').test(q))
const num = (q: string, unit: string) => {
  const m = q.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'i'))
  return m ? Number(m[1]) : null
}

export function offlineAnswer(req: AiRequest, s: State, me: User | null): AiResult {
  const q = req.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || ''
  const t = today()
  const p = periodFor(t)
  const lines: string[] = []
  const client = (id?: string) => s.clients.find((c) => c.id === id)

  if (req.task === 'explain-stub' && req.extra) {
    return { text: req.extra, sources: [{ title: 'Employee Handbook', heading: 'Pay & timekeeping', link: '/app/docs/handbook-rct' }], provider: 'offline' }
  }
  if (req.task === 'draft-reply') {
    return { text: draftReply(q, req.extra || ''), sources: [], provider: 'offline' }
  }

  // --- data questions ---
  if (me?.role === 'employee') {
    if (has(q, 'next shift', 'schedule', 'working', 'when do i work', 'shifts', 'tomorrow', 'today')) {
      const day = has(q, 'tomorrow') ? addDays(t, 1) : null
      const list = s.shifts.filter((x) => x.employeeId === me.id && x.published && (day ? x.date === day : x.date >= t)).slice(0, day ? 10 : 5)
      lines.push(list.length ? `Your ${day ? 'shifts tomorrow' : 'next shifts'}:` : `You have no published shifts ${day ? 'tomorrow' : 'coming up'}.`)
      list.forEach((x) => lines.push(`- **${fmtDay(x.date, { weekday: true })} ${fmtTime(x.start)}–${fmtTime(x.end)}** — ${client(x.clientId)?.household}, ${client(x.clientId)?.address}`))
      lines.push('', 'Open **Schedule** for the full calendar or to export it to Google Calendar (.ics).')
      return done(lines)
    }
    if (has(q, 'pto', 'paid time off', 'vacation', 'time off')) {
      const b = ptoBalance(s, me)
      lines.push(`You have **${b.balance} hours of PTO** available, plus about ${b.pendingAccrual} hours accruing this period (1 hour for every ${POLICY.ptoHoursPer} hours worked).`, '', 'Request time off under **Time off → Request**; Dustin approves it.')
      return done(lines, [{ title: 'Employee Handbook', heading: 'PTO', link: '/app/docs/handbook-rct' }])
    }
    if (has(q, 'hours', 'timesheet', 'overtime', 'submit')) {
      const h = hoursFor(s, me.id, p)
      lines.push(`This pay period (${p.label}) you have **${h.total} hours** (${h.regular} regular, ${h.overtime} overtime); ${h.pending} hours are not approved yet.`, `Hours are due by **${fmtDay(p.end, { weekday: true })}** — use **Time → Submit hours**. Only on-site time counts; overtime is 1.5× over 40 hours in a Sunday–Saturday week.`)
      return done(lines)
    }
    if (has(q, 'pay', 'paycheck', 'paid', 'payday', 'money', 'earn', 'tax', 'stub')) {
      const est = computeStub(s, me, p, 'preview', false)
      lines.push(`Next payday is **${fmtDay(p.payDate, { weekday: true, year: true })}** for ${p.label}.`, `Based on your hours so far: gross ≈ **${money(est.gross)}**, take-home ≈ **${money(est.net)}** (${me.payMethod === 'check' ? 'paper check' : 'direct deposit'}). Taxes here are estimates — real payroll runs in Gusto.`, `You also get the ${money(est.cards.supply)} supply card and ${money(est.cards.gas)} gas card loads, and approved mileage/laundry reimbursements are added untaxed.`)
      return done(lines)
    }
  }
  if (me?.role === 'client' && has(q, 'next', 'clean', 'visit', 'invoice', 'owe', 'pay')) {
    const c = client(me.clientId)
    const up = s.shifts.filter((x) => x.clientId === c?.id && x.date >= t && x.published).slice(0, 3)
    const inv = s.invoices.filter((i) => i.clientId === c?.id && i.status === 'sent')
    lines.push(up.length ? `Your next cleaning is **${fmtDay(up[0].date, { weekday: true })} at ${fmtTime(up[0].start)}**.` : 'You have no upcoming cleanings scheduled — use **Request a cleaning**.')
    lines.push(inv.length ? `You have ${inv.length} open invoice(s) totalling **${money(inv.reduce((a, i) => a + i.total, 0))}** — pay under **Invoices** (Venmo, Zelle or Square).` : 'You’re all paid up. Thank you!')
    return done(lines)
  }
  if ((me?.role === 'owner' || me?.role === 'manager') && has(q, 'approve', 'waiting', 'todo', 'to do', 'pending', 'unpaid', 'owed', 'revenue', 'today')) {
    const sub = s.time.filter((x) => x.status === 'submitted').length
    const unpaid = s.invoices.filter((i) => i.status === 'sent')
    lines.push(`Waiting on you: **${sub}** submitted time entries, **${s.timeOff.filter((x) => x.status === 'pending').length}** time-off requests, **${s.expenses.filter((x) => x.status === 'pending').length}** expenses (Approvals), **${s.bookings.filter((b) => b.status === 'new').length}** new bookings.`, `Unpaid invoices: ${unpaid.length} for **${money(unpaid.reduce((a, i) => a + i.total, 0))}**.`, `Today: ${s.shifts.filter((x) => x.date === t).map((x) => `${fmtTime(x.start)} ${client(x.clientId)?.household}`).join(', ') || 'no jobs'}.`)
    return done(lines)
  }

  // --- policy math ---
  if (has(q, 'cancel')) {
    const hrsAhead = num(q, 'hours? (?:ahead|before|notice|in advance)')
    lines.push(CANCELLATION.intro, '', ...CANCELLATION.tiers.map((x) => `- **${x.label}:** ${x.fee}`), '', CANCELLATION.footnote)
    if (hrsAhead !== null) lines.push('', `For ${hrsAhead} hours’ notice on a 3-hour, $37/hr cleaning the fee would be **${money(cancellationFee(hrsAhead, 3, 37))}**.`)
    return done(lines, [{ title: 'Cancellation policy', heading: 'Cancellation', link: '/policies' }])
  }
  if (has(q, 'price', 'cost', 'rate', 'quote', 'how much', 'charge', 'estimate')) {
    const h = num(q, 'h(?:ou)?rs?') || null
    lines.push('GIST pricing:')
    SERVICES.forEach((x) => lines.push(`- **${x.name}** — ${x.rateLabel}`))
    lines.push('', 'Add-ons:', ...ADDONS.map((a) => `- ${a.name}: ${a.price}`))
    if (h) {
      const tidy = has(q, 'tidy')
      const wash = has(q, 'wash', 'laundry', 'dishes')
      const rate = 37 + (tidy ? 2 : 0) + (wash ? (tidy ? 2 : 3) : 0)
      lines.push('', `A ${h}-hour basic cleaning${tidy ? ' + tidying' : ''}${wash ? ' + washing' : ''} would be about **${money(h * rate)}** (${h} × $${rate}/hr).`)
    }
    lines.push('', `Payment by ${COMPANY.payments.join(', ')}, due within 24 hours of the invoice. Request a cleaning on the **Book** page.`)
    return done(lines, [{ title: 'Services & pricing', heading: 'Pricing', link: '/pricing' }])
  }

  // --- doc retrieval ---
  const filter = req.docSlug ? (c: { link: string }) => c.link.endsWith('/' + req.docSlug) : undefined
  const hits = search(q, 3, filter)
  if (!hits.length) {
    return done([
      'I couldn’t find that in GIST’s docs. Try asking about a client’s SOP, pay and timekeeping, PTO, supplies, scheduling, cancellation, or prices.',
      '',
      '_Offline mode answers from the app’s data and docs. Connect Claude (Settings → AI) for full conversational answers._',
    ])
  }
  lines.push('Here’s what GIST’s docs say:')
  for (const h of hits) {
    const text = h.text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 9)
      .join('\n')
    lines.push('', `**${h.title} › ${h.heading}**`, text.length > 700 ? text.slice(0, 700) + '…' : text)
  }
  lines.push('', '_Offline mode quotes the docs directly. Connect Claude (Settings → AI) for a written answer._')
  return { text: lines.join('\n'), sources: hits.map((h) => ({ title: h.title, heading: h.heading, link: h.link })), provider: 'offline' }
}

function done(lines: string[], sources: AiResult['sources'] = []): AiResult {
  return { text: lines.join('\n'), sources, provider: 'offline' }
}

function draftReply(q: string, context: string) {
  const first = (context.match(/from ([A-Z][a-z]+)/) || [])[1] || 'there'
  if (/quote|booking|request/i.test(q + context)) {
    return `Hi ${first}!\n\nThanks so much for reaching out to GIST Cleaning. Our basic cleaning is $37/hour (tidying +$2/hr, washing +$3/hr), and most homes your size take about 2–3 hours, so roughly $74–$111 per visit. I’d love to stop by for a quick walk-through so I can write up a checklist just for your home — does ${fmtDay(addDays(today(), 3), { weekday: true })} afternoon work?\n\nTalk soon,\nDustin — GIST Cleaning\n${COMPANY.phone}`
  }
  return `Hi ${first}!\n\nThanks for the message — absolutely, we can take care of that. I’ve added it to the notes for your next cleaning. If it adds more than about 15 minutes I’ll let you know first.\n\nThanks!\nDustin — GIST Cleaning`
}
