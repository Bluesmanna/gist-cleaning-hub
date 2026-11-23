// Client for bridge/server.mjs — a tiny local server that forwards the prompt to your own
// Claude Code (`claude -p`) with every tool, MCP server and setting disabled.
// audience picks the assistant: 'customer' (public knowledge only) or 'team' (adds the team rules).
export async function askBridge(url: string, token: string, prompt: string, audience: 'customer' | 'team' = 'customer'): Promise<string> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 120000)
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/v1/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ prompt, audience }),
      signal: ctl.signal,
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
    return String(j.text || '').trim() || '(empty reply)'
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('timed out')
    throw new Error((e as Error).message === 'Failed to fetch' ? 'bridge not running or blocked' : (e as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

export async function bridgeHealth(url: string, token: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/health', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const j = await r.json()
    return { ok: !!j.ok, detail: j.detail || (j.ok ? 'connected' : 'not ready') }
  } catch (e) {
    return { ok: false, detail: (e as Error).message === 'Failed to fetch' ? 'not reachable — is `npm run bridge` running?' : (e as Error).message }
  }
}
