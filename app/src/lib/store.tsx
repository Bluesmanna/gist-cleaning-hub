// One JSON state object for the whole demo, persisted on-device (IndexedDB, so photo and
// receipt uploads fit). Every action is a small mutation on a cloned draft, which keeps
// the code readable and maps directly onto API calls when a real backend is added
// (see docs/BACKEND.md).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import type { Role, State, User } from './types'
import { STATE_VERSION } from './version'
// The demo seed (and the docs it builds clients from) loads only when there's no saved data.
const freshSeed = () => import('./seed').then((m) => m.seed())
import { uid } from './dates'

const KEY = 'gist-hub-state'

interface Store {
  state: State
  me: User | null
  role: Role | 'public'
  update: (fn: (d: State) => void) => void
  setUser: (id: string | null) => void
  reset: () => void
  replace: (s: State) => void
  notify: (d: State, userId: string, text: string, link?: string) => void
  toast: (msg: string) => void
  toastMsg: string | null
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null)
  const [toastMsg, setToast] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let alive = true
    ;(async () => {
      let s: State | undefined
      try {
        s = (await get(KEY)) as State | undefined
      } catch {
        s = undefined
      }
      if (!s || s.version !== STATE_VERSION) s = await freshSeed()
      if (alive) setState(s)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (state) set(KEY, state).catch(() => {})
  }, [state])

  const update = useCallback((fn: (d: State) => void) => {
    setState((prev) => {
      if (!prev) return prev
      const d = structuredClone(prev)
      fn(d)
      return d
    })
  }, [])

  const toast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setToast(null), 3200)
  }, [])

  const value = useMemo<Store | null>(() => {
    if (!state) return null
    const me = state.users.find((u) => u.id === state.currentUserId) || null
    return {
      state,
      me,
      role: me ? me.role : 'public',
      update,
      setUser: (id) => update((d) => void (d.currentUserId = id)),
      reset: () => {
        const keep = state.currentUserId
        freshSeed().then((s) => setState({ ...s, currentUserId: keep }))
      },
      replace: (s) => setState(s),
      notify: (d, userId, text, link) => {
        d.notices.unshift({ id: uid('n'), userId, text, at: new Date().toISOString(), read: false, link })
      },
      toast,
      toastMsg,
    }
  }, [state, update, toast, toastMsg])

  if (!value)
    return (
      <div className="boot">
        <div className="spinner" /> Loading GIST Cleaning Hub…
      </div>
    )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

export const userName = (s: State, id?: string | null) => (id ? s.users.find((u) => u.id === id)?.name || 'Unknown' : 'Open shift')
export const clientOf = (s: State, id?: string) => s.clients.find((c) => c.id === id)
