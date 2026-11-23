// The hosted demo assistant: bridge/server.mjs running `--public` on Rob's always-on PC,
// reached over HTTPS through a Tailscale Funnel. It runs his Claude Code (locked down: no
// tools, files, MCP or settings) and only answers the GIST site and app. See docs/AI.md.
export const LIVE_AI_URL = 'https://robert.tail48e80c.ts.net'
export type Audience = 'customer' | 'team'
