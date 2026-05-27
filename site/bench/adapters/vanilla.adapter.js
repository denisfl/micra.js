// Vanilla JS adapter — the performance floor. Hand-written DOM updates,
// no reactivity, no framework. Provides the baseline against which all
// others are measured.

const SANDBOX_ID = 'bench-sandbox'
function getSandbox() {
  let el = document.getElementById(SANDBOX_ID)
  if (!el) {
    el = document.createElement('div')
    el.id = SANDBOX_ID
    el.style.cssText = 'position:absolute;left:-9999px;top:0;width:100px;height:100px;overflow:hidden'
    document.body.appendChild(el)
  }
  return el
}

function fresh() {
  const sandbox = getSandbox()
  sandbox.innerHTML = ''
  return sandbox
}

function flush(el) { return el.offsetHeight }

function makeItems(n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = { id: i, name: 'Row ' + i, value: i * 7 }
  return out
}

// Simulates a typical "vanilla counter" pattern: each call creates a
// component-like closure with state and bound DOM nodes.
function makeCounter(host, state) {
  const a = host.querySelector('[data-a]')
  const b = host.querySelector('[data-b]')
  const c = host.querySelector('[data-c]')
  a.textContent = state.a
  b.textContent = state.b
  c.textContent = state.c
  return {
    state,
    destroy() { /* no listeners, nothing to clean */ }
  }
}

export const adapter = {
  name: 'vanilla',
  version: 'baseline',
  scenarios: {

    'mount-100': {
      _instances: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 100; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-a></span><span data-b></span><span data-c></span>`
          sandbox.appendChild(el)
          this._instances.push(makeCounter(el, { a: 1, b: 2, c: 3 }))
        }
        flush(sandbox)
      },
      teardown() { this._instances.forEach(i => i.destroy()); this._instances = [] },
    },

    'mount-1000': {
      _instances: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-a></span><span data-b></span><span data-c></span>`
          sandbox.appendChild(el)
          this._instances.push(makeCounter(el, { a: 1, b: 2, c: 3 }))
        }
        flush(sandbox)
      },
      teardown() { this._instances.forEach(i => i.destroy()); this._instances = [] },
    },

    'list-1000-first': {
      _host: null,
      setup() { this._host = fresh().appendChild(document.createElement('div')) },
      run() {
        const items = makeItems(1000)
        // Build via document fragment for fairness — same trick frameworks use
        const frag = document.createDocumentFragment()
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          const row = document.createElement('div')
          row.dataset.key = it.id
          const n = document.createElement('span')
          n.textContent = it.name
          const v = document.createElement('span')
          v.textContent = it.value
          row.appendChild(n)
          row.appendChild(v)
          frag.appendChild(row)
        }
        this._host.innerHTML = ''
        this._host.appendChild(frag)
        flush(this._host)
      },
      teardown() { if (this._host) this._host.innerHTML = '' },
    },

    'list-1000-update': {
      _host: null,
      _rows: null,
      setup() {
        const sandbox = fresh()
        this._host = sandbox.appendChild(document.createElement('div'))
        const items = makeItems(1000)
        this._rows = new Array(items.length)
        const frag = document.createDocumentFragment()
        for (let i = 0; i < items.length; i++) {
          const row = document.createElement('div')
          const n = document.createElement('span')
          n.textContent = items[i].name
          row.appendChild(n)
          frag.appendChild(row)
          this._rows[i] = n
        }
        this._host.appendChild(frag)
        flush(this._host)
      },
      run() {
        for (let i = 0; i < this._rows.length; i += 200) {
          this._rows[i].textContent = 'Updated ' + i + '-' + Math.random()
        }
        flush(this._host)
      },
      teardown() { if (this._host) this._host.innerHTML = '' },
    },

    'list-1000-swap': {
      _host: null,
      setup() {
        const sandbox = fresh()
        this._host = sandbox.appendChild(document.createElement('div'))
        const items = makeItems(1000)
        const frag = document.createDocumentFragment()
        for (let i = 0; i < items.length; i++) {
          const row = document.createElement('div')
          row.textContent = items[i].name
          frag.appendChild(row)
        }
        this._host.appendChild(frag)
        flush(this._host)
      },
      run() {
        const first = this._host.firstChild
        const last = this._host.lastChild
        if (first === last) return
        // Manual swap via insertBefore — what every vanilla swap looks like
        const beforeLast = last.previousSibling
        this._host.insertBefore(last, first)
        this._host.insertBefore(first, beforeLast.nextSibling)
        flush(this._host)
      },
      teardown() { if (this._host) this._host.innerHTML = '' },
    },

    'state-writes': {
      _node: null,
      _state: null,
      setup() {
        const sandbox = fresh()
        this._node = sandbox.appendChild(document.createElement('span'))
        this._state = { count: 0 }
      },
      run() {
        // Naive vanilla: write to DOM on every change (the "wrong" way).
        // Fair comparison to reactive libs which also re-render on every write.
        for (let i = 0; i < 10000; i++) {
          this._state.count = i
          this._node.textContent = i
        }
        flush(this._node)
      },
      teardown() { this._node = null; this._state = null },
    },

    'unmount-1000': {
      _instances: [],
      setup() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-a></span>`
          sandbox.appendChild(el)
          this._instances.push(makeCounter(el, { a: 1, b: 1, c: 1 }))
        }
      },
      run() {
        // Vanilla "unmount" = remove DOM + null refs (no event listeners
        // to detach, so just innerHTML = '' is what mature vanilla does).
        const sandbox = getSandbox()
        for (const inst of this._instances) inst.destroy()
        sandbox.innerHTML = ''
        this._instances = []
      },
      teardown() {},
    },
  },
}
