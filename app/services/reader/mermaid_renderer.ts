/**
 * Mermaid → SVG renderer for the read path.
 *
 * Spawns `mmdc` (the @mermaid-js/mermaid-cli binary) per render. Each call
 * boots a Chromium instance, so cold-render is ~500ms-1s; cache aggressively
 * by content hash.
 *
 * Per slice 003 Tech Spec § Dependencies + § App shell mitigation: cache
 * keyed by SHA-256 of the diagram source. The Tech Spec named
 * `(workspace_id, revision_id, block_index)` as the key — content-hash is
 * stricter (covers cross-revision-identical diagrams) and avoids threading
 * workspace/revision through the call.
 *
 * If `mmdc` is unavailable (CI without Chromium, dev env that skipped the
 * heavy install), the renderer falls back to a styled `<pre>` placeholder.
 * The reader degrades gracefully; the fallback shows the diagram source so
 * the doc remains useful.
 */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const cache = new Map<string, string>()
const MAX_CACHE_ENTRIES = 200

async function hashSource(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source)
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function spawnMmdc(source: string): Promise<string> {
  const tmp = await mkdtemp(join(tmpdir(), 'musagete-mermaid-'))
  const inFile = join(tmp, 'diagram.mmd')
  const outFile = join(tmp, 'diagram.svg')

  try {
    await writeFile(inFile, source, 'utf8')

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('npx', ['--no-install', 'mmdc', '-i', inFile, '-o', outFile, '-q'], {
        cwd: process.cwd(),
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('error', (err) => reject(err))
      proc.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`mmdc exited with code ${code}: ${stderr}`))
      })
    })

    return await readFile(outFile, 'utf8')
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
}

function fallback(source: string): string {
  const escaped = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre style="margin:0;font-family:var(--mono);font-size:12px;color:var(--ink-3);white-space:pre">${escaped}</pre>`
}

export async function renderMermaid(source: string): Promise<string> {
  const key = await hashSource(source)
  const cached = cache.get(key)
  if (cached) return cached

  let svg: string
  try {
    svg = await spawnMmdc(source)
  } catch (err) {
    console.warn('[mermaid] render failed, falling back to <pre>:', err instanceof Error ? err.message : err)
    svg = fallback(source)
  }

  if (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    if (firstKey !== undefined) cache.delete(firstKey)
  }
  cache.set(key, svg)
  return svg
}
