#!/usr/bin/env node
/**
 * run.mjs — generation runner.
 *
 * For every model × condition × task × trial, asks the model for a single
 * HTML file and saves the raw reply under runs/. Resumable: existing files
 * are skipped, so an aborted run continues where it stopped.
 *
 *   node bench-llm/run.mjs
 *   node bench-llm/run.mjs --models claude,gpt --tasks 1,2 --conditions bare --trials 2
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { providers } from './lib/providers.mjs'
import { tasks } from './tasks.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

// ── CLI ───────────────────────────────────────────────────────────────────────
const arg = name => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 ? process.argv[i + 1] : null
}
const wantModels = (arg('models') ?? 'claude,gpt,gemini').split(',')
const wantTasks = (arg('tasks') ?? tasks.map(t => t.id).join(',')).split(',').map(Number)
const wantConds = (arg('conditions') ?? 'bare,llms,prompt').split(',')
const trials = Number(arg('trials') ?? process.env.BENCH_TRIALS ?? 5)

// ── Conditions: what context each one attaches ────────────────────────────────
const LLMS = readFileSync(join(ROOT, 'llms.txt'), 'utf8')
const PROMPT = readFileSync(join(ROOT, 'PROMPT.md'), 'utf8')

const WRAP =
  'Output ONE complete standalone HTML file in a single ```html code block. ' +
  'No explanations outside the code block.'

const conditions = {
  bare: t => ({
    system: null,
    user: `Build the following using Micra.js (a JavaScript framework). ${WRAP}\n\nTask: ${t.prompt}`,
  }),
  llms: t => ({
    system: `Documentation for Micra.js, the framework you must use:\n\n${LLMS}`,
    user: `Build the following using Micra.js. ${WRAP}\n\nTask: ${t.prompt}`,
  }),
  prompt: t => ({
    system: PROMPT,
    user: `Build the following using Micra.js. ${WRAP}\n\nTask: ${t.prompt}`,
  }),
}

// ── Run ───────────────────────────────────────────────────────────────────────
let done = 0, skipped = 0, failed = 0

for (const modelKey of wantModels) {
  const p = providers[modelKey]
  if (!p) { console.error(`unknown model "${modelKey}"`); continue }
  if (!p.enabled()) { console.log(`— ${modelKey}: no API key, skipping`); continue }
  if (p.preflight) {
    const problem = await p.preflight()
    if (problem) { console.log(`— ${modelKey}: ${problem}, skipping`); continue }
  }
  // one directory per concrete model id, so e.g. two ollama models don't mix
  const modelDir = `${modelKey}--${p.model.replace(/[^a-zA-Z0-9.-]/g, '_')}`

  for (const cond of wantConds) {
    for (const task of tasks.filter(t => wantTasks.includes(t.id))) {
      for (let trial = 1; trial <= trials; trial++) {
        const dir = join(process.env.BENCH_RUNS_DIR ?? join(HERE, 'runs'), modelDir, cond)
        const base = `${String(task.id).padStart(2, '0')}-${task.slug}-t${trial}`
        const outRaw = join(dir, `${base}.md`)
        const outMeta = join(dir, `${base}.json`)
        if (existsSync(outRaw)) { skipped++; continue }

        mkdirSync(dir, { recursive: true })
        const { system, user } = conditions[cond](task)
        const startedAt = new Date().toISOString()
        try {
          const t0 = Date.now()
          const text = await p.generate({ system, user, model: p.model })
          writeFileSync(outRaw, text)
          writeFileSync(outMeta, JSON.stringify({
            model: p.model, provider: modelKey, condition: cond,
            task: task.id, slug: task.slug, trial, startedAt,
            ms: Date.now() - t0,
          }, null, 2))
          done++
          console.log(`✓ ${modelDir}/${cond}/${base} (${Date.now() - t0} ms)`)
        } catch (e) {
          failed++
          console.error(`✗ ${modelDir}/${cond}/${base}: ${e.message}`)
        }
      }
    }
  }
}

console.log(`\ngenerated: ${done}, skipped (already on disk): ${skipped}, failed: ${failed}`)
if (failed) process.exit(1)
