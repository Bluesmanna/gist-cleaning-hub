// Android back button. Open overlays (dialogs, the assistant, menus) register a close
// handler while they are open; the hardware back key closes the newest one first, then
// goes back a page, and only exits the app from a home screen. No-op in the browser.
import { useEffect, useRef } from 'react'

const stack: { close: () => void }[] = []

/** While `active`, the Android back key calls `close` (newest overlay first). */
export function useBackClose(active: boolean, close: () => void) {
  const ref = useRef(close)
  useEffect(() => { ref.current = close })
  useEffect(() => {
    if (!active) return
    const entry = { close: () => ref.current() }
    stack.push(entry)
    return () => {
      const i = stack.indexOf(entry)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active])
}

/** Closes the newest open overlay. Returns false when nothing was open. */
export function closeTopOverlay(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.close()
  return true
}
