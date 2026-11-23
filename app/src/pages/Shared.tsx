// Screens every signed-in role shares: messages (owner sees every thread) and the AI assistant.
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Send } from 'lucide-react'
import { useStore, clientOf, userName } from '../lib/store'
import type { State } from '../lib/types'
import { fmtDateTime, relTime, uid } from '../lib/dates'
import { AiButton, AiChat } from '../components/AiChat'
import { Avatar, Card, Empty } from '../components/ui'

function threadTitle(s: State, id: string) {
  return clientOf(s, id)?.household || userName(s, id)
}

export function Messages() {
  const { state, me, role, update, notify } = useStore()
  const isOwner = role === 'owner' || role === 'manager'
  const myThread = role === 'client' ? me?.clientId : me?.id
  const threads = isOwner
    ? [...new Set([...state.messages.map((m) => m.threadId), ...state.users.filter((u) => u.role === 'employee' && u.active !== false).map((u) => u.id), ...state.clients.filter((c) => c.active).map((c) => c.id)])]
        .map((id) => ({ id, last: state.messages.filter((m) => m.threadId === id).slice(-1)[0] }))
        .sort((a, b) => (b.last?.at || '').localeCompare(a.last?.at || ''))
    : []
  const [open, setOpen] = useState<string | null>(isOwner ? null : myThread || null)
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const msgs = state.messages.filter((m) => m.threadId === open)
  useEffect(() => {
    const log = end.current?.parentElement
    if (log) log.scrollTop = log.scrollHeight
  }, [msgs.length, open])
  if (!me) return null

  function send() {
    const t = text.trim()
    if (!t || !open) return
    update((d) => {
      d.messages.push({ id: uid('m'), threadId: open, fromId: me!.id, text: t, at: new Date().toISOString() })
      if (isOwner) {
        const target = d.users.find((u) => u.id === open || u.clientId === open)
        if (target) notify(d, target.id, `New message from ${me!.name.split(' ')[0]}: “${t.slice(0, 60)}”`, '/app/messages')
      } else notify(d, 'u_owner', `${threadTitle(d, open)}: “${t.slice(0, 60)}”`, '/app/messages')
    })
    setText('')
  }

  const lastIn = [...msgs].reverse().find((m) => m.fromId !== me.id)
  const conv = open && (
    <Card className="chat-card" title={isOwner ? <div className="row nowrap"><button className="icon-btn" aria-label="Back to threads" onClick={() => setOpen(null)}><ChevronLeft size={18} /></button><b>{threadTitle(state, open)}</b></div> : 'Messages with GIST Cleaning'}>
      <div className="chat-log">
        {msgs.length ? msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.fromId === me.id ? 'user' : 'assistant'}`}>
            <div>{m.text}</div>
            <div className="tiny muted">{m.fromId === me.id ? 'You' : userName(state, m.fromId)} · {fmtDateTime(m.at)}</div>
          </div>
        )) : <Empty>No messages yet. Say hi!</Empty>}
        <div ref={end} />
      </div>
      <div className="row nowrap mt">
        <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message…" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="btn sage" onClick={send} disabled={!text.trim()} aria-label="Send"><Send size={16} /></button>
      </div>
      {isOwner && lastIn && (
        <div className="mt">
          <AiButton task="draft-reply" label="Draft a reply with AI" prompt={`Draft a short, warm reply from Dustin (GIST Cleaning owner) to this message from ${userName(state, lastIn.fromId)}: "${lastIn.text}"`} extra={msgs.slice(-6).map((m) => `${userName(state, m.fromId)}: ${m.text}`).join('\n')} onUse={setText} useLabel="Put in reply box" />
        </div>
      )}
    </Card>
  )

  if (!isOwner) return conv || <Empty>No conversation.</Empty>
  return (
    <div className="msg-layout">
      <Card className={open ? 'hide-mobile' : ''} title="Conversations">
        <div className="list">
          {threads.map(({ id, last }) => (
            <button key={id} className={`list-item linkbtn${open === id ? ' active' : ''}`} style={{ width: '100%', textAlign: 'left' }} onClick={() => setOpen(id)}>
              <Avatar name={threadTitle(state, id)} color={state.users.find((u) => u.id === id)?.color} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="title">{threadTitle(state, id)} <span className="tiny muted">{clientOf(state, id) ? 'client' : 'team'}</span></div>
                <div className="meta" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last ? `${last.fromId === me.id ? 'You: ' : ''}${last.text}` : 'No messages yet'}</div>
              </div>
              {last && <span className="tiny muted">{relTime(last.at)}</span>}
            </button>
          ))}
        </div>
      </Card>
      {conv || <Card className="hide-mobile"><Empty>Pick a conversation.</Empty></Card>}
    </div>
  )
}

export function Assistant() {
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>Ask anything about GIST: policies, SOPs, your schedule or pay, how to use this app. Answers use the company docs and your own data only.</p>
      <AiChat inline />
    </div>
  )
}
