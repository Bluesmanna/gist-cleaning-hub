# AI in the GIST Cleaning Hub

## What it does

- **Two assistants, both live.** The sparkle button (bottom right) or **Assistant** in the menu opens one of them, depending on who is asking:
  - **GIST Assistant** (visitors and clients): services, prices, booking and policies, and for a signed-in client their own visits and invoices. It never sees handbooks, SOPs, agreements, staff pay or other clients.
  - **GIST Team Assistant** (employees and the owner): adds the team rules (pay, PTO, roles, benefits, home SOP and privacy rules), the internal docs, and the person's own schedule, hours and pay.
  Answers cite the docs they used (tap a source to open that section). A green **Live** tag shows the answer comes from Claude.
- **Explain this paystub** (Pay → open a stub) — plain-English walkthrough of earnings, taxes and cards.
- **Draft a reply with AI** (owner, Messages) — a warm reply in GIST's voice, which you can drop into the reply box and edit.
- **Ask AI about this doc** (any doc page) — questions answered from that doc only.
- **Draft a quote reply** (owner, Bookings) — a reply to a website booking with an estimate from GIST's prices.

## Providers (Settings → AI assistant)

| Provider | Where it runs | Notes |
|---|---|---|
| **Live Claude** — default | Rob's always-on PC, `bridge/server.mjs --public`, reached at `https://robert.tail48e80c.ts.net` (set in `app/src/lib/ai/live.ts`) | The hosted demo: Rob's own Claude Code (Sonnet), locked to GIST only (below), with the customer/team split and demo limits. If it's off or over its limit, the app quietly answers with the offline assistant and says so under the answer. |
| **Offline (built-in)** | In the app, no network | Searches the docs and the user's data and answers common questions (fees, pay dates, PTO, schedule, policies). The fallback, so the demo never breaks. |
| **Your own bridge** | Any PC with Claude Code, via `bridge/server.mjs` | For running the same bridge yourself (URL + token in Settings). |
| **Claude API** | Anthropic API with a key | The production path. In the demo the key is typed into Settings and stays on the device; for real use move the call into a server function. |

All of them get the same input, built in `app/src/lib/ai/`:

- `skills/gist-assistant.md` and `skills/gist-business.md` — the "skills": how the assistant behaves and the public side of the business (services, prices, policies). `skills/gist-team.md` holds the internal side (pay rules, roles, benefits, home SOP and privacy rules) and is added to the prompt only when the person asking is signed in as staff; visitors and clients also only get public-site passages, never handbook, SOP or agreement excerpts.
- `context.ts` — the asking user's own role-scoped data only: an employee sees their shifts, hours, stubs and PTO; a client sees their visits and invoices; the owner sees the business summary. Nobody's data leaks into another user's prompt.
- `knowledge.ts` — retrieval over the doc library: the passages that match the question.

## The live demo assistant

`bridge/server.mjs --public` runs on Rob's automation PC as the hidden scheduled task **GIST AI bridge** (starts at logon, re-checked every 10 minutes, restarts itself if it stops). A Tailscale Funnel gives it a public HTTPS address (`https://robert.tail48e80c.ts.net` → `127.0.0.1:8787`). It uses Rob's own Claude Code login (his personal account) and the Sonnet model. In public mode it also:

- answers only requests from the GIST site and app (`gistcleaninghub.com`, the GitHub Pages address, the Android app's `https://localhost`, local previews); anything else gets 403
- picks the assistant from the request's `audience`: `customer` (the default) gets the public skills only, and any team block in the prompt is cut out before Claude sees it; `team` adds `skills/gist-team.md`
- limits use: 400 answers a day in total, and per visitor 15 per 10 minutes and 60 a day; at most 3 at once
- hides error details from the public and never logs question text (only the time, assistant and answer time)

The app decides staff vs customer from who is signed in. In this no-server demo that's a UI boundary like the docs (anyone can sign in as a demo employee); the real version checks a login token on the server.

**On a device that's in Rob's own Tailscale network** the `ts.net` name resolves to a private 100.x address, so Chrome asks once whether gistcleaninghub.com may "access other devices on your local network". Click **Allow** (or the answer falls back to offline). Everyone else, including Dustin and clients, reaches it through the public Funnel address and never sees that prompt. The Android app isn't affected. `tools/flows.py` pins the name to the public address so it tests what an outside visitor sees.

**Turning it off:** disable the scheduled task and stop the bridge, or run `tailscale funnel --https=443 off` on that PC. The site keeps working on the offline assistant.

## Running the bridge yourself

```bash
cd app && npm run bridge          # or: node bridge/server.mjs
# AI settings → provider "Your Claude Code (bridge)" → URL http://127.0.0.1:8787 → Test
node bridge/server.mjs --lan      # to use it from the Android app on the same Wi-Fi; prints a token to paste in
```

The bridge runs `claude -p` with everything that could reach beyond GIST switched off:

- `--tools ""` — no file, shell or web tools
- `--strict-mcp-config` — no MCP servers
- `--setting-sources ""` — none of Rob's settings, hooks, memory or plugins
- `--system-prompt-file` — Claude Code's normal prompt is replaced by the two GIST skills
- runs in an empty temp folder with `--no-session-persistence`
- listens on 127.0.0.1 only (a tunnel brings public traffic in `--public` mode); with `--lan` it listens on Wi-Fi and requires a random token; at most three requests at once; prompt size capped

So Claude only ever sees the GIST skills and the text the app sends. It is disconnected from Rob's other projects, files and accounts.

**Terms of service note.** A consumer Claude subscription is meant for the subscriber's own use. The live demo runs on Rob's personal subscription so Dustin can try the real thing; it's a short-term proof of concept with tight daily limits, not how a business should run it. For real use by the team and clients, switch the provider to the Claude API behind a server function (next section): same prompts, same two assistants, paid per use (a few cents a day at GIST's size).

## Path to production

1. **Move to the Claude API behind a server function** (e.g. a Supabase Edge Function `ai-chat`). The app sends the same `{task, messages, docSlug, extra}`; the function adds the skills, the user's role-scoped context (from the database, using their auth token rather than trusting the client), and the retrieved passages, then calls `claude-sonnet-5-5` (fast/cheap) or `claude-opus-5-5` (hard questions). The key never touches the device.
2. **Better retrieval** — embed doc chunks into Postgres (`pgvector`) instead of keyword search.
3. **Actions, carefully** — let the assistant *propose* things (a draft schedule, an invoice, a reply) that a person confirms with one tap, using tool use. Never let it approve pay or move money on its own.
4. **More skills** — e.g. "new hire coach" (walks Taylor through onboarding), "client intake" (turns a booking request into a client record + SOP draft), "schedule helper" (fills next week from availability and client frequency).
5. **Guardrails and logs** — keep a log of AI requests per user (without door codes or addresses in plain text), rate-limit, and keep the "AI can make mistakes" footer the demo already shows.
