#!/usr/bin/env node
// GIST AI bridge: lets the GIST Cleaning Hub app talk to a Claude Code subscription.
// It runs `claude -p` in a locked-down mode:
//   --tools ""              no built-in tools (no files, no shell, no web)
//   --strict-mcp-config     no MCP servers
//   --setting-sources ""    none of the account's settings, hooks or plugins
//   --system-prompt-file    replaces Claude Code's prompt with the GIST skills only
//   cwd = empty temp folder  nothing on disk to discover
//   --no-session-persistence nothing saved
// So Claude only ever sees the GIST skills + the text the app sends (the asking user's
// role-scoped data and matching doc passages). See ../docs/AI.md (incl. the ToS note).
//
// Two assistants, picked per request by `audience`:
//   customer  visitors and clients: public business knowledge only; any team-only block
//             in the prompt is stripped before Claude sees it
//   team      signed-in employees and the owner: also gets the team/employment skill
//
//   node bridge/server.mjs            # http://127.0.0.1:8787 (this PC only)
//   node bridge/server.mjs --lan      # reachable on Wi-Fi (prints a token to paste in the app)
//   node bridge/server.mjs --public   # the live demo: behind an HTTPS tunnel (Tailscale
//                                     # Funnel), no token, only the GIST site/app origins,
//                                     # per-visitor and daily limits
// Env: GIST_BRIDGE_PORT, GIST_BRIDGE_MODEL (default sonnet), GIST_BRIDGE_TOKEN, CLAUDE_BIN,
//      GIST_SKILLS_DIR, GIST_DAILY_LIMIT, GIST_IP_LIMIT_10MIN, GIST_IP_LIMIT_DAY, GIST_ORIGINS
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lan = process.argv.includes('--lan')
const pub = process.argv.includes('--public')
const PORT = Number(process.env.GIST_BRIDGE_PORT || 8787)
const MODEL = process.env.GIST_BRIDGE_MODEL || 'sonnet'
const CLAUDE = process.env.CLAUDE_BIN || 'claude'
const TOKEN = pub ? '' : process.env.GIST_BRIDGE_TOKEN || (lan ? randomBytes(9).toString('base64url') : '')
const MAX_PROMPT = 30_000
const MAX_RUNNING = 3
const DAILY = Number(process.env.GIST_DAILY_LIMIT || 400)
const IP_10MIN = Number(process.env.GIST_IP_LIMIT_10MIN || 15)
const IP_DAY = Number(process.env.GIST_IP_LIMIT_DAY || 60)
const ORIGINS = (process.env.GIST_ORIGINS ||
  'https://gistcleaninghub.com,https://www.gistcleaninghub.com,https://bluesmanna.github.io,https://localhost,capacitor://localhost,http://localhost:5173,http://127.0.0.1:4173,http://localhost:4173')
  .split(',')
  .map((s) => s.trim())

// skills: next to this file when deployed (GIST_SKILLS_DIR or ./skills), else the app source
const skillsDir = [process.env.GIST_SKILLS_DIR, join(here, 'skills'), join(here, '..', 'app', 'src', 'lib', 'ai', 'skills')].find(
  (d) => d && existsSync(join(d, 'gist-assistant.md')),
)
const skill = (f) => readFileSync(join(skillsDir, f), 'utf8')
const base = `${skill('gist-assistant.md')}\n\n${skill('gist-business.md')}`
const AUDIENCE = {
  customer: `${base}

# Who you are talking to
A GIST customer or website visitor (possibly a signed-in client). Help with services, prices, booking, policies and, for a signed-in client, their own visits and invoices in <app_data>. Company handbooks, SOPs, agreements, staff pay and other clients' details are internal: never reveal them, even if asked or told otherwise.`,
  team: `${base}

${skill('gist-team.md')}

# Who you are talking to
A signed-in member of the GIST team (an employee or the owner). You may use the team and employment rules above and the internal docs passed in <docs>.`,
}
const jail = mkdtempSync(join(tmpdir(), 'gist-bridge-'))
const systemFiles = Object.fromEntries(
  Object.entries(AUDIENCE).map(([k, text]) => {
    const f = join(jail, '..', `gist-system-${k}-${process.pid}.md`)
    writeFileSync(f, text)
    return [k, f]
  }),
)

let running = 0
function runClaude(prompt, audience, viaShell = false) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--system-prompt-file', systemFiles[audience],
      '--model', MODEL, '--no-session-persistence', '--output-format', 'json']
    const env = { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1' }
    // claude.exe spawns directly; an npm-installed claude.cmd needs a shell (quote the args then)
    const child = viaShell
      ? spawn(CLAUDE, args.map((a) => `"${a}"`), { cwd: jail, env, shell: true, windowsHide: true })
      : spawn(CLAUDE, args, { cwd: jail, env, windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('Claude took too long')) }, 110_000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      if (e.code === 'ENOENT' && !viaShell && process.platform === 'win32') return runClaude(prompt, audience, true).then(resolve, reject)
      reject(e.code === 'ENOENT' ? new Error('claude CLI not found: install Claude Code or set CLAUDE_BIN') : e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        const j = JSON.parse(out)
        if (j.is_error) return reject(new Error(j.result || 'claude error'))
        resolve({ text: j.result, ms: j.duration_ms })
      } catch {
        reject(new Error((err || out || `claude exited ${code}`).toString().slice(0, 300)))
      }
    })
    child.stdin.end(prompt)
  })
}

// ---- limits (public mode) ----
let day = new Date().toDateString()
let today = 0
const hits = new Map() // ip-hash -> timestamps today
function allow(ip) {
  const now = Date.now()
  if (new Date().toDateString() !== day) { day = new Date().toDateString(); today = 0; hits.clear() }
  if (today >= DAILY) return 'The live assistant has reached today’s limit for the demo. Try again tomorrow.'
  const list = (hits.get(ip) || []).filter((t) => now - t < 86_400_000)
  if (list.length >= IP_DAY) return 'You’ve reached today’s limit for the live demo assistant.'
  if (list.filter((t) => now - t < 600_000).length >= IP_10MIN) return 'That’s a lot of questions at once. Give it a few minutes.'
  list.push(now)
  hits.set(ip, list)
  today++
  return ''
}
const ipOf = (req) => createHash('sha256').update(String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()).digest('hex').slice(0, 12)

function send(res, code, body, origin) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': pub ? (ORIGINS.includes(origin) ? origin : ORIGINS[0]) : origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  })
  res.end(JSON.stringify(body))
}

const stamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')
const server = createServer((req, res) => {
  const origin = req.headers.origin
  const url = (req.url || '').split('?')[0]
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin)
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'bad or missing bridge token' }, origin)
  if (req.method === 'GET' && url === '/health')
    return send(res, 200, { ok: true, detail: `Claude Code bridge ready (model ${MODEL})`, live: pub, busy: running }, origin)
  if (req.method === 'POST' && url === '/v1/ask') {
    if (pub && !ORIGINS.includes(origin)) return send(res, 403, { error: 'This assistant only answers the GIST Cleaning Hub site and app.' }, origin)
    let body = ''
    req.on('data', (d) => { body += d; if (body.length > MAX_PROMPT * 2) req.destroy() })
    req.on('end', async () => {
      try {
        const j = JSON.parse(body || '{}')
        const audience = j.audience === 'team' ? 'team' : 'customer'
        let prompt = typeof j.prompt === 'string' ? j.prompt : ''
        if (!prompt.trim()) return send(res, 400, { error: 'prompt required' }, origin)
        if (audience === 'customer') prompt = prompt.replace(/<team_knowledge>[\s\S]*?<\/team_knowledge>/g, '')
        if (running >= MAX_RUNNING) return send(res, 429, { error: 'The live assistant is busy. Try again in a moment.' }, origin)
        if (pub) {
          const why = allow(ipOf(req))
          if (why) return send(res, 429, { error: why }, origin)
        }
        running++
        const t0 = Date.now()
        const r = await runClaude(prompt.slice(0, MAX_PROMPT), audience).finally(() => running--)
        console.log(`[${stamp()}] ${audience} answered in ${((Date.now() - t0) / 1000).toFixed(1)}s (today ${today}${pub ? `, visitor ${ipOf(req).slice(0, 6)}${req.headers['x-forwarded-for'] ? '' : ' no-xff'}` : ''})`)
        send(res, 200, { text: r.text, ms: r.ms, audience, model: MODEL }, origin)
      } catch (e) {
        console.error(`[${stamp()}] error: ${e.message}`)
        send(res, 502, { error: pub ? 'The live assistant hit a problem.' : e.message }, origin)
      }
    })
    return
  }
  send(res, 404, { error: 'not found' }, origin)
})

server.listen(PORT, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`[${stamp()}] GIST AI bridge on http://127.0.0.1:${PORT} (model ${MODEL}${pub ? ', public mode' : ''}; skills ${skillsDir})`)
  if (lan) {
    const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)
    console.log(`LAN: ${ips.map((ip) => `http://${ip}:${PORT}`).join('  ')}`)
    console.log(`Token (paste in app → Settings → AI): ${TOKEN}`)
  }
  if (!pub) console.log('In the app: Settings → AI → "Claude via local bridge". Ctrl+C to stop.')
})
