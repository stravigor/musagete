/**
 * Markdown rendering pipeline — slice 003 Tech Spec § Dependencies.
 *
 * Pipeline:
 *   markdown string
 *     → pre-pass: extract ```mermaid blocks, render to SVG via mmdc, cache
 *     → markdown-it sync render (with custom rules: .lede, code-blocks via Shiki, anchors, footnotes)
 *     → HTML string
 *
 * Render is async because Mermaid uses a CLI subprocess. Shiki's sync API is
 * fine; we keep it inside the markdown-it custom fence renderer.
 *
 * Caching:
 *   - Shiki: in-memory LRU keyed by `${lang}::${code}` (since the same code
 *     block in different docs renders identically).
 *   - Mermaid: in-memory LRU keyed by SHA-256 of the diagram source. The
 *     Tech Spec calls for `(workspace_id, revision_id, block_index)` — the
 *     content-hash key is stricter (covers cross-revision-identical diagrams)
 *     and avoids needing the caller to thread workspace/revision context
 *     through the render call.
 */

import MarkdownIt from 'markdown-it'
import markdownItAnchor from 'markdown-it-anchor'
// @ts-expect-error — ships without .d.ts; default export is a markdown-it plugin function.
import markdownItFootnote from 'markdown-it-footnote'
// @ts-expect-error — ships without .d.ts.
import markdownItAttrs from 'markdown-it-attrs'
// @ts-expect-error — ships without .d.ts.
import markdownItTaskLists from 'markdown-it-task-lists'
import { codeToHtml, type BundledLanguage, type BundledTheme } from 'shiki'
import { renderMermaid } from '#services/reader/mermaid_renderer'

// --- Shiki ---------------------------------------------------------------

const SHIKI_LIGHT: BundledTheme = 'github-light'
const SHIKI_DARK: BundledTheme = 'github-dark'

// Reasonable v1 language set; expand as docs need it. Unknown langs fall
// through to `text` (no highlighting).
const SHIKI_LANGS: BundledLanguage[] = [
  'typescript', 'javascript', 'tsx', 'jsx',
  'json', 'yaml', 'toml', 'xml',
  'shellscript', 'bash',
  'sql',
  'css', 'scss', 'html',
  'markdown', 'diff',
  'python', 'rust', 'go',
]

const SHIKI_LANG_SET = new Set<string>(SHIKI_LANGS)

const shikiCache = new Map<string, string>()

async function highlightCode(code: string, lang: string): Promise<string> {
  const safeLang = SHIKI_LANG_SET.has(lang as BundledLanguage) ? lang : 'text'
  const key = `${safeLang}::${code}`
  const cached = shikiCache.get(key)
  if (cached) return cached
  const html = await codeToHtml(code, {
    lang: safeLang as BundledLanguage,
    themes: { light: SHIKI_LIGHT, dark: SHIKI_DARK },
    defaultColor: 'light',
  })
  // Cap cache at ~500 entries (LRU-by-insertion-order — Map preserves it).
  if (shikiCache.size > 500) {
    const firstKey = shikiCache.keys().next().value
    if (firstKey !== undefined) shikiCache.delete(firstKey)
  }
  shikiCache.set(key, html)
  return html
}

// --- Markdown-it instance ------------------------------------------------

export const md = new MarkdownIt({
  html: false,        // user content does not get raw HTML passthrough
  linkify: true,
  typographer: true,
  breaks: false,
})
  .use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink({ safariReaderFix: true }),
  })
  .use(markdownItFootnote)
  .use(markdownItAttrs, {
    leftDelimiter: '{',
    rightDelimiter: '}',
    allowedAttributes: ['id', 'class'],
  })
  .use(markdownItTaskLists, { enabled: false })

// --- Custom rule: `.lede` class on first paragraph after h1 --------------

const defaultParagraphOpen =
  md.renderer.rules.paragraph_open ||
  ((tokens, idx, options, env, self) => self.renderToken(tokens, idx, options))

md.renderer.rules.paragraph_open = (tokens, idx, options, env, self) => {
  // The token order at the top of a doc looks like:
  //   heading_open(h1) → inline → heading_close(h1) → paragraph_open → ...
  // We tag the first paragraph_open whose immediately-prior heading is h1.
  if (env.__ledeApplied) {
    return defaultParagraphOpen(tokens, idx, options, env, self)
  }
  for (let i = idx - 1; i >= 0; i--) {
    const t = tokens[i]!
    if (t.type === 'heading_close' && t.tag === 'h1') {
      tokens[idx]!.attrJoin('class', 'lede')
      env.__ledeApplied = true
      break
    }
    if (t.type === 'heading_close') break // h2/h3 closes the lede window
  }
  return defaultParagraphOpen(tokens, idx, options, env, self)
}

// --- Wrap rendered output in `.read` so the editorial typography applies -

export async function renderMarkdown(source: string): Promise<string> {
  // Pre-pass: extract ```mermaid``` and ```<lang>``` fenced blocks. We use
  // a placeholder substitution because both renderings are async and
  // markdown-it's render path is sync.
  const fenceRe = /^```(\w+)\s*\n([\s\S]*?)\n```$/gm
  const placeholders = new Map<string, string>()
  let placeholderIdx = 0
  const stripped = source.replace(fenceRe, (_full, lang: string, code: string) => {
    const id = `__FENCE_${placeholderIdx++}__`
    placeholders.set(id, JSON.stringify({ lang, code }))
    // Keep it as a plain paragraph so markdown-it doesn't re-wrap it; we
    // splice the rendered HTML in afterwards by string-replace.
    return id
  })

  // Sync markdown render
  let html = md.render(stripped)

  // Resolve placeholders. Mermaid + Shiki happen here; keep cache hits hot.
  for (const [id, payload] of placeholders) {
    const { lang, code } = JSON.parse(payload) as { lang: string; code: string }
    let block: string
    if (lang === 'mermaid') {
      const svg = await renderMermaid(code)
      block = `<div class="diagram"><span class="diagram-tag">mermaid</span>${svg}</div>`
    } else {
      const shikiHtml = await highlightCode(code, lang)
      block = `<div class="codeblock"><div class="codeblock-hd"><span>${escapeHtml(lang)}</span></div>${shikiHtml}</div>`
    }
    // Markdown-it wrapped the placeholder paragraph: <p>__FENCE_0__</p>. Strip the wrap.
    html = html.replace(new RegExp(`<p>${id}</p>`, 'g'), block)
    // Defensive: if the placeholder wasn't wrapped, replace bare too.
    html = html.replace(id, block)
  }

  return `<div class="read">${html}</div>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
