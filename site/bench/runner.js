// Iframe-based benchmark orchestrator.
//
// Each library lives in its own iframe (frames/<lib>.html) — isolated
// document, isolated MutationObservers, isolated reactive queues.
// The runner sends postMessage commands and listens for results.

import { SCENARIOS } from './scenarios.js'

const FRAMES = [
  { name: 'Micra', url: 'frames/micra.html' },
  { name: 'Alpine.js', url: 'frames/alpine.html' },
  { name: 'petite-vue', url: 'frames/petite-vue.html' },
  { name: 'Stimulus', url: 'frames/stimulus.html' },
  { name: 'vanilla', url: 'frames/vanilla.html' },
]

let _reqId = 0

export class Runner {
  constructor({ onProgress, onResult, onReady } = {}) {
    this.onProgress = onProgress || (() => {})
    this.onResult = onResult || (() => {})
    this.onReady = onReady || (() => {})
    this.frames = new Map() // name → { iframe, ready: Promise, meta }
    this.results = {}
    this._installMessageHandler()
  }

  _installMessageHandler() {
    this._pending = new Map() // requestId → { resolve, reject, lib }
    window.addEventListener('message', (event) => {
      const msg = event.data
      if (!msg || typeof msg !== 'object') return

      if (msg.type === 'ready') {
        const entry = this.frames.get(msg.name)
        if (entry) {
          entry.meta = { version: msg.version, notes: msg.notes }
          entry._resolveReady?.()
          this.onReady({ name: msg.name, version: msg.version, notes: msg.notes })
        }
        return
      }

      if (msg.type === 'result') {
        const p = this._pending.get(msg.requestId)
        if (p) {
          this._pending.delete(msg.requestId)
          p.resolve(msg)
        }
      }
    })
  }

  /** Create all frames in parallel, wait until each one reports ready. */
  async boot() {
    for (const { name, url } of FRAMES) {
      const iframe = document.createElement('iframe')
      iframe.src = url
      iframe.title = `bench-frame-${name}`
      iframe.style.cssText =
        'position:absolute;left:-9999px;top:0;width:800px;height:600px;border:0;'
      document.body.appendChild(iframe)

      const entry = { iframe, name }
      entry.ready = new Promise(r => { entry._resolveReady = r })
      this.frames.set(name, entry)
    }
    // Resolve when ALL frames have signaled ready
    await Promise.all([...this.frames.values()].map(f => f.ready))
  }

  /** Run one scenario on one library. Returns { samples } or { na } or { error }. */
  _send(name, scenarioId, iters) {
    const entry = this.frames.get(name)
    if (!entry) return Promise.resolve({ error: 'unknown lib: ' + name })

    return new Promise((resolve) => {
      const requestId = ++_reqId
      this._pending.set(requestId, { resolve, lib: name })
      entry.iframe.contentWindow.postMessage(
        { type: 'run', scenarioId, iters, requestId },
        '*'
      )
      // 60s safety timeout per scenario
      setTimeout(() => {
        if (this._pending.has(requestId)) {
          this._pending.delete(requestId)
          resolve({ error: 'timeout after 60s' })
        }
      }, 60000)
    })
  }

  /** Run all scenarios × all libs. */
  async runAll(libNames = null, scenarioIds = null) {
    const libs = libNames
      ? [...this.frames.values()].filter(e => libNames.includes(e.name))
      : [...this.frames.values()]
    const scenarios = scenarioIds
      ? SCENARIOS.filter(s => scenarioIds.includes(s.id))
      : SCENARIOS

    for (const scenario of scenarios) {
      this.results[scenario.id] = this.results[scenario.id] || {}
      for (const lib of libs) {
        this.onProgress({ lib: lib.name, scenario: scenario.id, status: 'running' })
        const reply = await this._send(lib.name, scenario.id, scenario.iters)
        const result = this._summarize(reply)
        this.results[scenario.id][lib.name] = result
        this.onResult(lib.name, scenario.id, result)
      }
    }

    return this.results
  }

  _summarize(reply) {
    if (reply.na) return { na: true, reason: reply.reason }
    if (reply.error) return { error: reply.error }
    if (!reply.samples) return { error: 'no samples' }

    const sorted = reply.samples.slice().sort((a, b) => a - b)
    return {
      median: sorted[Math.floor(sorted.length / 2)],
      min: sorted[0],
      max: sorted[sorted.length - 1],
      samples: reply.samples,
      iters: reply.samples.length,
    }
  }

  libs() {
    return [...this.frames.values()].map(f => ({ name: f.name, ...f.meta }))
  }
}

export function browserInfo() {
  const ua = navigator.userAgent
  let browser = 'unknown'
  if (/Chrome\/(\d+)/.test(ua) && !/Edg/.test(ua)) browser = 'Chrome ' + RegExp.$1
  else if (/Firefox\/(\d+)/.test(ua)) browser = 'Firefox ' + RegExp.$1
  else if (/Safari\/(\d+)/.test(ua) && /Version\/(\d+)/.test(ua)) browser = 'Safari ' + RegExp.$1
  else if (/Edg\/(\d+)/.test(ua)) browser = 'Edge ' + RegExp.$1

  const os = navigator.platform || 'unknown'
  const cores = navigator.hardwareConcurrency || '?'
  const mem = navigator.deviceMemory ? navigator.deviceMemory + 'GB' : '?'
  return { browser, os, cores, mem }
}
