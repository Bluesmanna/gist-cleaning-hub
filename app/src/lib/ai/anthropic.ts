// Direct Claude API call from the browser — fine for a demo with your own key; for
// production move this into a server function so the key is never on the device.
export async function askAnthropic(key: string, model: string, system: string, prompt: string): Promise<string> {
  if (!key) throw new Error('no API key set')
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: 1200, system, messages: [{ role: 'user', content: prompt }] }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`)
  return (j.content || []).map((c: { text?: string }) => c.text || '').join('').trim()
}
