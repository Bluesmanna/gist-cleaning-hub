// The assistant's knowledge: every company doc (SOPs, handbooks, agreements, client
// SOPs, project lists), the public-site content (services, pricing, policies) and a
// guide to the app itself. Chunks are scored with a small BM25 so the most relevant
// passages go into each prompt (and power the offline answers).
import { DOCS, sections } from '../docs'
import type { User } from '../types'
import { ABOUT, ADDONS, CANCELLATION, COMPANY, HIRING, SERVICES, UPDATES } from '../../data/site'

export interface Chunk {
  id: string
  title: string
  heading: string
  text: string
  link: string
  tokens: string[]
}

export const APP_GUIDE = `GIST Cleaning Hub — app guide.
Public website: Home, Services (cleaning, organization, commercial / GIST for Business), Pricing & add-ons, About, Book a cleaning (request form), Contact, Cancellation policy, Updates, Careers.
Employee app: Dashboard (clock in/out for today's shift, next shifts, tasks); Schedule (week/list view, open shifts you can claim, export to calendar .ics); Availability (weekly availability + notes; managers build schedules a week ahead from it); Time (geofenced clock in/out — only on-site hours count; edit an entry with a required note, every edit is kept in history; "Submit hours" by the last day of the pay period); Shift detail (address, map link, the home's SOP checklist you tick off as you go, client notes, pets, access); Pay (paystubs with hours, overtime, PTO, tips, reimbursements, tax withholding estimate, supply & gas card loads; a pay tracker for the current period); Time off (PTO balance — 1 hour accrues per 25 worked — and requests); Expenses (mileage, laundry, supplies with receipt photos — reimbursed on the next paycheck); Cards (supply $75 and gas $50 loaded each pay period, half for substitutes under 20 hours); Documents & onboarding (W-4, I-9, direct deposit or check, read & sign handbook and agreement); Docs library (all SOPs, handbooks, agreements, client SOPs, project task lists — read in-app or download .docx/.pdf/.md/.txt); Messages; Notifications; Profile.
Owner app: Dashboard (today's jobs, hours waiting, bookings, money in); Team (employees, onboarding status, pay rates); Clients (households, SOP, frequency, pets, notes, photos); Schedule builder (add/assign shifts, drafts, publish to notify the team); Approvals (timesheets, PTO, expenses); Payroll (preview and process semi-monthly payroll, paystubs, tax totals); Bookings (website requests → convert to a client); Invoices ($37/hr, paid by Venmo, Zelle or Square within 24 hours); Reports; Settings (geofence radius, simulate on-site, AI provider, data export/import/reset).
Client portal: Upcoming cleanings, request a cleaning, cancel (fee shown up-front per the policy), invoices & pay, messages, home preferences.
AI: this assistant, plus "Explain my paystub", "Draft a reply", "Ask about this doc" and "Draft a quote" buttons around the app.`

function siteText() {
  const svc = SERVICES.map((s) => `${s.name} — ${s.rateLabel}. ${s.body} Includes: ${s.includes.join(' ')}${s.onRequest ? ' On request: ' + s.onRequest.join(' ') : ''}`).join('\n')
  const add = ADDONS.map((a) => `${a.name} (${a.price}): ${a.body}`).join('\n')
  const can = `${CANCELLATION.intro} ${CANCELLATION.tiers.map((t) => `${t.label}: ${t.fee}.`).join(' ')} ${CANCELLATION.footnote} ${CANCELLATION.reschedule}`
  return [
    { title: 'Services & pricing', heading: 'Services', text: svc, link: '/services' },
    { title: 'Services & pricing', heading: 'Add-ons', text: add, link: '/pricing' },
    { title: 'Cancellation policy', heading: 'Cancellation', text: can, link: '/policies' },
    { title: 'About GIST', heading: 'About', text: [ABOUT.definition, ABOUT.intro, ...ABOUT.factors.map((f) => `${f.title}: ${f.body}`), ...ABOUT.started, ...ABOUT.inclusivity, ...ABOUT.proprietor].join(' '), link: '/about' },
    { title: 'Contact', heading: 'Contact', text: `${COMPANY.name}, ${COMPANY.city}. Email ${COMPANY.email}, phone ${COMPANY.phone}. Owner ${COMPANY.owner}. Payments: ${COMPANY.payments.join(', ')}.`, link: '/contact' },
    ...UPDATES.map((u) => ({ title: 'Updates', heading: u.title, text: `${u.date}: ${u.body} ${u.points.join(' ')}`, link: '/updates' })),
    { title: 'Careers', heading: HIRING.title, text: `${HIRING.body} ${HIRING.perks.join('; ')}`, link: '/careers' },
    { title: 'App guide', heading: 'How to use the app', text: APP_GUIDE, link: '/app' },
  ]
}

const STOP = new Set('a an and are as at be by can do does for from has have how i if in is it its me my of on or our so that the their them then there this to was we what when where which who will with you your'.split(' '))
export const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9$.\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|ed|es|s)$/, '') : w))

let CHUNKS: Chunk[] | null = null
let DF: Map<string, number> = new Map()
let AVG = 1

export function chunks(): Chunk[] {
  if (CHUNKS) return CHUNKS
  const out: Chunk[] = []
  for (const d of DOCS) {
    for (const [i, s] of sections(d.md).entries()) {
      const text = s.text.replace(/\n{2,}/g, '\n').slice(0, 2400)
      out.push({ id: `${d.slug}#${i}`, title: d.title, heading: s.heading, text, link: `/app/docs/${d.slug}`, tokens: tokenize(`${d.title} ${s.heading} ${text}`) })
    }
  }
  siteText().forEach((s, i) => out.push({ id: `site#${i}`, ...s, tokens: tokenize(`${s.title} ${s.heading} ${s.text}`) }))
  DF = new Map()
  for (const c of out) for (const t of new Set(c.tokens)) DF.set(t, (DF.get(t) || 0) + 1)
  AVG = out.reduce((s, c) => s + c.tokens.length, 0) / out.length
  CHUNKS = out
  return out
}

/** Company docs are for staff only: visitors and clients search just the public-site knowledge. */
export const isStaff = (me: Pick<User, 'role'> | null | undefined) => !!me && (me.role === 'owner' || me.role === 'manager' || me.role === 'employee')

export function scope(me: User | null, docSlug?: string): (c: Chunk) => boolean {
  const staff = isStaff(me)
  return (c) => (staff || c.id.startsWith('site#')) && (!docSlug || c.link.endsWith('/' + docSlug))
}

export function search(q: string, k = 6, filter?: (c: Chunk) => boolean): (Chunk & { score: number })[] {
  const all = chunks()
  const qt = [...new Set(tokenize(q))]
  if (!qt.length) return []
  const N = all.length
  const scored = all
    .filter((c) => !filter || filter(c))
    .map((c) => {
      let score = 0
      const tf = new Map<string, number>()
      for (const t of c.tokens) tf.set(t, (tf.get(t) || 0) + 1)
      for (const t of qt) {
        const f = tf.get(t)
        if (!f) continue
        const idf = Math.log(1 + (N - (DF.get(t) || 0) + 0.5) / ((DF.get(t) || 0) + 0.5))
        score += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (c.tokens.length / AVG)))
      }
      if (qt.some((t) => c.heading.toLowerCase().includes(t))) score *= 1.25
      return { ...c, score }
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored.slice(0, k)
}
