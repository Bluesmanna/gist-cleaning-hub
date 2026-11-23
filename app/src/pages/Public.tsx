// Public website: everything gistcleaning.com has (services, pricing, about, policy,
// updates, organization gallery) plus online booking, careers and sign-in.
import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Briefcase, CalendarCheck, Check, Clock, ThumbsUp, Heart, Mail, MapPin, Phone, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import { ABOUT, ADDONS, CANCELLATION, COMPANY, HIRING, IMAGES, ORG_GALLERY, SERVICES, TESTIMONIALS, UPDATES } from '../data/site'
import type { AddOnKey, Booking, ServiceKey } from '../lib/types'
import { addDays, fmtDay, money, today, uid } from '../lib/dates'
import { Avatar, Field, Lightbox } from '../components/ui'

const SVC_IMG: Record<ServiceKey, string> = {
  basic: IMAGES.cleaning,
  'white-glove': IMAGES.surface,
  rescue: IMAGES.balance,
  organization: IMAGES.organization,
  commercial: IMAGES.commercial,
}

function PageHero({ title, sub }: { title: string; sub?: string }) {
  return (
    <section className="section butter" style={{ paddingBottom: 36 }}>
      <div className="wrap center">
        <h1 style={{ color: 'var(--sage)', fontWeight: 500, fontSize: 'clamp(2.1rem,5vw,3.4rem)' }}>{title}</h1>
        {sub && <p className="muted" style={{ maxWidth: 680, margin: '0 auto', fontSize: '1.05rem' }}>{sub}</p>}
      </div>
    </section>
  )
}

function Cta() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cta-band">
          <div>
            <h2>Let’s get into stuff together.</h2>
            <p>Tell us about your space — we’ll reply within a day with a plan and a quote.</p>
          </div>
          <div className="row">
            <Link className="btn lg" to="/book">
              Book a cleaning <ArrowRight size={18} />
            </Link>
            <a className="btn lg ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.5)', background: 'transparent' }} href={`tel:${COMPANY.phone}`}>
              <Phone size={18} /> {COMPANY.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <h1>GIST Cleaning</h1>
          <p className="lead">Getting Into Stuff Together</p>
          <p className="muted" style={{ fontSize: '1.05rem', maxWidth: 460 }}>
            Residential cleaning, rescue cleaning and organization in Moscow, Idaho — with a no-shame, individualized approach.
          </p>
          <div className="row mt">
            <Link className="btn lg sage" to="/book">
              Book a cleaning
            </Link>
            <Link className="btn lg ghost" to="/services">
              See services
            </Link>
          </div>
        </div>
        <div className="hero-img" style={{ backgroundImage: `url(${IMAGES.hero})` }} role="img" aria-label="Neatly organized shelves" />
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-title">
            <h2>Services</h2>
            <p>From the usual spit-n’-shine to a full emergency overhaul.</p>
          </div>
          <div className="grid g3">
            {SERVICES.map((s) => (
              <Link key={s.key} to={`/services#${s.key}`} className="svc-card">
                <div className="ph" style={{ backgroundImage: `url(${SVC_IMG[s.key]})` }} />
                <div className="bd">
                  <h3 style={{ margin: 0 }}>{s.name}</h3>
                  <div className="price">{s.rateLabel}</div>
                  <p className="small muted" style={{ margin: 0 }}>{s.short}</p>
                </div>
              </Link>
            ))}
            <Link to="/business" className="svc-card">
              <div className="ph" style={{ backgroundImage: `url(${IMAGES.business})` }} />
              <div className="bd">
                <h3 style={{ margin: 0 }}>GIST for Business</h3>
                <div className="price">consultation</div>
                <p className="small muted" style={{ margin: 0 }}>Purge the old files, obsolete equipment and “that one shelf” — plus digital clutter and outdated SOPs.</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="wrap">
          <div className="section-title">
            <h2>Our Guiding Factors</h2>
          </div>
          <div className="grid g3">
            {ABOUT.factors.map((f, i) => (
              <div key={f.title} className="card flat">
                <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                  {[<ShieldCheck key="a" />, <Heart key="b" />, <Sparkles key="c" />][i]}
                  <h3 style={{ margin: 0 }}>{f.title}</h3>
                </div>
                <p className="muted small" style={{ margin: 0 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-title">
            <h2>Kind words</h2>
          </div>
          <div className="grid g3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.who} className="card" style={{ margin: 0 }}>
                <blockquote className="quote" style={{ margin: 0 }}>“{t.quote}”</blockquote>
                <figcaption className="quote-by">
                  — {t.who}, <span className="muted" style={{ fontWeight: 500 }}>{t.what}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section butter">
        <div className="wrap grid g2" style={{ alignItems: 'center' }}>
          <img src={IMAGES.organization} alt="Organized shelves after a GIST project" style={{ borderRadius: 18, boxShadow: 'var(--shadow)' }} loading="lazy" />
          <div>
            <h2>Organization, before & after</h2>
            <p className="muted">{ORG_GALLERY.intro}</p>
            <Link className="btn" to="/organization">
              See the project <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <Cta />
    </>
  )
}

export function Services() {
  return (
    <>
      <PageHero title="Services" sub="Regular, as-needed or one-time. Every home gets its own written checklist so it’s done your way, every time." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap">
          {SERVICES.map((s) => (
            <div key={s.key} id={s.key} className="svc-row">
              <div className="ph" style={{ backgroundImage: `url(${SVC_IMG[s.key]})` }} role="img" aria-label={s.name} />
              <div>
                <h2 style={{ marginBottom: 4 }}>{s.name}</h2>
                <div className="badge sage" style={{ marginBottom: 10 }}>{s.rateLabel}</div>
                <p>{s.body}</p>
                <ul className="ticks">
                  {s.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {s.onRequest && (
                  <>
                    <h4 className="mt">Available on request</h4>
                    <ul className="ticks">
                      {s.onRequest.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </>
                )}
                <Link className="btn sage mt" to={`/book?service=${s.key}`}>
                  Book {s.name.replace(/"/g, '')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="section alt">
        <div className="wrap">
          <div className="section-title">
            <h2>Add-ons</h2>
          </div>
          <div className="grid g4">
            {ADDONS.map((a) => (
              <div key={a.key} className="card">
                <h3 style={{ marginBottom: 2 }}>{a.name}</h3>
                <div className="price small" style={{ color: 'var(--sage-dark)', fontWeight: 700 }}>{a.price}</div>
                <p className="small muted mt0" style={{ marginTop: 8 }}>{a.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Cta />
    </>
  )
}

export function Pricing() {
  const [svc, setSvc] = useState<ServiceKey>('basic')
  const [hours, setHours] = useState(2.5)
  const [adds, setAdds] = useState<AddOnKey[]>([])
  const [visits, setVisits] = useState(2)
  const est = estimate(svc, hours, adds)
  return (
    <>
      <PageHero title="Pricing" sub="Simple hourly rates. Payment by Venmo, Zelle or Square, due within 24 hours of your invoice." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap grid g2" style={{ alignItems: 'start' }}>
          <div className="card pad0">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th className="right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {SERVICES.map((s) => (
                  <tr key={s.key}>
                    <td>
                      <Link to={`/services#${s.key}`}>{s.name}</Link>
                    </td>
                    <td className="right nowrap">{s.rateLabel}</td>
                  </tr>
                ))}
                {ADDONS.map((a) => (
                  <tr key={a.key}>
                    <td>+ {a.name}</td>
                    <td className="right">{a.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small muted" style={{ padding: '12px 16px' }}>
              Examples at $37/hour: 2 hours = $74 · 2.5 hours = $92.50 · 3 hours = $111.
            </div>
          </div>
          <div className="card butter">
            <h3>Estimate your visit</h3>
            <div className="form-grid">
              <Field label="Service" full>
                <select value={svc} onChange={(e) => setSvc(e.target.value as ServiceKey)}>
                  {SERVICES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Hours per visit: ${hours}`} full>
                <input type="range" min={1.5} max={8} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
              </Field>
              <Field label="Visits per month">
                <select value={visits} onChange={(e) => setVisits(Number(e.target.value))}>
                  <option value={1}>1 (monthly / one-time)</option>
                  <option value={2}>2 (every other week)</option>
                  <option value={4}>4 (weekly)</option>
                </select>
              </Field>
            </div>
            <div className="chips mt">
              {ADDONS.filter((a) => a.perHour).map((a) => (
                <button key={a.key} type="button" className={`chip${adds.includes(a.key) ? ' on' : ''}`} onClick={() => setAdds(toggle(adds, a.key))}>
                  {adds.includes(a.key) && <Check size={14} />} {a.name} ({a.price.split(' ')[0]})
                </button>
              ))}
            </div>
            <div className="row between mt" style={{ alignItems: 'baseline' }}>
              <div>
                <div className="small muted">Per visit</div>
                <div className="serif" style={{ fontSize: '2rem', color: 'var(--navy)' }}>{money(est.perVisit)}</div>
                <div className="tiny muted">{money(est.rate)}/hr × {hours} hrs</div>
              </div>
              <div className="right">
                <div className="small muted">Per month</div>
                <div className="serif" style={{ fontSize: '1.4rem' }}>{money(est.perVisit * visits)}</div>
              </div>
            </div>
            <Link className="btn sage block mt" to={`/book?service=${svc}&hours=${hours}&addons=${adds.join(',')}`}>
              Request this
            </Link>
            <div className="tiny muted mt">Estimates only — final quotes follow a free walk-through.</div>
          </div>
        </div>
      </section>
    </>
  )
}

export function estimate(svc: ServiceKey, hours: number, adds: AddOnKey[]) {
  const base = SERVICES.find((s) => s.key === svc)?.rate || 37
  let extra = 0
  if (adds.includes('tidying')) extra += 2
  if (adds.includes('washing')) extra += adds.includes('tidying') ? 2 : 3
  const rate = base + extra
  return { rate, perVisit: Math.round(rate * hours * 100) / 100 }
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x])

export function Organization() {
  const [box, setBox] = useState<number | null>(null)
  const all = [ORG_GALLERY.before, ...ORG_GALLERY.photos]
  return (
    <>
      <PageHero title="Residential Organization" sub="Create a space — for work, for play, or for life at large — that looks and feels good." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap grid g2" style={{ alignItems: 'start' }}>
          <div>
            <h2>{ORG_GALLERY.title}</h2>
            <p>{ORG_GALLERY.intro}</p>
            <ol className="steps-n">
              {ORG_GALLERY.steps.map((s, i) => (
                <li key={i}>
                  <span className={`badge ${s.phase === 'After' ? 'ok' : 'warn'}`}>{s.phase}</span> {s.text}
                </li>
              ))}
            </ol>
          </div>
          <figure style={{ margin: 0 }}>
            <button className="gallery" style={{ display: 'block', border: 0, padding: 0, background: 'none', cursor: 'zoom-in', width: '100%' }} onClick={() => setBox(0)}>
              <img src={ORG_GALLERY.before} alt="Before: the cluttered game and hobby room" style={{ borderRadius: 16, width: '100%' }} />
            </button>
            <figcaption className="small muted center mt">Before — tap any photo to enlarge</figcaption>
          </figure>
        </div>
      </section>
      <section className="section alt">
        <div className="wrap">
          <div className="section-title">
            <h2>After</h2>
            <p>Every usable item in its place — reorganized almost entirely with existing storage.</p>
          </div>
          <div className="gallery">
            {ORG_GALLERY.photos.map((p, i) => (
              <button key={p} onClick={() => setBox(i + 1)} aria-label={`Open photo ${i + 1}`}>
                <img src={p} alt={`After photo ${i + 1}`} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      </section>
      {box !== null && <Lightbox images={all} index={box} onClose={() => setBox(null)} />}
      <Cta />
    </>
  )
}

export function Business() {
  const s = SERVICES.find((x) => x.key === 'commercial')!
  return (
    <>
      <PageHero title="GIST for Business" sub="Keep your workplace customer-ready — and untangle the mess a janitor can’t." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap grid g2" style={{ alignItems: 'start' }}>
          <img src={IMAGES.business} alt="Organized business shelving" style={{ borderRadius: 18 }} loading="lazy" />
          <div>
            <p>{s.body}</p>
            <ul className="ticks">
              {s.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <Link className="btn sage" to="/book?service=commercial">
              Request a consultation
            </Link>
          </div>
        </div>
      </section>
      <Cta />
    </>
  )
}

export function About() {
  return (
    <>
      <PageHero title="About GIST" />
      <section className="section" style={{ paddingTop: 10 }}>
        <div className="wrap" style={{ maxWidth: 860 }}>
          <p className="definition">{ABOUT.definition}</p>
          <p style={{ fontSize: '1.08rem' }}>{ABOUT.intro}</p>
          <h2 className="mt">How it all started</h2>
          {ABOUT.started.map((p, i) => (
            <p key={i} className={i === 0 ? 'serif' : ''} style={i === 0 ? { fontSize: '1.2rem', color: 'var(--navy)' } : undefined}>
              {p}
            </p>
          ))}
        </div>
      </section>
      <section className="section alt">
        <div className="wrap grid g3">
          {ABOUT.factors.map((f) => (
            <div key={f.title}>
              <h3>{f.title}</h3>
              <p className="muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="section">
        <div className="wrap" style={{ maxWidth: 860 }}>
          <h2>Inclusivity & Understanding</h2>
          {ABOUT.inclusivity.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>
      <section className="section butter">
        <div className="wrap owner-card" style={{ maxWidth: 940 }}>
          <img src={IMAGES.owner} alt={`${COMPANY.owner}, owner of GIST Cleaning`} loading="lazy" />
          <div>
            <h2>Meet the proprietor</h2>
            {ABOUT.proprietor.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </section>
      <Cta />
    </>
  )
}

export function Contact() {
  return (
    <>
      <PageHero title="Contact" sub="Questions, quotes or just want to talk through a mess? Reach out any way you like." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap grid g3">
          <a className="card link" href={`tel:${COMPANY.phone}`}>
            <Phone /> <h3 className="mt">Call or text</h3>
            <div>{COMPANY.phone}</div>
          </a>
          <a className="card link" href={`mailto:${COMPANY.email}`}>
            <Mail /> <h3 className="mt">Email</h3>
            <div>{COMPANY.email}</div>
          </a>
          <a className="card link" href={COMPANY.facebook} target="_blank" rel="noreferrer">
            <ThumbsUp /> <h3 className="mt">Facebook</h3>
            <div>GIST Cleaning</div>
          </a>
        </div>
        <div className="wrap mt">
          <div className="card butter row between">
            <div className="row">
              <MapPin /> Serving {COMPANY.city} and the Palouse
            </div>
            <Link className="btn sage" to="/book">
              Book online
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}

export function Policies() {
  return (
    <>
      <PageHero title="Cancellation Policy" sub={CANCELLATION.intro} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap" style={{ maxWidth: 820 }}>
          <div className="grid g3">
            {CANCELLATION.tiers.map((t) => (
              <div key={t.label} className="card center">
                <Clock style={{ margin: '0 auto' }} />
                <h3 className="mt">{t.label}</h3>
                <div className="serif" style={{ fontSize: '1.3rem', color: 'var(--sage-dark)' }}>{t.fee}</div>
              </div>
            ))}
          </div>
          <p className="small muted mt">{CANCELLATION.footnote}</p>
          <h3 className="mt">Rescheduling</h3>
          <p>{CANCELLATION.reschedule}</p>
          <div className="notice">Clients can cancel a visit from the app (My cleanings) — it shows the exact fee before you confirm.</div>
        </div>
      </section>
    </>
  )
}

export function Updates() {
  return (
    <>
      <PageHero title="Updates" />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap stack" style={{ maxWidth: 820 }}>
          {UPDATES.map((u) => (
            <article key={u.date} className="card">
              <div className="tiny muted">{fmtDay(u.date, { year: true })}</div>
              <h2>{u.title}</h2>
              <p>{u.body}</p>
              <ul>
                {u.points.map((p) => (
                  <li key={p} style={{ marginBottom: 8 }}>{p}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}

export function Careers() {
  const { toast } = useStore()
  const [sent, setSent] = useState(false)
  return (
    <>
      <PageHero title={HIRING.title} sub={HIRING.body} />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap grid g2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3>Why work with GIST</h3>
            <ul className="ticks">
              {HIRING.perks.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault()
              setSent(true)
              toast('Application sent (demo)')
            }}
          >
            <h3>Apply</h3>
            {sent ? (
              <div className="notice ok">Thanks! Dustin will reach out to set up a quick chat. (Demo — nothing was sent.)</div>
            ) : (
              <div className="form-grid">
                <Field label="Name">
                  <input required />
                </Field>
                <Field label="Phone">
                  <input type="tel" required />
                </Field>
                <Field label="Email" full>
                  <input type="email" required />
                </Field>
                <Field label="Position" full>
                  <select>
                    <option>Residential Cleaning Tech</option>
                    <option>Substitute / project Cleaning Tech</option>
                  </select>
                </Field>
                <Field label="Availability & a little about you" full>
                  <textarea rows={4} />
                </Field>
                <button className="btn sage full">
                  <Briefcase size={16} /> Send application
                </button>
              </div>
            )}
          </form>
        </div>
      </section>
    </>
  )
}

export function Book() {
  const { update, notify, toast } = useStore()
  const [params] = useSearchParams()
  const [f, setF] = useState(() => ({
    name: '',
    email: '',
    phone: '',
    address: '',
    service: (params.get('service') as ServiceKey) || 'basic',
    addOns: ((params.get('addons') || '').split(',').filter(Boolean) as AddOnKey[]) || [],
    frequency: 'biweekly' as Booking['frequency'],
    homeSize: '',
    preferredDate: addDays(today(), 7),
    preferredTime: 'Morning',
    notes: '',
  }))
  const [hours, setHours] = useState(Number(params.get('hours')) || 2.5)
  const [done, setDone] = useState<Booking | null>(null)
  const est = useMemo(() => estimate(f.service, hours, f.addOns), [f.service, hours, f.addOns])
  const set = (k: keyof typeof f, v: unknown) => setF({ ...f, [k]: v })

  if (done)
    return (
      <>
        <PageHero title="Request received!" />
        <section className="section" style={{ paddingTop: 10 }}>
          <div className="wrap" style={{ maxWidth: 640 }}>
            <div className="card center stack">
              <CalendarCheck size={42} style={{ margin: '0 auto', color: 'var(--sage)' }} />
              <h2>Thanks, {done.name.split(' ')[0]}!</h2>
              <p>
                Dustin will reach out within a day to set up a free walk-through for your {SERVICES.find((s) => s.key === done.service)?.name}. Estimated {money(est.perVisit)} per visit.
              </p>
              <p className="small muted">Demo tip: switch to the owner (top of the app, “Viewing as”) and open Bookings to see this request arrive.</p>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Link className="btn" to="/">
                  Back home
                </Link>
                <Link className="btn sage" to="/login">
                  Try the owner view
                </Link>
              </div>
            </div>
          </div>
        </section>
      </>
    )

  return (
    <>
      <PageHero title="Book a cleaning" sub="Tell us about your space. No payment now — we’ll confirm a time and do a free walk-through first." />
      <section className="section" style={{ paddingTop: 20 }}>
        <form
          className="wrap grid g2"
          style={{ alignItems: 'start' }}
          onSubmit={(e) => {
            e.preventDefault()
            const b: Booking = { id: uid('bk'), createdAt: new Date().toISOString(), status: 'new', ...f, notes: `${f.notes}${f.notes ? '\n' : ''}Estimated ${hours} hrs/visit.` }
            update((d) => {
              d.bookings.unshift(b)
              d.users.filter((u) => u.role === 'owner' || u.role === 'manager').forEach((u) => notify(d, u.id, `New booking request from ${b.name}.`, '/app/bookings'))
            })
            toast('Request sent')
            setDone(b)
            window.scrollTo(0, 0)
          }}
        >
          <div className="card">
            <div className="form-grid">
              <Field label="Your name">
                <input required value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Phone">
                <input required type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" />
              </Field>
              <Field label="Email" full>
                <input required type="email" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
              </Field>
              <Field label="Address" full>
                <input required value={f.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" placeholder="Street, city" />
              </Field>
              <Field label="Service" full>
                <select value={f.service} onChange={(e) => set('service', e.target.value)}>
                  {SERVICES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name} — {s.rateLabel}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="How often">
                <select value={f.frequency} onChange={(e) => set('frequency', e.target.value)}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every other week</option>
                  <option value="monthly">Monthly</option>
                  <option value="as-needed">As needed</option>
                  <option value="one-time">One time</option>
                  <option value="project">Project</option>
                </select>
              </Field>
              <Field label="Home size">
                <input value={f.homeSize} onChange={(e) => set('homeSize', e.target.value)} placeholder="e.g. 3 bed / 2 bath" />
              </Field>
              <Field label="Preferred first date">
                <input type="date" min={today()} value={f.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} />
              </Field>
              <Field label="Preferred time">
                <select value={f.preferredTime} onChange={(e) => set('preferredTime', e.target.value)}>
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>After 6pm</option>
                  <option>Any</option>
                </select>
              </Field>
              <div className="full">
                <div className="small" style={{ fontWeight: 600, marginBottom: 6 }}>Add-ons</div>
                <div className="chips">
                  {ADDONS.map((a) => (
                    <button key={a.key} type="button" className={`chip${f.addOns.includes(a.key) ? ' on' : ''}`} onClick={() => set('addOns', toggle(f.addOns, a.key))}>
                      {f.addOns.includes(a.key) && <Check size={14} />} {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Anything we should know?" full hint="Pets, problem areas, access, accessibility needs — no judgement, ever.">
                <textarea rows={4} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
              </Field>
            </div>
          </div>
          <div className="card butter" style={{ position: 'sticky', top: 90 }}>
            <h3>Your estimate</h3>
            <Field label={`About how many hours per visit? ${hours}`}>
              <input type="range" min={1.5} max={8} step={0.5} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
            </Field>
            <div className="serif mt" style={{ fontSize: '2.2rem', color: 'var(--navy)' }}>{money(est.perVisit)}</div>
            <div className="small muted">per visit · {money(est.rate)}/hour</div>
            <ul className="ticks small mt">
              <li>Free walk-through before the first clean</li>
              <li>Your own written checklist (SOP) for every visit</li>
              <li>Pay by Venmo, Zelle or Square after each visit</li>
              <li>Cancel 48+ hours ahead for free</li>
            </ul>
            <button className="btn sage block lg mt">Send request</button>
          </div>
        </form>
      </section>
    </>
  )
}

export function Login() {
  const { state, setUser } = useStore()
  const nav = useNavigate()
  // where the person was headed before being asked to sign in (e.g. a company doc link)
  const from = (useLocation().state as { from?: string } | null)?.from
  const wantsDocs = !!from?.startsWith('/app/docs')
  const pick = (id: string) => {
    setUser(id)
    nav(from?.startsWith('/app') ? from : '/app')
  }
  const groups: { title: string; icon: typeof Users; role: string; blurb: string }[] = [
    { title: 'Owner', icon: ShieldCheck, role: 'owner', blurb: 'Schedule, approvals, payroll, bookings, invoices, clients, settings.' },
    { title: 'Employees', icon: Users, role: 'employee', blurb: 'Clock in/out, shifts, pay, PTO, expenses, onboarding, SOPs.' },
    { title: 'Clients', icon: Heart, role: 'client', blurb: 'Upcoming cleanings, cancel/reschedule, invoices, messages.' },
  ]
  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="section-title">
          <h2>Sign in</h2>
          <p>This is a demo: pick anyone to see the app as they would. Switch any time from “Viewing as” at the top.</p>
        </div>
        {wantsDocs && (
          <div className="notice warn" style={{ marginBottom: 16 }}>
            <ShieldCheck size={16} /> Company docs (handbooks, SOPs, agreements and home checklists) are for the GIST team. Sign in as the owner or an employee to open them.
          </div>
        )}
        <div className="grid g3">
          {groups.map((g) => (
            <div key={g.role} className="card login-card">
              <div className="row" style={{ gap: 8 }}>
                <g.icon />
                <h3 style={{ margin: 0 }}>{g.title}</h3>
              </div>
              <p className="small muted">{g.blurb}</p>
              <div className="stack" style={{ gap: 8 }}>
                {state.users
                  .filter((u) => u.role === g.role || (g.role === 'owner' && u.role === 'manager'))
                  .map((u) => (
                    <button key={u.id} className="btn light block" style={{ justifyContent: 'flex-start' }} onClick={() => pick(u.id)}>
                      <Avatar name={u.name} color={u.color} />
                      <span style={{ textAlign: 'left' }}>
                        <div>{u.name}</div>
                        <div className="tiny muted" style={{ fontWeight: 500 }}>{u.title}</div>
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
        <p className="small muted center mt">
          In production this is a real login (email magic link or Google) — see the repo’s docs/BACKEND.md.
        </p>
      </div>
    </section>
  )
}

export function AboutApp() {
  return (
    <>
      <PageHero title="About this prototype" sub="One app for everything GIST: the public website, client booking, and the team tools GIST currently uses Gusto for." />
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="wrap md" style={{ maxWidth: 820 }}>
          <p>
            Built by Robert (a GIST cleaning tech) as a concept for Dustin. It runs entirely in your browser or on an Android phone — all data is
            made-up demo data stored on your device, so you can click everything without breaking anything. <b>Settings → Reset demo data</b> starts fresh.
          </p>
          <h3>Try it</h3>
          <ul>
            <li>
              <Link to="/book">Book a cleaning</Link> as a visitor, then <Link to="/login">sign in as the owner</Link> to see it arrive in Bookings.
            </li>
            <li>Sign in as Jamie (employee) to clock in at today’s client, tick off the home’s checklist, and see paystubs.</li>
            <li>Sign in as Taylor (new hire) to walk through onboarding: W-4, I-9, direct deposit, and signing the handbook.</li>
            <li>Sign in as a client to cancel a visit (fee shown up-front) or pay an invoice.</li>
            <li>Tap the ✨ button anywhere to ask the GIST Assistant about policies, SOPs, schedules or pay.</li>
          </ul>
          <h3>What’s inside</h3>
          <ul>
            <li>Everything from gistcleaning.com: services, pricing, add-ons, about, cancellation policy, updates and the organization gallery.</li>
            <li>Every company Google Drive doc (SOPs, handbooks, agreements, client SOPs, project lists), readable and downloadable as Word, PDF, Markdown or text inside the team app (owner and employees, after sign-in; not on the public site or for clients). Client docs are pseudonymized in this demo.</li>
            <li>Gusto-style team tools: geofenced time clock, schedules and open shifts, availability, time-off and PTO accrual, semi-monthly payroll with paystubs, expenses and reimbursements, supply and gas cards, onboarding forms and e-signatures.</li>
          </ul>
          <p className="small muted">Source code and setup notes are on GitHub (link in the README). Not affiliated with Gusto.</p>
        </div>
      </section>
    </>
  )
}
