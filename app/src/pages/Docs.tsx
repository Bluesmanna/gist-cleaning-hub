// Company document library (public site + in-app). Every Google Drive doc is readable
// here and downloadable as Word / PDF / Markdown / plain text.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Download, FileText, Lock, PenLine, Printer, Search, Upload } from 'lucide-react'
import { useStore } from '../lib/store'
import { DOCS, DOC_CATEGORIES, docBySlug, docFileUrl, importPack, loadPack, onPackChange, removePack, type PackDoc } from '../lib/docs'
import { base64ToBlob, saveBlob, saveText, saveUrl } from '../lib/download'
import { fmtDateTime } from '../lib/dates'
import { AiButton } from '../components/AiChat'
import { Badge, Empty, Markdown, Modal, Tabs } from '../components/ui'

export function usePack() {
  const [pack, setPack] = useState<Map<string, PackDoc>>(new Map())
  useEffect(() => {
    let alive = true
    const load = () => loadPack().then((p) => alive && setPack(new Map(p)))
    load()
    const off = onPackChange(load)
    return () => {
      alive = false
      off()
    }
  }, [])
  return pack
}

/** Docs that need a signature during onboarding. */
export const SIGNABLE = ['handbook-rct', 'handbook-subrct', 'agreement-rct', 'agreement-subrct', 'sop-general']

export function DocsList({ base = '/docs' }: { base?: string }) {
  const { role } = useStore()
  const pack = usePack()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const fileRef = useRef<HTMLInputElement>(null)
  const { toast } = useStore()
  const list = useMemo(() => {
    const t = q.toLowerCase().trim()
    return DOCS.filter((d) => (cat === 'All' || d.category === cat) && (!t || d.title.toLowerCase().includes(t) || d.md.toLowerCase().includes(t)))
  }, [q, cat])
  const isStaff = role === 'owner' || role === 'manager' || role === 'employee'
  const inApp = base.startsWith('/app')

  return (
    <div className={inApp ? '' : 'section'} style={inApp ? undefined : { paddingTop: 30 }}>
      <div className={inApp ? '' : 'wrap'}>
        {!inApp && (
          <div className="section-title">
            <h2>Company docs</h2>
            <p>Every GIST document — SOPs, handbooks, agreements, client checklists and project lists. Read here or download as Word, PDF, Markdown or text.</p>
          </div>
        )}
        <div className="row between" style={{ marginBottom: 14 }}>
          <label className="field grow" style={{ maxWidth: 420, margin: 0 }}>
            <span className="sr-only">Search docs</span>
            <div className="row nowrap" style={{ gap: 6 }}>
              <Search size={18} className="muted" />
              <input placeholder="Search all docs…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </label>
          {isStaff && (
            <div className="row">
              {pack.size > 0 ? (
                <>
                  <Badge tone="ok">Private pack loaded ({pack.size} real docs)</Badge>
                  <button className="btn light sm" onClick={() => removePack().then(() => toast('Private pack removed from this device'))}>
                    Remove
                  </button>
                </>
              ) : (
                <button className="btn light sm" onClick={() => fileRef.current?.click()} title="Load the real (non-pseudonymized) client docs on this device">
                  <Upload size={15} /> Import private pack
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  try {
                    const n = await importPack(f)
                    toast(`Loaded ${n} private docs on this device`)
                  } catch (err) {
                    toast((err as Error).message)
                  }
                }}
              />
            </div>
          )}
        </div>
        <Tabs tabs={['All', ...DOC_CATEGORIES].map((c) => ({ id: c, label: `${c} (${c === 'All' ? DOCS.length : DOCS.filter((d) => d.category === c).length})` }))} value={cat} onChange={setCat} />
        {list.length === 0 && <Empty>No docs match “{q}”.</Empty>}
        <div className="grid g3 mt">
          {list.map((d) => (
            <Link key={d.slug} to={`${base}/${d.slug}`} className="card link" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="row between nowrap">
                <span className="badge info">{d.category}</span>
                {d.pseudonymized && (pack.has(d.slug) ? <Badge tone="ok">real</Badge> : <span className="tiny muted" title="Names, phones, addresses and codes replaced in the public version"><Lock size={12} /> pseudonymized</span>)}
              </div>
              <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{d.title}</h3>
              <p className="small muted" style={{ margin: 0 }}>{d.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function DocView({ base = '/docs' }: { base?: string }) {
  const { slug = '' } = useParams()
  const { state, me, role, update, notify, toast } = useStore()
  const pack = usePack()
  const doc = docBySlug(slug)
  const [sign, setSign] = useState(false)
  const [sigName, setSigName] = useState(me?.name || '')
  const inApp = base.startsWith('/app')
  if (!doc) return <Empty>Document not found. <Link to={base}>Back to docs</Link></Empty>
  const real = pack.get(slug)
  const md = real?.md || doc.md
  const signed = me ? state.signatures.find((s) => s.docSlug === slug && s.userId === me.id) : undefined
  const canSign = me && role === 'employee' && SIGNABLE.includes(slug)

  async function download(ext: 'md' | 'txt' | 'docx' | 'pdf') {
    try {
      if (real) {
        if (ext === 'md') return saveText(real.md, `${slug}.md`, 'text/markdown')
        if (ext === 'txt') return saveText(real.md.replace(/[*_#>`]/g, ''), `${slug}.txt`)
        const b64 = ext === 'docx' ? real.docx : real.pdf
        if (b64) return saveBlob(base64ToBlob(b64, ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), `${slug}.${ext}`)
      }
      await saveUrl(docFileUrl(slug, ext), `${slug}.${ext}`)
    } catch (e) {
      toast((e as Error).message)
    }
  }

  return (
    <div className={inApp ? '' : 'section'} style={inApp ? undefined : { paddingTop: 24 }}>
      <div className={inApp ? '' : 'wrap'} style={{ maxWidth: 920 }}>
        <Link to={base} className="small row" style={{ gap: 4, marginBottom: 10 }}>
          <ArrowLeft size={16} /> All docs
        </Link>
        <div className="card">
          <div className="doc-toolbar no-print">
            <span className="badge info">{doc.category}</span>
            {doc.pseudonymized && !real && (
              <span className="badge warn" title="Names, phones, addresses, door codes and photos are replaced in the public version">
                <Lock size={12} /> pseudonymized
              </span>
            )}
            {real && <Badge tone="ok">real version (this device only)</Badge>}
            <span className="grow" />
            <button className="btn light sm" onClick={() => download('docx')}>
              <Download size={15} /> Word
            </button>
            <button className="btn light sm" onClick={() => download('pdf')}>
              <FileText size={15} /> PDF
            </button>
            <button className="btn light sm" onClick={() => download('md')}>
              .md
            </button>
            <button className="btn light sm" onClick={() => download('txt')}>
              .txt
            </button>
            <button className="btn light sm" onClick={() => window.print()} aria-label="Print">
              <Printer size={15} />
            </button>
          </div>
          <div className="row between" style={{ margin: '6px 0 4px' }}>
            <div className="tiny muted">Source: {doc.source}</div>
            <AiButton task="doc-qa" label="Ask AI about this doc" docSlug={slug} prompt={`Summarize "${doc.title}" in a few bullet points: what it covers and the most important rules or steps.`} />
          </div>
          {canSign && (
            <div className={`notice ${signed ? 'ok' : 'warn'} no-print`} style={{ margin: '10px 0' }}>
              {signed ? (
                <>
                  <PenLine size={16} /> Signed by {signed.name} on {fmtDateTime(signed.at)}.
                </>
              ) : (
                <div className="row between" style={{ width: '100%' }}>
                  <span>
                    <PenLine size={16} /> Please read and sign this document.
                  </span>
                  <button className="btn sage sm" onClick={() => setSign(true)}>
                    Sign
                  </button>
                </div>
              )}
            </div>
          )}
          <Markdown md={md} />
        </div>
      </div>
      {sign && me && (
        <Modal
          title="Sign document"
          onClose={() => setSign(false)}
          footer={
            <>
              <button className="btn light" onClick={() => setSign(false)}>
                Cancel
              </button>
              <button
                className="btn sage"
                disabled={sigName.trim().length < 3}
                onClick={() => {
                  update((d) => {
                    d.signatures.push({ docSlug: slug, userId: me.id, name: sigName.trim(), at: new Date().toISOString() })
                    const u = d.users.find((x) => x.id === me.id)
                    if (u?.onboarding) {
                      if (slug.startsWith('handbook')) u.onboarding.handbookSigned = true
                      if (slug.startsWith('agreement')) u.onboarding.agreementSigned = true
                    }
                    const both = u?.onboarding?.handbookSigned && u?.onboarding?.agreementSigned
                    if (both) d.tasks.filter((t) => t.userId === me.id && /sign/i.test(t.title)).forEach((t) => (t.done = true))
                    notify(d, 'u_owner', `${me.name} signed “${doc.title}”.`, `/app/team/${me.id}`)
                  })
                  setSign(false)
                  toast('Signed')
                }}
              >
                <PenLine size={16} /> Sign
              </button>
            </>
          }
        >
          <p className="small">
            By typing your full name you agree that you’ve read <b>{doc.title}</b> and that this is your electronic signature.
          </p>
          <label className="field">
            <span>Full name</span>
            <input value={sigName} onChange={(e) => setSigName(e.target.value)} autoFocus />
          </label>
          <div className="signature mt">{sigName || ' '}</div>
        </Modal>
      )}
    </div>
  )
}
