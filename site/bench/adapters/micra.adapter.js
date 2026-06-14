// Micra adapter — implements each scenario on Micra.js
import * as Micra from '../../dist/micra.esm.js'

// Sandbox where all benchmark DOM lives. Cleared between scenarios.
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

// Force layout flush so we measure DOM work, not just queued work.
function flush(el) { return el.offsetHeight }

function makeItems(n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = { id: i, name: 'Row ' + i, value: i * 7 }
  return out
}

let _id = 0
function uniqId() { return 'micra-bench-' + (_id++) }

export const adapter = {
  name: 'Micra',
  version: '2.5.0',
  scenarios: {

    'mount-100': {
      _instances: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 100; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-text="a"></span><span data-text="b"></span><span data-text="c"></span>`
          sandbox.appendChild(el)
          this._instances.push(Micra.mount(el, { state: { a: 1, b: 2, c: 3 } }))
        }
        flush(sandbox)
      },
      teardown() {
        this._instances.forEach(i => i.destroy())
        this._instances = []
      },
    },

    'mount-1000': {
      _instances: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-text="a"></span><span data-text="b"></span><span data-text="c"></span>`
          sandbox.appendChild(el)
          this._instances.push(Micra.mount(el, { state: { a: 1, b: 2, c: 3 } }))
        }
        flush(sandbox)
      },
      teardown() {
        this._instances.forEach(i => i.destroy())
        this._instances = []
      },
    },

    'list-1000-first': {
      _inst: null,
      setup() {
        const sandbox = fresh()
        const el = document.createElement('div')
        el.innerHTML = `
          <template data-each="items" data-key="id">
            <div>
              <span data-text="item.name"></span>
              <span data-text="item.value"></span>
            </div>
          </template>`
        sandbox.appendChild(el)
        this._inst = Micra.mount(el, { state: { items: [] } })
      },
      run() {
        this._inst.state.items = makeItems(1000)
        this._inst.render()
        flush(this._inst.$el)
      },
      teardown() {
        if (this._inst) { this._inst.destroy(); this._inst = null }
      },
    },

    'list-1000-update': {
      _inst: null,
      _items: null,
      setup() {
        const sandbox = fresh()
        const el = document.createElement('div')
        el.innerHTML = `
          <template data-each="items" data-key="id">
            <div>
              <span data-text="item.name"></span>
              <span data-text="item.value"></span>
            </div>
          </template>`
        sandbox.appendChild(el)
        this._items = makeItems(1000)
        this._inst = Micra.mount(el, { state: { items: this._items } })
        this._inst.render()
        flush(this._inst.$el)
      },
      run() {
        // Mutate every 200th row's name (5 rows total)
        this._items = this._items.map((it, idx) =>
          idx % 200 === 0 ? { ...it, name: 'Updated ' + idx + '-' + Math.random() } : it
        )
        this._inst.state.items = this._items
        this._inst.render()
        flush(this._inst.$el)
      },
      teardown() {
        if (this._inst) { this._inst.destroy(); this._inst = null }
      },
    },

    'list-1000-swap': {
      _inst: null,
      _items: null,
      setup() {
        const sandbox = fresh()
        const el = document.createElement('div')
        el.innerHTML = `
          <template data-each="items" data-key="id">
            <div><span data-text="item.name"></span></div>
          </template>`
        sandbox.appendChild(el)
        this._items = makeItems(1000)
        this._inst = Micra.mount(el, { state: { items: this._items } })
        this._inst.render()
        flush(this._inst.$el)
      },
      run() {
        const next = this._items.slice()
        const tmp = next[0]; next[0] = next[999]; next[999] = tmp
        this._items = next
        this._inst.state.items = next
        this._inst.render()
        flush(this._inst.$el)
      },
      teardown() {
        if (this._inst) { this._inst.destroy(); this._inst = null }
      },
    },

    'state-writes': {
      _inst: null,
      setup() {
        const sandbox = fresh()
        const el = document.createElement('div')
        el.innerHTML = `<span data-text="count"></span>`
        sandbox.appendChild(el)
        this._inst = Micra.mount(el, { state: { count: 0 } })
      },
      async run() {
        for (let i = 0; i < 10000; i++) {
          this._inst.state.count = i
        }
        // Wait for batched render to flush
        await Promise.resolve()
        this._inst.render()
        flush(this._inst.$el)
      },
      teardown() {
        if (this._inst) { this._inst.destroy(); this._inst = null }
      },
    },

    'unmount-1000': {
      _instances: [],
      setup() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.innerHTML = `<span data-text="a"></span>`
          sandbox.appendChild(el)
          this._instances.push(Micra.mount(el, { state: { a: 1 } }))
        }
      },
      run() {
        this._instances.forEach(i => i.destroy())
        this._instances = []
      },
      teardown() {
        // Already destroyed in run
      },
    },
  },
}
