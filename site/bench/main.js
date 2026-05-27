// Bench page entry — wires UI to the iframe-based runner.
//
// Adapters are NOT imported here. They live inside each frame
// (frames/<lib>.html → loads its own library + adapter, listens for
// postMessage commands). This page only orchestrates and renders UI.

import { SCENARIOS } from './scenarios.js'
import { Runner, browserInfo } from './runner.js'

// Display metadata — populated as frames report ready.
const LIB_META = {
  Micra:        { version: '2.2.0' },
  'Alpine.js':  { version: '3.14.1' },
  'petite-vue': { version: '0.4.1' },
  Stimulus:     { version: '3.2.2', notes: 'Not reactive — list/state scenarios N/A.' },
  vanilla:      { version: 'baseline' },
}
const LIB_ORDER = ['Micra', 'Alpine.js', 'petite-vue', 'Stimulus', 'vanilla']

// "Reactive" libraries are the apples-to-apples set for Micra. Coloring (best/
// good/mid/slow) is applied here. "Reference" libraries (vanilla = perf floor,
// Stimulus = controller pattern, not reactive) are shown for context only and
// rendered with a neutral background — they shouldn't appear to "lose" or
// "win" against a reactive runtime.
const REACTIVE_LIBS = new Set(['Micra', 'Alpine.js', 'petite-vue'])
const REFERENCE_LIBS = new Set(['Stimulus', 'vanilla'])

// ── Render environment info ───────────────────────────────────────────
const env = browserInfo()
document.getElementById('env').innerHTML = `
  <span class="env-pill">${env.browser}</span>
  <span class="env-pill">${env.os}</span>
  <span class="env-pill">${env.cores} cores</span>
  ${env.mem !== '?' ? `<span class="env-pill">${env.mem} RAM</span>` : ''}
`

// ── Build results grid ────────────────────────────────────────────────
const grid = document.getElementById('results-grid')

function renderGrid(results = {}) {
  let html = `
    <table class="bench-table">
      <thead>
        <tr>
          <th>Scenario</th>
          ${LIB_ORDER.map(name => {
            const tag = REFERENCE_LIBS.has(name) ? 'reference' : 'reactive'
            return `<th class="lib-col lib-${tag}" data-lib="${name}">
              ${name}<br><small>${LIB_META[name]?.version || ''}</small>
              <span class="lib-tag">${tag}</span>
            </th>`
          }).join('')}
        </tr>
      </thead>
      <tbody>
  `

  for (const sc of SCENARIOS) {
    html += `<tr data-scenario="${sc.id}">
      <th class="scenario-label">
        <strong>${sc.label}</strong>
        <span class="scenario-desc">${sc.description}</span>
      </th>`
    for (const name of LIB_ORDER) {
      const r = results[sc.id]?.[name]
      html += `<td class="cell" data-lib="${name}" data-scenario="${sc.id}">${formatCell(r)}</td>`
    }
    html += `</tr>`
  }

  html += `</tbody></table>`
  grid.innerHTML = html
}

function formatCell(r) {
  if (!r) return `<span class="cell-pending">—</span>`
  if (r.na) return `<span class="cell-na" title="${r.reason || 'not supported'}">N/A</span>`
  if (r.error) return `<span class="cell-err" title="${r.error}">ERR</span>`
  if (r.median != null) {
    const ms = r.median.toFixed(2)
    return `<span class="cell-value"><strong>${ms}</strong> ms</span>
            <span class="cell-range">${r.min.toFixed(1)}–${r.max.toFixed(1)}</span>`
  }
  return `<span class="cell-pending">running…</span>`
}

// Absolute UX-driven thresholds. Communicates "how fast does this feel" — NOT
// "who's the relative winner". A 1-ms vs 2-ms gap is meaningless to users, so
// both render green. A 1-ms vs 900-ms gap is a real difference, so red.
//
// Reference libraries (vanilla, Stimulus) get neutral coloring — they're not
// reactive frameworks and shouldn't compete on the same axis.
function paintCells() {
  document.querySelectorAll('.bench-table .cell').forEach(c => {
    c.classList.remove('cell-best', 'cell-good', 'cell-mid', 'cell-slow', 'cell-reference')

    const lib = c.dataset.lib
    if (REFERENCE_LIBS.has(lib)) {
      c.classList.add('cell-reference')
      return
    }

    const v = c.querySelector('.cell-value strong')
    if (!v) return
    const val = parseFloat(v.textContent)
    if (isNaN(val)) return

    // UX-tier thresholds (ms):
    //   < 5    instant    — user perceives as "immediate"
    //   < 50   fast       — well within "no perceived delay" budget
    //   < 500  noticeable — feels slow but not broken
    //   ≥ 500  slow       — clear UI hang
    if (val < 5) c.classList.add('cell-best')
    else if (val < 50) c.classList.add('cell-good')
    else if (val < 500) c.classList.add('cell-mid')
    else c.classList.add('cell-slow')
  })
}

renderGrid({})

// ── Runner wiring ─────────────────────────────────────────────────────
const progress = document.getElementById('progress')
const runBtn = document.getElementById('run-all')
runBtn.disabled = true

const runner = new Runner({
  onProgress: ({ lib, scenario }) => {
    progress.textContent = `${lib} · ${scenario}…`
    const cell = document.querySelector(`.cell[data-lib="${lib}"][data-scenario="${scenario}"]`)
    if (cell) cell.innerHTML = `<span class="cell-pending">running…</span>`
  },
  onResult: (libName, scenarioId, result) => {
    const cell = document.querySelector(`.cell[data-lib="${libName}"][data-scenario="${scenarioId}"]`)
    if (cell) cell.innerHTML = formatCell(result)
    paintCells()
  },
  onReady: ({ name, version }) => {
    // Update header version if frame reports different one
    if (version) LIB_META[name] = { ...LIB_META[name], version }
  },
})

progress.textContent = 'booting frames…'
runner.boot().then(() => {
  progress.textContent = 'ready'
  runBtn.disabled = false
  // Re-render header in case any versions differed
  renderGrid({})
}).catch(err => {
  progress.textContent = 'boot error: ' + err.message
  console.error('boot error', err)
})

runBtn.addEventListener('click', async () => {
  runBtn.disabled = true
  progress.textContent = 'starting…'
  try {
    await runner.runAll()
    progress.textContent = 'done · ' + new Date().toLocaleTimeString()
  } catch (err) {
    progress.textContent = 'error: ' + err.message
    console.error(err)
  } finally {
    runBtn.disabled = false
  }
})

document.getElementById('reset').addEventListener('click', () => {
  renderGrid({})
  progress.textContent = 'ready'
})
