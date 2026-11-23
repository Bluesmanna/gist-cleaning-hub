import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, BookOpen, Briefcase, Calendar, CalendarCheck, CalendarClock, CheckSquare, Clock, CreditCard, DollarSign, FileText, Home,
  Inbox, LayoutDashboard, LogOut, Menu, MessageSquare, MoreHorizontal, Receipt, Settings, Sparkles, Umbrella, User, UserPlus, Users,
  BarChart3, ClipboardCheck, Wallet, X, ThumbsUp,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { COMPANY } from '../data/site'
import { relTime } from '../lib/dates'
// The assistant (and its knowledge base) downloads the first time someone opens it.
const AiChat = lazy(() => import('./AiChat').then((m) => ({ default: m.AiChat })))
import { useBackClose } from '../lib/back'
import { Avatar, DemoBanner, Logo, Modal } from './ui'

/* ---------------- public site ---------------- */
const SITE_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/organization', label: 'Organization' },
  { to: '/contact', label: 'Contact' },
  { to: '/policies', label: 'Cancellation Policy' },
  { to: '/updates', label: 'Updates' },
]

function useScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
}

function useNarrow(px = 900) {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth <= px)
  useEffect(() => {
    const m = window.matchMedia(`(max-width: ${px}px)`)
    const f = () => setN(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [px])
  return n
}

export function PublicLayout() {
  useScrollTop()
  const { me, toastMsg } = useStore()
  const [open, setOpen] = useState(false)
  const [ai, setAi] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useBackClose(open, () => setOpen(false))
  return (
    <>
      <DemoBanner />
      <header className="site-header">
        <div className="wrap">
          <Logo />
          <button className="icon-btn menu-btn" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
          <nav className={`site-nav${open ? ' open' : ''}`} aria-label="Main">
            {SITE_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}>
                {n.label}
              </NavLink>
            ))}
            <Link className="btn sage sm" to="/book">
              Book a cleaning
            </Link>
            <Link className="btn ghost sm" to={me ? '/app' : '/login'}>
              {me ? 'Open app' : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="wrap cols">
          <div className="stack">
            <Logo />
            <div className="muted small">
              {COMPANY.city} · <a style={{ display: 'inline' }} href={`tel:${COMPANY.phone}`}>{COMPANY.phone}</a> ·{' '}
              <a style={{ display: 'inline' }} href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            </div>
            <a href={COMPANY.facebook} target="_blank" rel="noreferrer" className="row small" style={{ gap: 6 }}>
              <ThumbsUp size={16} /> GIST Cleaning on Facebook
            </a>
          </div>
          <div>
            <h4>Services</h4>
            <Link to="/services">Cleaning</Link>
            <Link to="/organization">Organization</Link>
            <Link to="/business">GIST for Business</Link>
            <Link to="/pricing">Pricing & add-ons</Link>
          </div>
          <div>
            <h4>Company</h4>
            <Link to="/about">About</Link>
            <Link to="/updates">Updates</Link>
            <Link to="/careers">Careers</Link>
            <Link to="/policies">Cancellation policy</Link>
          </div>
          <div>
            <h4>Hub</h4>
            <Link to="/book">Book a cleaning</Link>
            <Link to="/login">Client & team sign-in</Link>
            <Link to="/about-this-app">About this prototype</Link>
          </div>
        </div>
      </footer>
      {!ai && (
        <button className="ai-fab no-print" onClick={() => setAi(true)} aria-label="Ask the GIST assistant" title="Ask the GIST assistant">
          <Sparkles size={24} />
        </button>
      )}
      {ai && <Suspense fallback={null}><AiChat onClose={() => setAi(false)} /></Suspense>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </>
  )
}

/* ---------------- signed-in app ---------------- */
interface NavItem {
  to: string
  label: string
  icon: typeof Home
  count?: number
  group?: string
}

function navFor(role: string, counts: Record<string, number>): { items: NavItem[]; bottom: string[] } {
  if (role === 'employee')
    return {
      items: [
        { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
        { to: '/app/schedule', label: 'Schedule', icon: Calendar },
        { to: '/app/time', label: 'Time', icon: Clock },
        { to: '/app/pay', label: 'Pay', icon: DollarSign },
        { to: '/app/time-off', label: 'Time off', icon: Umbrella, group: 'Me' },
        { to: '/app/availability', label: 'Availability', icon: CalendarClock },
        { to: '/app/expenses', label: 'Expenses', icon: Receipt },
        { to: '/app/cards', label: 'Cards', icon: CreditCard },
        { to: '/app/tasks', label: 'Tasks', icon: CheckSquare, count: counts.tasks },
        { to: '/app/onboarding', label: 'Documents & onboarding', icon: ClipboardCheck },
        { to: '/app/docs', label: 'Handbook & SOPs', icon: BookOpen, group: 'Team' },
        { to: '/app/messages', label: 'Messages', icon: MessageSquare },
        { to: '/app/assistant', label: 'Assistant', icon: Sparkles },
        { to: '/app/profile', label: 'Profile', icon: User },
      ],
      bottom: ['/app', '/app/schedule', '/app/time', '/app/pay'],
    }
  if (role === 'client')
    return {
      items: [
        { to: '/app', label: 'Home', icon: Home },
        { to: '/app/visits', label: 'My cleanings', icon: CalendarCheck },
        { to: '/app/request', label: 'Request a cleaning', icon: UserPlus },
        { to: '/app/invoices', label: 'Invoices', icon: Wallet, count: counts.invoices },
        { to: '/app/messages', label: 'Messages', icon: MessageSquare },
        { to: '/app/preferences', label: 'Home preferences', icon: Settings },
        { to: '/app/assistant', label: 'Assistant', icon: Sparkles },
      ],
      bottom: ['/app', '/app/visits', '/app/invoices', '/app/messages'],
    }
  return {
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/app/schedule', label: 'Schedule', icon: Calendar },
      { to: '/app/approvals', label: 'Approvals', icon: CheckSquare, count: counts.approvals },
      { to: '/app/payroll', label: 'Payroll', icon: DollarSign },
      { to: '/app/team', label: 'Team', icon: Users, group: 'Business' },
      { to: '/app/clients', label: 'Clients', icon: Home },
      { to: '/app/bookings', label: 'Bookings', icon: Inbox, count: counts.bookings },
      { to: '/app/invoices', label: 'Invoices', icon: FileText },
      { to: '/app/reports', label: 'Reports', icon: BarChart3 },
      { to: '/app/messages', label: 'Messages', icon: MessageSquare, group: 'Tools' },
      { to: '/app/docs', label: 'SOPs & docs', icon: BookOpen },
      { to: '/app/assistant', label: 'Assistant', icon: Sparkles },
      { to: '/app/settings', label: 'Settings', icon: Settings },
    ],
    bottom: ['/app', '/app/schedule', '/app/approvals', '/app/clients'],
  }
}

export function RoleSwitcher() {
  const { state, me, setUser } = useStore()
  const nav = useNavigate()
  const phone = useNarrow(620) // phones: names only (the group already says the role)
  const groups: [string, string][] = [
    ['owner', 'Owner'],
    ['employee', 'Employees'],
    ['client', 'Clients'],
  ]
  return (
    <label className="role-switch">
      <span className="demo-chip" title="Prototype only: in the real app you are signed in as one person">Demo</span>
      <span className="lbl small muted">viewing as</span>
      <select
        aria-label="Switch demo user"
        value={me?.id || ''}
        onChange={(e) => {
          const id = e.target.value || null
          setUser(id)
          nav(id ? '/app' : '/')
        }}
      >
        {groups.map(([r, label]) => (
          <optgroup key={r} label={label}>
            {state.users
              .filter((u) => u.role === r || (r === 'owner' && u.role === 'manager'))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {phone ? u.name : `${u.name} — ${u.title}`}
                </option>
              ))}
          </optgroup>
        ))}
        <option value="">Public website (signed out)</option>
      </select>
    </label>
  )
}

function Notifications() {
  const { state, me, update } = useStore()
  const [open, setOpen] = useState(false)
  const mine = state.notices.filter((n) => n.userId === me?.id)
  const unread = mine.filter((n) => !n.read).length
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useBackClose(open, () => setOpen(false))
  return (
    <>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell size={20} />
        {unread > 0 && <span className="pip">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Notifications">
          <div className="head">
            <b>Notifications</b>
            {unread > 0 && (
              <button className="linkbtn small" onClick={() => update((d) => d.notices.forEach((n) => n.userId === me?.id && (n.read = true)))}>
                Mark all read
              </button>
            )}
          </div>
          {mine.length === 0 && <div className="empty small">You’re all caught up.</div>}
          {mine.slice(0, 30).map((n) => (
            <Link
              key={n.id}
              to={n.link || '#'}
              className={`notif${n.read ? '' : ' unread'}`}
              onClick={() => update((d) => void (d.notices.find((x) => x.id === n.id)!.read = true))}
            >
              <div>{n.text}</div>
              <div className="tiny muted">{relTime(n.at)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

export function AppLayout({ title }: { title?: ReactNode }) {
  useScrollTop()
  const { state, me, role, setUser, toastMsg } = useStore()
  const nav = useNavigate()
  const narrow = useNarrow()
  const [ai, setAi] = useState(false)
  const [more, setMore] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setMore(false) }, [pathname])
  useBackClose(more, () => setMore(false))

  if (!me) return null
  const counts = {
    tasks: state.tasks.filter((t) => t.userId === me.id && !t.done).length,
    invoices: state.invoices.filter((i) => i.clientId === me.clientId && i.status === 'sent').length,
    approvals: state.time.filter((t) => t.status === 'submitted').length + state.timeOff.filter((t) => t.status === 'pending').length + state.expenses.filter((e) => e.status === 'pending').length,
    bookings: state.bookings.filter((b) => b.status === 'new').length,
  }
  const { items, bottom } = navFor(role, counts)
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((i) => (i.to === '/app' ? pathname === '/app' : pathname.startsWith(i.to)))
  const onAssistant = pathname === '/app/assistant'

  return (
    <div className={narrow ? 'has-bottom-nav' : ''}>
      <DemoBanner />
      <div className="app">
        <aside className="sidebar">
          <div className="top">
            <Logo small to="/app" />
          </div>
          <nav aria-label="App">
            {items.map((i) => (
              <div key={i.to}>
                {i.group && <div className="grp">{i.group}</div>}
                <NavLink to={i.to} end={i.to === '/app'}>
                  <i.icon size={18} /> {i.label}
                  {!!i.count && <span className="count">{i.count}</span>}
                </NavLink>
              </div>
            ))}
            <div className="grp">Website</div>
            <NavLink to="/">
              <Briefcase size={18} /> Public site
            </NavLink>
          </nav>
          <div className="me">
            <Avatar name={me.name} color={me.color} />
            <div className="grow">
              <div className="small" style={{ fontWeight: 700 }}>{me.name}</div>
              <div className="tiny muted">{me.title}</div>
            </div>
            <button
              className="icon-btn"
              title="Sign out"
              aria-label="Sign out"
              onClick={() => {
                setUser(null)
                nav('/')
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </aside>
        <div className="main">
          <header className="topbar no-print">
            <div className="in">
              <span className="mobile-logo">
                <Link to="/app" aria-label="Home">
                  <img src="./gist-logo.svg" alt="" width={30} height={30} />
                </Link>
              </span>
              <h1 className="grow">{title ?? current?.label ?? 'GIST'}</h1>
              <RoleSwitcher />
              {narrow && !onAssistant && (
                <button className="icon-btn no-print" onClick={() => setAi(true)} aria-label="Ask the GIST assistant" title="Ask the GIST assistant">
                  <Sparkles size={20} />
                </button>
              )}
              <Notifications />
            </div>
          </header>
          <main className="page">
            <Outlet />
          </main>
        </div>
      </div>
      {narrow && (
        <nav className="bottom-nav no-print" aria-label="Quick">
          {bottom.map((to) => {
            const i = items.find((x) => x.to === to)!
            return (
              <NavLink key={to} to={to} end={to === '/app'}>
                <i.icon size={22} />
                {i.label.split(' ')[0]}
                {!!i.count && <span className="count">{i.count}</span>}
              </NavLink>
            )
          })}
          <button onClick={() => setMore(true)} aria-label="More">
            <MoreHorizontal size={22} />
            More
          </button>
        </nav>
      )}
      {more && (
        <Modal title="More" onClose={() => setMore(false)}>
          <div className="more-sheet">
            {items
              .filter((i) => !bottom.includes(i.to))
              .map((i) => (
                <Link key={i.to} to={i.to}>
                  <i.icon size={20} /> {i.label}
                  {!!i.count && <span className="badge danger" style={{ marginLeft: 'auto' }}>{i.count}</span>}
                </Link>
              ))}
            <Link to="/">
              <Briefcase size={20} /> Public website
            </Link>
            <Link
              to="/"
              onClick={() => {
                setUser(null)
              }}
            >
              <LogOut size={20} /> Sign out
            </Link>
          </div>
        </Modal>
      )}
      {!ai && !onAssistant && !narrow && (
        <button className="ai-fab no-print" onClick={() => setAi(true)} aria-label="Ask the GIST assistant" title="Ask the GIST assistant">
          <Sparkles size={24} />
        </button>
      )}
      {ai && <Suspense fallback={null}><AiChat onClose={() => setAi(false)} /></Suspense>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  )
}
