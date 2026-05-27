// Alpine.js adapter.
//
// Alpine auto-inits on DOMContentLoaded by scanning `x-data`. To control
// timing precisely, we set `window.deferLoadingAlpine` *before* loading
// the script — Alpine then calls our deferred callback whenever we want
// to start. For per-scenario mounting we use `Alpine.initTree(rootEl)`
// to scope initialization to a subtree.

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
  // Destroy any Alpine instances before clearing
  if (window.Alpine && window.Alpine.destroyTree) {
    window.Alpine.destroyTree(sandbox)
  }
  sandbox.innerHTML = ''
  return sandbox
}

function flush(el) { return el.offsetHeight }

// Wait until the next animation frame, then flush layout. Used to honestly
// measure async-scheduled libraries (Alpine batches renders via queueMicrotask
// + scheduler; raf is the safest point at which everything has settled).
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

const Alpine = () => window.Alpine

export const adapter = {
  name: 'Alpine.js',
  version: '3.14.1',
  scenarios: {

    'mount-100': {
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 100; i++) {
          const el = document.createElement('div')
          el.setAttribute('x-data', '{ a: 1, b: 2, c: 3 }')
          el.innerHTML = `<span x-text="a"></span><span x-text="b"></span><span x-text="c"></span>`
          sandbox.appendChild(el)
        }
        Alpine().initTree(sandbox)
        flush(sandbox)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
      },
    },

    'mount-1000': {
      run() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('x-data', '{ a: 1, b: 2, c: 3 }')
          el.innerHTML = `<span x-text="a"></span><span x-text="b"></span><span x-text="c"></span>`
          sandbox.appendChild(el)
        }
        Alpine().initTree(sandbox)
        flush(sandbox)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
      },
    },

    'list-1000-first': {
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        // Alpine renders lists via x-for in a template
        const root = document.createElement('div')
        root.setAttribute('x-data', 'window.__alpineBench')
        root.innerHTML = `
          <template x-for="item in items" :key="item.id">
            <div>
              <span x-text="item.name"></span>
              <span x-text="item.value"></span>
            </div>
          </template>`
        // Use a global store so we can mutate the source array
        window.__alpineBench = Alpine().reactive({ items: [] })
        this._data = window.__alpineBench
        sandbox.appendChild(root)
        Alpine().initTree(sandbox)
        this._root = root
      },
      async run() {
        this._data.items = makeItems(1000)
        await settleAndFlush(this._root)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
        delete window.__alpineBench
      },
    },

    'list-1000-update': {
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('x-data', 'window.__alpineBench')
        root.innerHTML = `
          <template x-for="item in items" :key="item.id">
            <div>
              <span x-text="item.name"></span>
              <span x-text="item.value"></span>
            </div>
          </template>`
        window.__alpineBench = Alpine().reactive({ items: makeItems(1000) })
        this._data = window.__alpineBench
        sandbox.appendChild(root)
        Alpine().initTree(sandbox)
        flush(root)
        this._root = root
      },
      async run() {
        this._data.items = this._data.items.map((it, idx) =>
          idx % 200 === 0 ? { ...it, name: 'Updated ' + idx + '-' + Math.random() } : it
        )
        await settleAndFlush(this._root)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
        delete window.__alpineBench
      },
    },

    'list-1000-swap': {
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('x-data', 'window.__alpineBench')
        root.innerHTML = `
          <template x-for="item in items" :key="item.id">
            <div><span x-text="item.name"></span></div>
          </template>`
        window.__alpineBench = Alpine().reactive({ items: makeItems(1000) })
        this._data = window.__alpineBench
        sandbox.appendChild(root)
        Alpine().initTree(sandbox)
        flush(root)
        this._root = root
      },
      async run() {
        const next = this._data.items.slice()
        const tmp = next[0]; next[0] = next[999]; next[999] = tmp
        this._data.items = next
        await settleAndFlush(this._root)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
        delete window.__alpineBench
      },
    },

    'state-writes': {
      _root: null,
      _data: null,
      setup() {
        const sandbox = fresh()
        const root = document.createElement('div')
        root.setAttribute('x-data', 'window.__alpineBench')
        root.innerHTML = `<span x-text="count"></span>`
        window.__alpineBench = Alpine().reactive({ count: 0 })
        this._data = window.__alpineBench
        sandbox.appendChild(root)
        Alpine().initTree(sandbox)
        this._root = root
      },
      async run() {
        for (let i = 0; i < 10000; i++) {
          this._data.count = i
        }
        await settleAndFlush(this._root)
      },
      teardown() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
        delete window.__alpineBench
      },
    },

    'unmount-1000': {
      setup() {
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('x-data', '{ a: 1 }')
          el.innerHTML = `<span x-text="a"></span>`
          sandbox.appendChild(el)
        }
        Alpine().initTree(sandbox)
        flush(sandbox)
      },
      run() {
        const sandbox = getSandbox()
        Alpine().destroyTree(sandbox)
        sandbox.innerHTML = ''
      },
      teardown() {},
    },
  },
}
