// One entry point for all AI in the app. Providers are interchangeable:
//   offline   — built-in, no network; data lookups + doc retrieval (always available)
//   bridge    — your own Claude Code on your PC (bridge/server.mjs runs `claude -p` with
//               no tools, no MCP, no settings, an empty folder: it can only read the text
//               the app sends). Proof of concept.
//   anthropic — Claude API with a key (the production path; move the key server-side,
//               e.g. a Supabase Edge Function, before real use).
// Every request carries only the asking user's role-scoped data (context.ts) plus the
// doc passages that match the question (knowledge.ts).
import type { State, User } from '../types'
import { buildContext } from './context'
import { search } from './knowledge'
import { offlineAnswer } from './offline'
import businessSkill from './skills/gist-business.md?raw'
import assistantSkill from './skills/gist-assistant.md?raw'

export type AiTask = 'chat' | 'explain-stub' | 'draft-reply' | 'doc-qa' | 'quote'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AiRequest {
  task: AiTask
  messages: AiMessage[]
  docSlug?: string // limit doc retrieval to one doc (doc Q&A)
  extra?: string // task-specific context (paystub, message thread, booking…)
}

export interface AiResult {
  text: string
  sources: { title: string; heading: string; link: string }[]
  provider: 'offline' | 'bridge' | 'anthropic'
  note?: string
}

export const SYSTEM_PROMPT = `${assistantSkill}\n\n${businessSkill}`

const TASK_HINT: Record<AiTask, string> = {
  chat: 'Answer the question.',
  'explain-stub': 'Explain this paystub line by line in plain language (hours × rate, overtime, PTO, tips, each tax, reimbursements, card loads, net). Mention that tax figures are estimates.',
  'draft-reply': 'Draft a short, warm reply the owner can send. Output only the message text.',
  'doc-qa': 'Answer using the attached document. Quote the exact steps when relevant.',
  quote: 'Draft a friendly quote/reply to this booking request using the price list. Give a per-visit estimate range and propose a walk-through. Output only the message.',
}

export function buildPrompt(req: AiRequest, s: State, me: User | null) {
  const lastQ = req.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || ''
  const filter = req.docSlug ? (c: { link: string }) => c.link.endsWith('/' + req.docSlug) : undefined
  const hits = search(`${lastQ} ${req.extra || ''}`.slice(0, 600), req.docSlug ? 8 : 6, filter)
  const docs = hits.map((h) => `<doc title="${h.title}" section="${h.heading}">\n${h.text}\n</doc>`).join('\n')
  const history = req.messages
    .slice(-10, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n')
  const prompt = [
    `<app_data>\n${buildContext(s, me)}\n</app_data>`,
    docs ? `<docs>\n${docs}\n</docs>` : '',
    req.extra ? `<task_context>\n${req.extra}\n</task_context>` : '',
    history ? `<conversation>\n${history}\n</conversation>` : '',
    `Task: ${TASK_HINT[req.task]}`,
    `User: ${lastQ}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  return { prompt, sources: hits.map((h) => ({ title: h.title, heading: h.heading, link: h.link })) }
}

export async function ask(req: AiRequest, s: State, me: User | null): Promise<AiResult> {
  const provider = s.settings.aiProvider
  if (provider === 'offline') return offlineAnswer(req, s, me)
  const { prompt, sources } = buildPrompt(req, s, me)
  try {
    if (provider === 'bridge') {
      const { askBridge } = await import('./bridge')
      return { text: await askBridge(s.settings.bridgeUrl, s.settings.bridgeToken, prompt), sources, provider: 'bridge' }
    }
    const { askAnthropic } = await import('./anthropic')
    return { text: await askAnthropic(s.settings.anthropicKey, s.settings.anthropicModel, SYSTEM_PROMPT, prompt), sources, provider: 'anthropic' }
  } catch (e) {
    const off = offlineAnswer(req, s, me)
    return { ...off, note: `${provider === 'bridge' ? 'Claude bridge' : 'Claude API'} unavailable (${(e as Error).message}) — showing the offline answer.` }
  }
}
