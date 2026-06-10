#!/usr/bin/env node
/**
 * evaluate.mjs — verdicts for every generation under runs/, plus the
 * idiom lint, aggregated into results.json + results.md.
 *
 *   node bench-llm/evaluate.mjs            # evaluate runs/
 *   node bench-llm/evaluate.mjs --golden   # validate assertions vs golden/
 *   node bench-llm/evaluate.mjs --only claude/bare/01-counter-t1
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractHtml, normalizeMicraLoading, detectForeignFramework } from './lib/extract.mjs'
import { loadPage } from './lib/loadPage.mjs'
import { lint } from './lib/lint.mjs'
import { tasks } from './tasks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const GOLDEN = process.argv.includes('--golden')
const onlyArg = (() => {
  const i = process.argv.indexOf('--only')
  return i !== -1 ? process.argv[i + 1] : null
})()

// Generated pages can throw from async callbacks (timers, rejected promises
// in onCreate) AFTER our try/catch around the assert has passed — without
// these guards a single bad generation kills the whole evaluation run.
// Attribution is per-current-judge: errors land on the page being evaluated.
let asyncErrors = []
process.on('uncaughtException', e => { asyncErrors.push(String(e?.message ?? e)) })
process.on('unhandledRejection', e => { asyncErrors.push(String(e?.message ?? e)) })

/** Evaluate one generation (raw text) against its task. */
async function judge(raw, task) {
  asyncErrors = []
  const { html } = extractHtml(raw)
  if (!html) return { verdict: 'unparseable' }

  const foreign = detectForeignFramework(html)
  if (foreign) return { verdict: 'fail-framework', detail: foreign }

  const { html: normalized, cdnUrls } = normalizeMicraLoading(html)
  const flags = lint(normalized, { cdnUrls })

  let pageErrors = []
  const load = async opts => {
    const api = await loadPage(normalized, opts)
    pageErrors = api.errors
    return api
  }

  try {
    await task.assert(load)
    // small drain so stray timers from this page fire (and get attributed) now
    await new Promise(r => setTimeout(r, 80))
    const err = pageErrors[0] ?? asyncErrors[0]
    if (err) return { verdict: 'fail-runtime', detail: err, cdnUrls, flags }
    return { verdict: 'pass', cdnUrls, flags }
  } catch (e) {
    const err = pageErrors[0] ?? asyncErrors[0]
    if (err) return { verdict: 'fail-runtime', detail: err, cdnUrls, flags }
    return { verdict: 'fail-behavior', detail: e.message, cdnUrls, flags }
  }
}

// ── Golden mode: validate the assertions themselves ───────────────────────────
if (GOLDEN) {
  let ok = 0
  for (const task of tasks) {
    const file = join(HERE, 'golden', `${String(task.id).padStart(2, '0')}-${task.slug}.html`)
    if (!existsSync(file)) { console.log(`∅ ${task.slug}: golden file missing`); continue }
    const raw = '```html\n' + readFileSync(file, 'utf8') + '\n```'
    const r = await judge(raw, task)
    const good = r.verdict === 'pass'
    if (good) ok++
    console.log(`${good ? '✓' : '✗'} ${String(task.id).padStart(2, '0')}-${task.slug}: ${r.verdict}${r.detail ? ' — ' + r.detail : ''}${r.flags?.length ? '  [lint: ' + r.flags.join(', ') + ']' : ''}`)
  }
  console.log(`\ngolden: ${ok}/${tasks.length} pass`)
  process.exit(ok === tasks.length ? 0 : 1)
}

// ── Runs mode ─────────────────────────────────────────────────────────────────
const runsDir = process.env.BENCH_RUNS_DIR ?? join(HERE, 'runs')
if (!existsSync(runsDir)) {
  console.error(`no runs directory at ${runsDir} — generate first with run.mjs (or set BENCH_RUNS_DIR)`)
  process.exit(1)
}

const results = []
for (const model of readdirSync(runsDir)) {
  for (const cond of readdirSync(join(runsDir, model))) {
    for (const f of readdirSync(join(runsDir, model, cond)).filter(f => f.endsWith('.md'))) {
      const key = `${model}/${cond}/${f.replace(/\.md$/, '')}`
      if (onlyArg && key !== onlyArg) continue
      const taskId = Number(f.slice(0, 2))
      const task = tasks.find(t => t.id === taskId)
      if (!task) continue
      const raw = readFileSync(join(runsDir, model, cond, f), 'utf8')
      const r = await judge(raw, task)
      results.push({ model, condition: cond, task: taskId, slug: task.slug, file: key, ...r })
      console.log(`${r.verdict === 'pass' ? '✓' : '✗'} ${key}: ${r.verdict}${r.detail ? ' — ' + String(r.detail).slice(0, 100) : ''}`)
    }
  }
}

// ── Aggregate ─────────────────────────────────────────────────────────────────
const by = (arr, key) => Object.groupBy(arr, key)
const pct = (xs) => xs.length ? Math.round(100 * xs.filter(r => r.verdict === 'pass').length / xs.length) : 0
const idiomatic = (xs) => xs.length ? Math.round(100 * xs.filter(r => r.verdict === 'pass' && !(r.flags ?? []).length).length / xs.length) : 0

let md = `# LLM correctness results\n\n_${results.length} generations evaluated ${new Date().toISOString().slice(0, 10)}_\n\n`
md += `## Pass rate (model × condition)\n\n| model | bare | llms | prompt |\n|---|---|---|---|\n`
for (const [model, rs] of Object.entries(by(results, r => r.model))) {
  const c = by(rs, r => r.condition)
  md += `| ${model} | ${pct(c.bare ?? [])}% | ${pct(c.llms ?? [])}% | ${pct(c.prompt ?? [])}% |\n`
}
md += `\n## Idiomatic rate (pass AND zero lint flags)\n\n| model | bare | llms | prompt |\n|---|---|---|---|\n`
for (const [model, rs] of Object.entries(by(results, r => r.model))) {
  const c = by(rs, r => r.condition)
  md += `| ${model} | ${idiomatic(c.bare ?? [])}% | ${idiomatic(c.llms ?? [])}% | ${idiomatic(c.prompt ?? [])}% |\n`
}
md += `\n## Failure taxonomy\n\n| verdict | count |\n|---|---|\n`
for (const [v, rs] of Object.entries(by(results, r => r.verdict))) md += `| ${v} | ${rs.length} |\n`
md += `\n## CDN choice (when the model loaded Micra from a URL)\n\n| host | count |\n|---|---|\n`
const hosts = results.flatMap(r => r.cdnUrls ?? []).map(u => { try { return new URL(u, 'http://x').host || 'relative' } catch { return 'malformed' } })
for (const [h, n] of Object.entries(by(hosts, h => h))) md += `| ${h} | ${n.length} |\n`

writeFileSync(join(HERE, 'results.json'), JSON.stringify(results, null, 2))
writeFileSync(join(HERE, 'results.md'), md)
console.log(`\n${results.length} evaluated → results.json, results.md`)
