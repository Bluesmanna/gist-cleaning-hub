// The GIST Assistant: a chat panel that knows the business (docs, prices, policies) and
// the signed-in person's own data. Also the small "AI action" button used around the app
// (Explain my paystub, Draft a reply, Ask about this doc, Draft a quote).
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useStore } from '../lib/store'
import { ask, type AiMessage, type AiRequest, type AiResult, type AiTask } from '../lib/ai/provider'
import { Modal } from './ui'
import { Markdown } from './Markdown'
import { useBackClose } from '../lib/back'

interface Turn extends AiMessage {
  result?: AiResult
}

// Conversations survive closing the panel (per signed-in user) for the session.
const HISTORY = new Map<string, Turn[]>()

const PROVIDER_LABEL = { offline: 'Offline assistant (built-in)', bridge: 'Claude via your PC bridge', anthropic: 'Claude API' }

function suggestions(role: string): string[] {
  if (role === 'employee') return ['When is my next shift?', 'How much PTO do I have?', 'What will my next paycheck be?', 'How do I clean the shower glass?', 'What do I do if I break something?']
  if (role === 'owner' || role === 'manager') return ['What’s waiting on me?', 'Who’s working today?', 'How much is unpaid?', 'What’s our cancellation fee for 10 hours notice?', 'Summarize the employee PTO policy']
  if (role === 'client') return ['When is my next cleaning?', 'Do I owe anything?', 'What does the cancellation policy say?', 'How much is a 3 hour clean with tidying?']
  return ['How much does a cleaning cost?', 'What’s included in a basic clean?', 'What’s the cancellation policy?', 'Do you do organization projects?', 'Are you hiring?']
}

export function AiChat({ onClose, inline }: { onClose?: () => void; inline?: boolean }) {
  const { state, me, role } = useStore()
  const key = me?.id || 'public'
  const [turns, setTurns] = useState<Turn[]>(() => HISTORY.get(key) || [])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  useBackClose(!inline && !!onClose, () => onClose?.())

  useEffect(() => {
    HISTORY.set(key, turns)
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, key])
  useEffect(() => {
    setTurns(HISTORY.get(key) || [])
  }, [key])
  useEffect(() => {
    // Focus the box on desktop; on touch screens the keyboard would cover the suggestions.
    if (!inline && !window.matchMedia('(pointer: coarse)').matches) input.current?.focus()
  }, [inline])

  async function send(q: string) {
    const question = q.trim()
    if (!question || busy) return
    const next: Turn[] = [...turns, { role: 'user', content: question }]
    setTurns(next)
    setText('')
    setBusy(true)
    const res = await ask({ task: 'chat', messages: next.map(({ role, content }) => ({ role, content })) }, state, me)
    setTurns([...next, { role: 'assistant', content: res.text, result: res }])
    setBusy(false)
  }

  return (
    <div className={`ai-panel${inline ? ' inline' : ''}`} role="dialog" aria-label="GIST Assistant">
      <div className="ai-head">
        <Sparkles size={20} color="#5f7440" />
        <div className="grow">
          <div className="t">GIST Assistant</div>
          <div className="tiny muted">{PROVIDER_LABEL[state.settings.aiProvider]}</div>
        </div>
        {turns.length > 0 && (
          <button className="icon-btn" title="Clear conversation" aria-label="Clear conversation" onClick={() => setTurns([])}>
            <Trash2 size={17} />
          </button>
        )}
        {onClose && (
          <button className="icon-btn" onClick={onClose} aria-label="Close assistant">
            <X size={20} />
          </button>
        )}
      </div>
      <div className="ai-msgs" aria-live="polite">
        {turns.length === 0 && (
          <div className="stack">
            <div className="bubble assistant">
              <div className="md">
                <p>
                  Hi{me ? ` ${me.name.split(' ')[0]}` : ''}! I know GIST’s services, prices, policies, every SOP and handbook
                  {me && role !== 'public' ? ', and your own ' + (role === 'client' ? 'visits and invoices' : role === 'employee' ? 'schedule, hours and pay' : 'business data') : ''}. Ask me anything.
                </p>
              </div>
            </div>
            <div className="suggest">
              {suggestions(role).map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.role === 'user' ? (
              t.content
            ) : (
              <>
                <Markdown md={t.content} onLink={inline ? undefined : onClose} />
                {t.result?.sources && t.result.sources.length > 0 && (
                  <div className="src">
                    {dedupe(t.result.sources).map((s) => (
                      <Link key={s.link + s.heading} to={s.link} onClick={inline ? undefined : onClose} title={s.heading}>
                        {s.title}
                      </Link>
                    ))}
                  </div>
                )}
                {t.result?.note && <div className="note">{t.result.note}</div>}
              </>
            )}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant">
            <span className="typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        className="ai-input"
        onSubmit={(e) => {
          e.preventDefault()
          send(text)
        }}
      >
        <textarea
          ref={input}
          rows={1}
          value={text}
          placeholder="Ask about GIST…"
          aria-label="Message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send(text)
            }
          }}
        />
        <button className="btn icon sage" type="submit" disabled={busy || !text.trim()} aria-label="Send">
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}

function dedupe<T extends { title: string }>(xs: T[]) {
  const seen = new Set<string>()
  return xs.filter((x) => (seen.has(x.title) ? false : (seen.add(x.title), true)))
}

/** A button that runs one AI task and shows the answer in a modal. */
export function AiButton({ task, label, prompt, extra, docSlug, className = 'btn light sm', onUse, useLabel = 'Use this' }: { task: AiTask; label: string; prompt: string; extra?: string; docSlug?: string; className?: string; onUse?: (text: string) => void; useLabel?: string }) {
  const { state, me, toast } = useStore()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<AiResult | null>(null)

  async function run() {
    setOpen(true)
    setBusy(true)
    setRes(null)
    const req: AiRequest = { task, messages: [{ role: 'user', content: prompt }], extra, docSlug }
    setRes(await ask(req, state, me))
    setBusy(false)
  }

  return (
    <>
      <button className={className} onClick={run} type="button">
        <Sparkles size={15} /> {label}
      </button>
      {open && (
        <Modal
          title={
            <span className="row nowrap">
              <Sparkles size={20} color="#5f7440" /> {label}
            </span>
          }
          onClose={() => setOpen(false)}
          footer={
            res && (
              <>
                <button
                  className="btn light"
                  onClick={() => {
                    navigator.clipboard?.writeText(res.text).then(() => toast('Copied'), () => toast('Copy failed'))
                  }}
                >
                  <Copy size={16} /> Copy
                </button>
                {onUse && (
                  <button
                    className="btn sage"
                    onClick={() => {
                      onUse(res.text)
                      setOpen(false)
                    }}
                  >
                    {useLabel}
                  </button>
                )}
                <button className="btn" onClick={() => setOpen(false)}>
                  Done
                </button>
              </>
            )
          }
        >
          {busy ? (
            <div className="row">
              <div className="spinner" /> Thinking…
            </div>
          ) : (
            res && (
              <div>
                <Markdown md={res.text} onLink={() => setOpen(false)} />
                {res.note && <div className="notice warn small mt">{res.note}</div>}
                <div className="tiny muted mt">Answered by: {PROVIDER_LABEL[res.provider]}. AI can make mistakes — check anything important.</div>
              </div>
            )
          )}
        </Modal>
      )}
    </>
  )
}
