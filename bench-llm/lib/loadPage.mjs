/**
 * lib/loadPage.mjs — load a (normalized) HTML document in happy-dom and
 * hand the assertion script a small, stable toolkit.
 *
 * happy-dom does not execute <script> tags inserted via document.write, so
 * we run them manually, in document order, inside the window realm:
 *   - script #1 is always the harness-injected Micra UMD bundle — executed
 *     with a wrapper that exports its top-level `var Micra` onto window;
 *   - every other script runs with `with(window)` so bare references to
 *     document/Micra/addEventListener resolve against the page window.
 * After all scripts run we dispatch DOMContentLoaded + load for code that
 * defers mounting to those events.
 *
 * Fetch is mocked BEFORE any page script runs. Default mock resolves any
 * URL with a small JSON list after ~30 ms; tasks can override per scenario.
 */

import { Window } from 'happy-dom'

const DEFAULT_DATA = [
  { id: 1, name: 'Alice', title: 'Alice' },
  { id: 2, name: 'Bob', title: 'Bob' },
  { id: 3, name: 'Carol', title: 'Carol' },
]

function defaultFetch() {
  return async function mockedFetch() {
    await new Promise(r => setTimeout(r, 30))
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => DEFAULT_DATA,
      text: async () => JSON.stringify(DEFAULT_DATA),
    }
  }
}

// ── template protection ───────────────────────────────────────────────────────
// happy-dom's HTML parser foster-parents <template> (and even <script>) out of
// table contexts, dissolving their content into real rows — a correct-in-browser
// pattern would render nothing in the harness. We cut templates out of the raw
// string before parsing (content lives in a JS map, so no escaping issues),
// leave comment markers, and rebuild real <template> elements programmatically
// after the parse (DOM mutation has no table restrictions).
// v1 limitation: nested <template> elements are not supported.

// attrs part is quote-aware: a '>' inside a quoted attribute value
// (data-if="items.length > 0") must not terminate the tag match
const TPL_RE = /<template((?:"[^"]*"|'[^']*'|[^>"'])*)>([\s\S]*?)<\/template>/gi

function protectTemplates(html) {
  const store = []
  const out = html.replace(TPL_RE, (_, attrs, inner) => {
    store.push({ attrs, inner })
    return `<!--__MICRA_TPL_${store.length - 1}__-->`
  })
  return { out, store }
}

/** Rebuild real <template> elements at the comment markers. Returns the
 *  number restored — a mismatch with store.length means the page was
 *  mangled and must surface as a harness error, not a model failure. */
function restoreTemplates(window, store) {
  const doc = window.document
  if (!store.length || !doc.documentElement) return 0
  const walker = doc.createTreeWalker(doc.documentElement, 128 /* SHOW_COMMENT */)
  const found = []
  let node
  while ((node = walker.nextNode())) {
    const m = /^__MICRA_TPL_(\d+)__$/.exec(node.textContent.trim())
    if (m) found.push([node, Number(m[1])])
  }
  for (const [comment, idx] of found) {
    const { attrs, inner } = store[idx]
    const t = doc.createElement('template')
    if (attrs.trim()) {
      const scratch = doc.createElement('div')
      scratch.innerHTML = `<i ${attrs}></i>`
      for (const a of [...(scratch.firstElementChild?.attributes ?? [])]) {
        t.setAttribute(a.name, a.value)
      }
    }
    t.innerHTML = inner
    comment.parentNode.replaceChild(t, comment)
  }
  return found.length
}

// ── one-time probe: does happy-dom's checkbox click() fire input/change? ─────
const CLICK_FIRES_CHANGE = (() => {
  const w = new Window()
  const cb = w.document.createElement('input')
  cb.type = 'checkbox'
  w.document.body.appendChild(cb)
  let fired = false
  cb.addEventListener('change', () => { fired = true })
  cb.click()
  return fired
})()

function runScripts(window, errors) {
  const scripts = [...window.document.querySelectorAll('script')]
  scripts.forEach((script, i) => {
    const code = script.textContent ?? ''
    if (!code.trim()) return
    try {
      // `with(window)` makes browser globals (NodeFilter, Event, …) resolve on
      // the happy-dom window, while names it lacks fall through to Node globals.
      // The injected bundle is identified by the marker attribute extract.mjs
      // sets at injection time — no content sniffing.
      const isBundle = script.hasAttribute('data-harness-bundle')
      const body = isBundle
        ? `with(window){\n${code}\n;window.Micra = Micra;\n}` // export the UMD's top-level var
        : `with(window){\n${code}\n}`
      new Function('window', 'document', body)(window, window.document)
    } catch (e) {
      errors.push(`script[${i}]: ${e.message}`)
    }
  })
}

export async function loadPage(html, { fetchImpl } = {}) {
  const window = new Window({
    url: 'http://bench.local/',
    settings: {
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      handleDisabledFileLoadingAsSuccess: true,
    },
  })
  const errors = []
  window.addEventListener('error', e => errors.push(String(e.message ?? e.error ?? e)))

  window.fetch = fetchImpl ?? defaultFetch()
  const { out, store } = protectTemplates(html)
  window.document.write(out)
  window.document.close()
  const restored = restoreTemplates(window, store)
  if (restored !== store.length) {
    errors.push(
      `harness: template protect/restore mismatch (${restored}/${store.length}) — page likely mangled by TPL_RE`,
    )
  }

  runScripts(window, errors)

  // pages that defer mounting to DOMContentLoaded / load
  try {
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }))
    window.dispatchEvent(new window.Event('load'))
  } catch (e) {
    errors.push(String(e?.message ?? e))
  }

  // let Micra's microtask render + async onCreate settle
  await new Promise(r => setTimeout(r, 60))

  const document = window.document
  const api = {
    window,
    document,
    errors,
    sleep: ms => new Promise(r => setTimeout(r, ms)),
    $: sel => document.querySelector(sel),
    $$: sel => [...document.querySelectorAll(sel)],
    /** All clickable controls (buttons + role=button + submit inputs + links + th). */
    buttons: () => [
      ...document.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"], a, th',
      ),
    ],
    /** First control whose visible text/value matches (case-insensitive). */
    button: pattern => {
      const re =
        pattern instanceof RegExp
          ? new RegExp(pattern.source, pattern.flags.includes('i') ? pattern.flags : pattern.flags + 'i')
          : new RegExp(pattern, 'i')
      return api.buttons().find(b => re.test((b.textContent || b.value || '').trim())) ?? null
    },
    click: async el => {
      el.click()
      // real browsers fire input+change on checkbox/radio activation;
      // synthesize them when happy-dom doesn't
      if (!CLICK_FIRES_CHANGE && el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
        el.dispatchEvent(new window.Event('input', { bubbles: true }))
        el.dispatchEvent(new window.Event('change', { bubbles: true }))
      }
      await new Promise(r => setTimeout(r, 30))
    },
    /** Set an input's value and fire input+change like a user typing. */
    type: async (el, value) => {
      el.value = value
      el.dispatchEvent(new window.Event('input', { bubbles: true }))
      el.dispatchEvent(new window.Event('change', { bubbles: true }))
      await new Promise(r => setTimeout(r, 30))
    },
    pressEnter: async el => {
      el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      await new Promise(r => setTimeout(r, 30))
    },
    submit: async form => {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }))
      await new Promise(r => setTimeout(r, 30))
    },
    close: () => { try { window.happyDOM.abort?.() } catch { /* noop */ } },
  }
  return api
}
