#!/usr/bin/env node
// GIST AI bridge — proof of concept that lets the GIST Cleaning Hub app talk to YOUR
// Claude Code subscription. It runs `claude -p` in a locked-down mode:
//   --tools ""              no built-in tools (no files, no shell, no web)
//   --strict-mcp-config     no MCP servers
//   --setting-sources ""    none of your settings, hooks or plugins
//   --system-prompt-file    replaces Claude Code's prompt with the GIST skills only
//   cwd = empty temp folder  nothing on disk to discover
//   --no-session-persistence nothing saved
// So Claude only ever sees the GIST skills + the text the app sends (the asking user's
// role-scoped data and matching doc passages). See ../docs/AI.md (incl. the ToS note).
//
//   node bridge/server.mjs                 # http://127.0.0.1:8787 (this PC only)
//   node bridge/server.mjs --lan           # also reachable from your phone on Wi-Fi
//                                          # (prints a token to paste in the app)
// Env: GIST_BRIDGE_PORT, GIST_BRIDGE_MODEL (default opus), GIST_BRIDGE_TOKEN, CLAUDE_BIN
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { networkInterfaces, tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lan = process.argv.includes('--lan')
const PORT = Number(process.env.GIST_BRIDGE_PORT || 8787)
const MODEL = process.env.GIST_BRIDGE_MODEL || 'opus'
const CLAUDE = process.env.CLAUDE_BIN || 'claude'
const TOKEN = process.env.GIST_BRIDGE_TOKEN || (lan ? randomBytes(9).toString('base64url') : '')
const MAX_PROMPT = 60_000

const skills = join(here, '..', 'app', 'src', 'lib', 'ai', 'skills')
const system = ['gist-assistant.md', 'gist-business.md'].map((f) => readFileSync(join(skills, f), 'utf8')).join('\n\n')
const jail = mkdtempSync(join(tmpdir(), 'gist-bridge-'))
const systemFile = join(jail, '..', `gist-system-${process.pid}.md`)
writeFileSync(systemFile, system)

let busy = 0
function runClaude(prompt, viaShell = false) {
  return new Promise((resolve, reject) => {
    const args = ['-p', '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--system-prompt-file', systemFile,
      '--model', MODEL, '--no-session-persistence', '--output-format', 'json']
    const env = { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1', DISABLE_AUTOUPDATER: '1' }
    // claude.exe spawns directly; an npm-installed claude.cmd needs a shell (quote the args then)
    const child = viaShell
      ? spawn(CLAUDE, args.map((a) => `"${a}"`), { cwd: jail, env, shell: true, windowsHide: true })
      : spawn(CLAUDE, args, { cwd: jail, env, windowsHide: true })
    let out = ''
    let err = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error('claude timed out')) }, 150_000)
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', (e) => {
      clearTimeout(timer)
      if (e.code === 'ENOENT' && !viaShell && process.platform === 'win32') return runClaude(prompt, true).then(resolve, reject)
      reject(e.code === 'ENOENT' ? new Error('claude CLI not found — install Claude Code or set CLAUDE_BIN') : e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      try {
        const j = JSON.parse(out)
        if (j.is_error) return reject(new Error(j.result || 'claude error'))
        resolve({ text: j.result, ms: j.duration_ms, cost: j.total_cost_usd })
      } catch {
        reject(new Error((err || out || `claude exited ${code}`).toString().slice(0, 300)))
      }
    })
    child.stdin.end(prompt)
  })
}

function send(res, code, body, origin) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Private-Network': 'true',
    Vary: 'Origin',
  })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const origin = req.headers.origin
  if (req.method === 'OPTIONS') return send(res, 204, {}, origin)
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: 'bad or missing bridge token' }, origin)
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, detail: `Claude Code bridge ready (model ${MODEL})`, busy }, origin)
  if (req.method === 'POST' && req.url === '/v1/ask') {
    let body = ''
    req.on('data', (d) => { body += d; if (body.length > MAX_PROMPT * 2) req.destroy() })
    req.on('end', async () => {
      try {
        const { prompt } = JSON.parse(body || '{}')
        if (typeof prompt !== 'string' || !prompt.trim()) return send(res, 400, { error: 'prompt required' }, origin)
        if (busy >= 2) return send(res, 429, { error: 'bridge busy, try again in a moment' }, origin)
        busy++
        const t0 = Date.now()
        const r = await runClaude(prompt.slice(0, MAX_PROMPT)).finally(() => busy--)
        console.log(`[${new Date().toLocaleTimeString()}] answered in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        send(res, 200, r, origin)
      } catch (e) {
        console.error('error:', e.message)
        send(res, 502, { error: e.message }, origin)
      }
    })
    return
  }
  send(res, 404, { error: 'not found' }, origin)
})

server.listen(PORT, lan ? '0.0.0.0' : '127.0.0.1', () => {
  console.log(`GIST AI bridge on http://127.0.0.1:${PORT} (model ${MODEL})`)
  if (lan) {
    const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)
    console.log(`LAN: ${ips.map((ip) => `http://${ip}:${PORT}`).join('  ')}`)
    console.log(`Token (paste in app → Settings → AI): ${TOKEN}`)
  }
  console.log('In the app: Settings → AI → "Claude Code bridge". Ctrl+C to stop.')
})
