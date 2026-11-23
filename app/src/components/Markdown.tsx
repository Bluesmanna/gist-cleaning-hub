// Markdown renderer (react-markdown + GFM tables). Its own module so the public site's first
// load doesn't carry the parser; only the docs reader and the assistant need it.
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Link } from 'react-router-dom'

export function Markdown({ md, onLink }: { md: string; onLink?: (href: string) => void }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const h = href || ''
            if (h.startsWith('/')) {
              return (
                <Link to={h} onClick={() => onLink?.(h)}>
                  {children}
                </Link>
              )
            }
            return (
              <a href={h} target="_blank" rel="noreferrer">
                {children}
              </a>
            )
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}
