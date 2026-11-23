# AI in the GIST Cleaning Hub

## What it does

- **GIST Assistant** — the sparkle button (bottom right) or **Assistant** in the menu. Ask about policies, SOPs, your schedule or pay, or how to use the app. Answers cite the docs they used (tap a source to open that section).
- **Explain this paystub** (Pay → open a stub) — plain-English walkthrough of earnings, taxes and cards.
- **Draft a reply with AI** (owner, Messages) — a warm reply in GIST's voice, which you can drop into the reply box and edit.
- **Ask AI about this doc** (any doc page) — questions answered from that doc only.
- **Draft a quote reply** (owner, Bookings) — a reply to a website booking with an estimate from GIST's prices.

## Providers (Settings → AI assistant)

| Provider | Where it runs | Notes |
|---|---|---|
| **Offline (built-in)** — default | In the app, no network | Searches the docs and the user's data and answers common questions (fees, pay dates, PTO, schedule, policies). Always available, so the public demo never breaks. |
| **Your Claude Code (bridge)** — proof of concept | Rob's PC, via `bridge/server.mjs` | Uses Rob's own Claude Code subscription, locked to GIST only (below). |
| **Claude API** | Anthropic API with a key | The production path. In the demo the key is typed into Settings and stays on the device; for real use move the call into a server function. |

All three get the same input, built in `app/src/lib/ai/`:

- `skills/gist-assistant.md` and `skills/gist-business.md` — the "skills": how the assistant behaves and everything about the business (services, prices, policies, pay rules, roles, privacy).
- `context.ts` — the asking user's own role-scoped data only: an employee sees their shifts, hours, stubs and PTO; a client sees their visits and invoices; the owner sees the business summary. Nobody's data leaks into another user's prompt.
- `knowledge.ts` — retrieval over the doc library: the passages that match the question.

## The Claude Code bridge (proof of concept)

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
- listens on 127.0.0.1 only unless `--lan` is given, and then requires a random token; at most two requests at once; prompt size capped

So Claude only ever sees the GIST skills and the text the app sends. It is disconnected from Rob's other projects, files and accounts.

**Terms of service note.** A consumer Claude subscription is meant for the subscriber's own use. Running it for yourself as a personal proof of concept is in that spirit; serving it to other people (Dustin's team or clients) is not, and would need the Claude API (or a Claude for Work plan). That's why the bridge is opt-in, local, and documented as a demo only. The public site never calls it unless someone runs their own bridge.

## Path to production

1. **Move to the Claude API behind a server function** (e.g. a Supabase Edge Function `ai-chat`). The app sends the same `{task, messages, docSlug, extra}`; the function adds the skills, the user's role-scoped context (from the database, using their auth token rather than trusting the client), and the retrieved passages, then calls `claude-sonnet-5-5` (fast/cheap) or `claude-opus-5-5` (hard questions). The key never touches the device.
2. **Better retrieval** — embed doc chunks into Postgres (`pgvector`) instead of keyword search.
3. **Actions, carefully** — let the assistant *propose* things (a draft schedule, an invoice, a reply) that a person confirms with one tap, using tool use. Never let it approve pay or move money on its own.
4. **More skills** — e.g. "new hire coach" (walks Taylor through onboarding), "client intake" (turns a booking request into a client record + SOP draft), "schedule helper" (fills next week from availability and client frequency).
5. **Guardrails and logs** — keep a log of AI requests per user (without door codes or addresses in plain text), rate-limit, and keep the "AI can make mistakes" footer the demo already shows.
