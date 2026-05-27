// Stimulus adapter.
//
// Stimulus is *not* a reactive framework — it doesn't observe state and
// re-render. It's a controller-pattern lib: each controller's `connect()`
// fires when its element enters the DOM, `disconnect()` when it leaves.
// So we can fairly benchmark:
//   - mount-100, mount-1000  (cost of controller wire-up)
//   - unmount-1000           (cost of teardown)
// But NOT list rendering, keyed updates, or "state writes" — that's a
// different paradigm. Those return N/A.

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

let _app = null
function getApp() {
  if (_app) return _app
  const Stimulus = window.Stimulus
  _app = Stimulus.Application.start()

  class CounterController extends Stimulus.Controller {
    static targets = ['a', 'b', 'c']
    connect() {
      if (this.hasATarget) this.aTarget.textContent = '1'
      if (this.hasBTarget) this.bTarget.textContent = '2'
      if (this.hasCTarget) this.cTarget.textContent = '3'
    }
  }

  _app.register('counter', CounterController)
  return _app
}

export const adapter = {
  name: 'Stimulus',
  version: '3.2.2',
  notes: 'Not reactive — list/state-write scenarios are N/A.',
  scenarios: {

    'mount-100': {
      run() {
        getApp() // ensure registered
        const sandbox = fresh()
        for (let i = 0; i < 100; i++) {
          const el = document.createElement('div')
          el.setAttribute('data-controller', 'counter')
          el.innerHTML = `
            <span data-counter-target="a"></span>
            <span data-counter-target="b"></span>
            <span data-counter-target="c"></span>`
          sandbox.appendChild(el)
        }
        // Stimulus observes mutations and connects controllers
        // automatically — but it's async. Force-sync by waiting a tick.
        flush(sandbox)
      },
      teardown() {
        getSandbox().innerHTML = ''
      },
    },

    'mount-1000': {
      run() {
        getApp()
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('data-controller', 'counter')
          el.innerHTML = `
            <span data-counter-target="a"></span>
            <span data-counter-target="b"></span>
            <span data-counter-target="c"></span>`
          sandbox.appendChild(el)
        }
        flush(sandbox)
      },
      teardown() {
        getSandbox().innerHTML = ''
      },
    },

    // Reactive scenarios — Stimulus doesn't do reactive rendering.
    // Adapter returns undefined → runner records 'N/A'.

    'unmount-1000': {
      setup() {
        getApp()
        const sandbox = fresh()
        for (let i = 0; i < 1000; i++) {
          const el = document.createElement('div')
          el.setAttribute('data-controller', 'counter')
          el.innerHTML = `<span data-counter-target="a"></span>`
          sandbox.appendChild(el)
        }
        flush(sandbox)
      },
      run() {
        // Removing the elements triggers disconnect() on each controller.
        getSandbox().innerHTML = ''
        flush(getSandbox())
      },
      teardown() {},
    },
  },
}
