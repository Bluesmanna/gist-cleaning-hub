// Small shared UI pieces. Kept dependency-free apart from lucide icons and
// react-markdown so the bundle stays light on phones.
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Inbox, X } from 'lucide-react'
import { COMPANY, IMAGES } from '../data/site'
import { useBackClose } from '../lib/back'

export function Logo({ small, to = '/' }: { small?: boolean; to?: string }) {
  return (
    <Link to={to} className={`logo${small ? ' sm' : ''}`} aria-label={`${COMPANY.name} home`}>
      <img src={IMAGES.logo} alt="" width={40} height={40} />
      <span>
        <span className="name">{COMPANY.name}</span>
        {!small && <span className="tag">{COMPANY.tagline}</span>}
      </span>
    </Link>
  )
}

export function DemoBanner() {
  return (
    <div className="demo-banner no-print" role="note">
      <span className="long">
        Concept prototype built by Robert for GIST Cleaning — not the official site (that’s{' '}
        <a href={COMPANY.website} target="_blank" rel="noreferrer">gistcleaning.com</a>). Client and pay data here are made up.
      </span>
      <span className="short">
        Concept prototype by Robert, demo data — official site:{' '}
        <a href={COMPANY.website} target="_blank" rel="noreferrer">gistcleaning.com</a>
      </span>
    </div>
  )
}

export function Card({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          {typeof title === 'string' ? <h3>{title}</h3> : title}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card stat">
      <span className="label">{label}</span>
      <span className="value">{value}</span>
      {sub && <span className="sub">{sub}</span>}
    </div>
  )
}

const TONE: Record<string, string> = {
  approved: 'ok', paid: 'ok', processed: 'ok', scheduled: 'ok', done: 'ok', active: 'ok', signed: 'ok', complete: 'ok', published: 'ok',
  pending: 'warn', submitted: 'warn', sent: 'warn', new: 'warn', open: 'info', draft: 'info', contacted: 'info',
  rejected: 'danger', denied: 'danger', declined: 'danger', void: 'danger', overdue: 'danger', missing: 'danger',
}
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const t = tone ?? TONE[String(children).toLowerCase()] ?? ''
  return <span className={`badge ${t}`}>{children}</span>
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useBackClose(true, onClose)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab${value === t.id ? ' on' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox size={34} />}
      <div>{children}</div>
    </div>
  )
}

export function Avatar({ name, color, lg }: { name: string; color?: string; lg?: boolean }) {
  const init = name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <span className={`avatar${lg ? ' lg' : ''}`} style={{ background: color || '#4d7393' }} aria-hidden>
      {init}
    </span>
  )
}

export function Field({ label, hint, children, full }: { label: ReactNode; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

export function DateBox({ date }: { date: string }) {
  const d = new Date(date + 'T12:00:00')
  return (
    <span className="datebox" aria-hidden>
      <span className="m">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
      <span className="d">{d.getDate()}</span>
    </span>
  )
}


export function Lightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index)
  useBackClose(true, onClose)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length)
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [images.length, onClose])
  return (
    <div className="lightbox" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <img src={images[i]} alt={`Photo ${i + 1} of ${images.length}`} />
      <button className="btn light icon x" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
      {images.length > 1 && (
        <>
          <button className="btn light icon nav l" onClick={() => setI((i - 1 + images.length) % images.length)} aria-label="Previous">
            <ChevronLeft size={20} />
          </button>
          <button className="btn light icon nav r" onClick={() => setI((i + 1) % images.length)} aria-label="Next">
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
    </div>
  )
}

