// petite-vue adapter.
//
// petite-vue exposes a global `PetiteVue` with `createApp({data}).mount(el)`.
// Each createApp() returns an instance with an .unmount() method.
// For our scenarios we create one app per benchmark.

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

// Wait until the next animation frame, then flush layout. petite-vue
// schedules reactivity via Vue's queue (microtasks) — raf runs past every
// microtask, so this guarantees the render completed before we stop measuring.
function settleAndFlush(el) {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      flush(el)
      resolve()
    })
  })
}

function makeItems(n) {
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = { id: i, name: 'Row ' + i, value: i * 7 }
  return out
}

const PV = () => window.PetiteVue

export const adapter = {
  name: 'petite-vue',
  version: '0.4.1',
  scenarios: {

    'mount-100': {
      _apps: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 100; i++) {
          const el = document.createElement('div')
          el.setAttribute('v-scope', '{ a: 1, b: 2, c: 3 }')
          el.innerHTML = `<span v-text="a"></span><span v-text="b"></span><span v-text="c"></span>`
          sandbox.appendChild(el)
          this._apps.push(PV().createApp().mount(el))
        }
        flush(sandbox)
      },
      teardown() {
        this._apps.forEach(a => a.unmount && a.unmount())
        this._apps = []
      },
    },

    'mount-1000': {
      _apps: [],
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('v-scope', '{ a: 1, b: 2, c: 3 }')
          el.innerHTML = `<span v-text="a"></span><span v-text="b"></span><span v-text="c"></span>`
          sandbox.appendChild(el)
          this._apps.push(PV().createApp().mount(el))
        }
        flush(sandbox)
      },
      teardown() {
        this._apps.forEach(a => a.unmount && a.unmount())
        this._apps = []
      },
    },

    'list-1000-first': {
      _app: null,
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('v-scope', '')
        root.innerHTML = `
          <template v-for="item in items" :key="item.id">
            <div>
              <span v-text="item.name"></span>
              <span v-text="item.value"></span>
            </div>
          </template>`
        sandbox.appendChild(root)
        this._data = { items: [] }
        this._app = PV().createApp(this._data).mount(root)
        this._root = root
      },
      run() {
        this._data.items = makeItems(1000)
        // petite-vue uses Vue's reactivity — flush via microtask
        return settleAndFlush(this._root)
      },
      teardown() {
        if (this._app && this._app.unmount) this._app.unmount()
        this._app = this._root = this._data = null
      },
    },

    'list-1000-update': {
      _app: null,
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('v-scope', '')
        root.innerHTML = `
          <template v-for="item in items" :key="item.id">
            <div>
              <span v-text="item.name"></span>
              <span v-text="item.value"></span>
            </div>
          </template>`
        sandbox.appendChild(root)
        this._data = { items: makeItems(1000) }
        this._app = PV().createApp(this._data).mount(root)
        this._root = root
        return settleAndFlush(this._root)
      },
      run() {
        this._data.items = this._data.items.map((it, idx) =>
          idx % 200 === 0 ? { ...it, name: 'Updated ' + idx + '-' + Math.random() } : it
        )
        return settleAndFlush(this._root)
      },
      teardown() {
        if (this._app && this._app.unmount) this._app.unmount()
        this._app = this._root = this._data = null
      },
    },

    'list-1000-swap': {
      _app: null,
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('v-scope', '')
        root.innerHTML = `
          <template v-for="item in items" :key="item.id">
            <div><span v-text="item.name"></span></div>
          </template>`
        sandbox.appendChild(root)
        this._data = { items: makeItems(1000) }
        this._app = PV().createApp(this._data).mount(root)
        this._root = root
        return settleAndFlush(this._root)
      },
      run() {
        const next = this._data.items.slice()
        const tmp = next[0]; next[0] = next[999]; next[999] = tmp
        this._data.items = next
        return settleAndFlush(this._root)
      },
      teardown() {
        if (this._app && this._app.unmount) this._app.unmount()
        this._app = this._root = this._data = null
      },
    },

    'state-writes': {
      _app: null,
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('v-scope', '')
        root.innerHTML = `<span v-text="count"></span>`
        sandbox.appendChild(root)
        this._data = { count: 0 }
        this._app = PV().createApp(this._data).mount(root)
        this._root = root
      },
      async run() {
        for (let i = 0; i < 10000; i++) {
          this._data.count = i
        }
        await settleAndFlush(this._root)
      },
      teardown() {
        if (this._app && this._app.unmount) this._app.unmount()
        this._app = this._root = this._data = null
      },
    },

    'unmount-1000': {
      _apps: [],
      setup() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('v-scope', '{ a: 1 }')
          el.innerHTML = `<span v-text="a"></span>`
          sandbox.appendChild(el)
          this._apps.push(PV().createApp().mount(el))
        }
      },
      run() {
        this._apps.forEach(a => a.unmount && a.unmount())
        this._apps = []
        getSandbox().innerHTML = ''
      },
      teardown() {},
    },
  },
}
