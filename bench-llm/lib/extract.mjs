/**
 * lib/extract.mjs — pull an HTML document out of a raw model response and
 * normalize how it loads Micra.
 *
 * Normalization: we ALWAYS inject the local UMD bundle as the first script
 * in <head> and strip whatever micra <script src> / ESM import the model
 * wrote. This makes the verdict measure generated-code quality, not CDN
 * availability — but the URL the model picked is recorded (it is itself a
 * metric: unpkg is CSP-blocked in AI sandboxes).
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BUNDLE = readFileSync(join(ROOT, 'dist', 'micra.min.js'), 'utf8')

const FENCE = /```(?:html|HTML)?\s*\n([\s\S]*?)```/g

/** Extract the most plausible HTML document from a raw model reply. */
export function extractHtml(raw) {
  const blocks = []
  let m
  while ((m = FENCE.exec(raw)) !== null) blocks.push(m[1])

  // Prefer fenced blocks that look like documents; fall back to the largest
  // block mentioning a component; then to a raw-document response.
  const docs = blocks.filter(b => /<html|<!doctype/i.test(b))
  const candidates = docs.length ? docs : blocks.filter(b => /data-component|<script/i.test(b))
  let html = candidates.sort((a, b) => b.length - a.length)[0] ?? null

  if (!html && /^\s*(<!doctype|<html)/i.test(raw)) html = raw
  if (!html) return { html: null }
  return { html }
}

const MICRA_SCRIPT = /<script[^>]*\bsrc=["']([^"']*micra[^"']*)["'][^>]*>\s*<\/script>/gi
const MICRA_IMPORT = /import\s+(?:\*\s+as\s+\w+|\w+|\{[^}]*\})\s+from\s+["']([^"']*micra[^"']*)["'];?/gi

/**
 * Strip the model's micra loading mechanism, inject the local bundle,
 * report which CDN URLs the model chose.
 */
export function normalizeMicraLoading(html) {
  const cdnUrls = []
  let out = html.replace(MICRA_SCRIPT, (_, url) => {
    cdnUrls.push(url)
    return ''
  })
  out = out.replace(MICRA_IMPORT, (_, url) => {
    cdnUrls.push(url)
    return '/* micra import stripped — UMD global injected by harness */'
  })

  const inject = `<script>${BUNDLE}</script>`
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, h => `${h}\n${inject}`)
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html[^>]*>/i, h => `${h}\n<head>${inject}</head>`)
  } else {
    out = inject + '\n' + out
  }
  return { html: out, cdnUrls }
}

/** Detect "generated a different framework" before bothering to run. */
export function detectForeignFramework(html) {
  const usesMicra = /data-component|Micra\./.test(html)
  if (usesMicra) return null
  if (/react(-dom)?(\.|@|\/)|ReactDOM|babel.*jsx|createRoot\(/i.test(html)) return 'react'
  if (/vue(\.|@|\/)(?!.*petite)|createApp\(/i.test(html)) return 'vue'
  if (/alpine|x-data/i.test(html)) return 'alpine'
  return 'none-detected' // no micra and no known framework — still foreign
}
