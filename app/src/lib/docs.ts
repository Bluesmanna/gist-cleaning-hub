// Company document library: every Google Drive doc GIST uses (SOPs, handbooks,
// agreements, client SOPs, project task lists), readable in-app and downloadable as
// .md / .txt / .docx / .pdf.
//
// Public build: client docs are PSEUDONYMIZED (names, phones, addresses, door codes and
// photos replaced) by tools/build_docs.py. The real copies live in a private repo as
// gist-private-pack.json; importing it on a device (Docs > Import private pack) stores
// it in IndexedDB on that device only and the app then shows the real versions.
import { del, get, set } from 'idb-keyval'
import raw from '../data/docs.generated.json'

export interface DocMeta {
  slug: string
  title: string
  category: string
  summary: string
  pseudonymized: boolean
  source: string
  md: string
}

export const DOCS: DocMeta[] = raw as DocMeta[]
export const DOC_CATEGORIES = ['SOPs', 'Handbooks', 'Agreements', 'Client SOPs', 'Project Task Lists']

export function docBySlug(slug: string): DocMeta | undefined {
  return DOCS.find((d) => d.slug === slug)
}

// ---------- private pack ----------
export interface PackDoc {
  slug?: string
  path: string
  md: string
  docx: string | null
  pdf: string | null
}
interface Pack {
  format: 'gist-private-pack'
  version: number
  docs: PackDoc[]
}

const PACK_KEY = 'gist-private-pack'
let packCache: Map<string, PackDoc> | null = null
const listeners = new Set<() => void>()

export async function loadPack(): Promise<Map<string, PackDoc>> {
  if (packCache) return packCache
  try {
    const p = (await get(PACK_KEY)) as Pack | undefined
    packCache = new Map((p?.docs || []).filter((d) => d.slug).map((d) => [d.slug as string, d]))
  } catch {
    packCache = new Map()
  }
  return packCache
}

export async function importPack(file: File): Promise<number> {
  const text = await file.text()
  const p = JSON.parse(text) as Pack
  if (p.format !== 'gist-private-pack' || !Array.isArray(p.docs)) throw new Error('Not a GIST private pack file.')
  await set(PACK_KEY, p)
  packCache = null
  await loadPack()
  listeners.forEach((f) => f())
  return p.docs.filter((d) => d.slug).length
}

export async function removePack() {
  await del(PACK_KEY)
  packCache = new Map()
  listeners.forEach((f) => f())
}

export function onPackChange(f: () => void) {
  listeners.add(f)
  return () => listeners.delete(f)
}

// ---------- parsing ----------
export interface ChecklistItem {
  id: string
  text: string
  depth: number
}
export interface ChecklistSection {
  title: string
  items: ChecklistItem[]
}

const stripMd = (s: string) =>
  s
    .replace(/~~(.*?)~~/g, '')
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

/** Pull the "- [ ] task" checklist out of a client SOP / project list, grouped by #### heading. */
export function parseChecklist(md: string): ChecklistSection[] {
  const out: ChecklistSection[] = []
  let cur: ChecklistSection | null = null
  let floor = ''
  let n = 0
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^(#{2,4})\s+(.*)$/)
    if (h) {
      const title = stripMd(h[2])
      if (/^[A-Z0-9 /&+,'-]+$/.test(title) && h[1].length <= 4 && title.length > 2 && !/TASKS/.test(title)) {
        floor = title.length < 40 ? title : ''
      }
      if (h[1] === '####' || (h[1] === '###' && /\b(MAIN|FLOOR|UPSTAIRS|BASEMENT|GENERAL|ALL ROOMS)\b/i.test(title))) {
        const label = floor && floor !== title ? `${title} · ${titleCase(floor)}` : title
        cur = { title: label, items: [] }
        out.push(cur)
      }
      continue
    }
    const c = line.match(/^(\s*)[-*]\s+\[[ xX]\]\s+(.*)$/)
    if (c) {
      if (!cur) {
        cur = { title: 'Tasks', items: [] }
        out.push(cur)
      }
      const text = stripMd(c[2])
      if (!text) continue
      cur.items.push({ id: `i${n++}`, text, depth: Math.min(2, Math.floor(c[1].replace(/\t/g, '  ').length / 2)) })
    }
  }
  return out.filter((s) => s.items.length)
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())
}

export function field(md: string, name: string): string {
  const m = md.match(new RegExp(`\\*\\*${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}:\\*\\*\\s*(.*)`))
  return m ? stripMd(m[1]) : ''
}

/** "~2.5 hours", "3-4 hours", "*Maximum* of 3 hours" -> 2.5 / 3.5 / 3 */
export function parseHours(s: string): number {
  const range = s.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)/)
  if (range) return (Number(range[1]) + Number(range[2])) / 2
  const one = s.match(/(\d+(?:\.\d+)?)/)
  return one ? Number(one[1]) : 2.5
}

/** Section text (### heading .. next ###) as plain text, used by the AI knowledge base. */
export function sections(md: string): { heading: string; text: string }[] {
  const parts: { heading: string; text: string }[] = []
  let heading = 'Overview'
  let buf: string[] = []
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(/^#{1,4}\s+(.*)$/)
    if (h) {
      if (buf.join('').trim()) parts.push({ heading, text: buf.join('\n').trim() })
      heading = stripMd(h[1])
      buf = []
    } else buf.push(line)
  }
  if (buf.join('').trim()) parts.push({ heading, text: buf.join('\n').trim() })
  return parts
}

export function docFileUrl(slug: string, ext: 'md' | 'txt' | 'docx' | 'pdf') {
  return `./docs/${slug}.${ext}`
}
