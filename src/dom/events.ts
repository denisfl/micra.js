/**
 * src/dom/events.ts — DOM event binding.
 *
 * Responsibilities:
 *   - Bind `data-on="event:method"` listeners (once per element)
 *   - Bind `@event="method"` shorthand (once per element)
 *   - Bind `data-model` two-way input listeners (once per element)
 *
 * LLM NOTE: Every listener attached here is also recorded in
 * instance.__micraListeners so destroy() can remove it cleanly.
 * Re-render skips already-bound elements via per-element __micra* flags.
 *
 * All three binders accept pre-computed element lists from scan.ts —
 * no DOM queries here.
 */

import type {
  CachedBinding,
  InternalInstance,
  MicraElement,
  StateRecord,
} from '../types'
import { evalExpr, splitTop, warn } from '../utils/expr'
import { setPath } from '../core/reactive'

/** @internal Attach a DOM listener and track it on the instance for destroy(). */
function track<S extends StateRecord>(
  instance: InternalInstance<S>,
  el: Element,
  type: string,
  fn: EventListener,
): void {
  el.addEventListener(type, fn)
  ;(instance.__micraListeners ?? (instance.__micraListeners = [])).push({ el, type, fn })
}

// ── Event modifiers ─────────────────────────────────────────────────────────
// `.prevent` / `.stop` / `.self` are actions/guards. Everything else is a key
// or system-key guard: the handler runs only if the event matches.
const SYS_MOD: Record<string, 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'> = {
  ctrl: 'ctrlKey', shift: 'shiftKey', alt: 'altKey', meta: 'metaKey', cmd: 'metaKey',
}
const KEY_MOD: Record<string, string> = {
  enter: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: ' ',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', delete: 'Delete',
}

/**
 * Apply event modifiers. Runs `.prevent`/`.stop` side effects; returns false
 * (= block the handler) when `.self` or a key/system guard doesn't match.
 *
 *   @keydown.enter   → only when e.key === 'Enter'
 *   @click.ctrl      → only when e.ctrlKey
 *   @keydown.ctrl.s  → Ctrl+S
 *   @click.self      → only when e.target is the element itself
 * An unrecognized modifier is matched case-insensitively against `e.key`.
 */
function applyModifiers(e: Event, el: Element, mods: string[]): boolean {
  for (const m of mods) {
    if (m === 'prevent') e.preventDefault()
    else if (m === 'stop') e.stopPropagation()
    else if (m === 'self') { if (e.target !== el) return false }
    else if (SYS_MOD[m]) { if (!(e as KeyboardEvent)[SYS_MOD[m]]) return false }
    else {
      const key = (e as KeyboardEvent).key
      if (key == null) return false
      if (!(KEY_MOD[m] ? key === KEY_MOD[m] : key.toLowerCase() === m)) return false
    }
  }
  return true
}

/**
 * Run an event handler. Two shapes, both used by `data-on` and `@event`:
 *   - bare method name   `save`            → instance.save(e)
 *   - call expression    `select(item.id)` → evaluated against an event scope
 *     (row `item` if inside `data-each`, `$event`/`event`, component methods).
 *     Call expressions are the recommended form for `@event`; in `data-on` the
 *     handler separator is `,` so multi-argument calls there are not supported.
 */
function runHandler<S extends StateRecord>(
  instance: InternalInstance<S>,
  el: Element,
  value: string,
  e: Event,
): void {
  if (value.includes('(')) {
    // Build the scope: nearest ancestor-or-self row itemState (it already
    // prototype-chains to the component's expr scope), else the expr scope.
    let base: StateRecord | undefined
    for (let n: Element | null = el; n && !base; n = n.parentElement) {
      base = (n as MicraElement)._itemState
    }
    const scope = Object.create(base ?? instance.__micraExpr ?? null) as StateRecord
    scope['$event'] = scope['event'] = e
    evalExpr(value, scope) // performs the call; return value ignored
    return
  }
  const fn = instance[value]
  if (typeof fn === 'function') (fn as (e: Event) => void).call(instance, e)
  else warn(`method "${value}" not found`)
}

// ── data-on + @event ──────────────────────────────────────────────────────────

/** @internal Bind one `event[.mod…]` spec to a handler string. */
function listen<S extends StateRecord>(
  instance: InternalInstance<S>,
  el: Element,
  spec: string,
  handler: string,
): void {
  const [type, ...mods] = spec.split('.')
  track(instance, el, type!, (e: Event) => {
    if (applyModifiers(e, el, mods)) runHandler(instance, el, handler, e)
  })
}

/**
 * Bind `data-on="event:method[,event2:method2]"` and `@event[.mod]="method"`
 * listeners. Bound once per element (`__micraEvents`) — re-renders are no-ops.
 *
 * @param els - Elements with a data-on and/or @-prefixed attribute (scan.ts)
 *
 * @example
 * <button data-on="click:save">Save</button>
 * <form @submit.prevent="handleSubmit">
 */
export function bindDataOn<S extends StateRecord>(
  els: Element[],
  instance: InternalInstance<S>,
): void {
  for (const el of els) {
    const mEl = el as MicraElement
    if (mEl.__micraEvents) continue
    mEl.__micraEvents = true

    // Split on top-level commas only — a comma inside quotes or parens belongs
    // to a call: data-on="click:go('a,b'), focus:pick(1, 2)".
    for (const part of splitTop(mEl.dataset['on'] ?? '')) {
      // First colon separates event from handler; later colons belong to the
      // handler expression (string args, ternaries).
      const cut = part.indexOf(':')
      if (cut === -1) continue
      const evSpec = part.slice(0, cut).trim()
      const method = part.slice(cut + 1)
      if (!evSpec || !method.trim()) continue
      listen(instance, el, evSpec, method.trim())
    }
    for (const attr of el.attributes as unknown as Attr[])
      if (attr.name[0] === '@') listen(instance, el, attr.name.slice(1), attr.value.trim())
  }
}

// ── data-model ────────────────────────────────────────────────────────────────

/**
 * Two-way binding: `data-model="key"` wires <input>/<select>/<textarea>
 * to `state[key]`. Binding is attached once per element.
 *
 * Dot-paths are supported: `data-model="filters.search"` writes through
 * `instance.set('filters.search', …)` (reconstructs the nested object), and
 * the value is read back via the same path.
 *
 * Numeric inputs (`type="number"` / `type="range"`) write numbers, not strings.
 * Checkbox inputs write booleans. Everything else writes strings.
 *
 * @param bindings - Pre-computed model bindings from scan.ts
 *                   (each carries { el, expr } where expr is the state key/path)
 *
 * @example
 * <input data-model="search">          // updates state.search on every keystroke
 * <input data-model="filters.query">   // updates state.filters.query (nested)
 */
export function bindModels<S extends StateRecord>(
  bindings: CachedBinding[],
  instance: InternalInstance<S>,
): void {
  for (const { el, expr } of bindings) {
    const mEl = el as MicraElement
    if (mEl.__micraModel) continue
    mEl.__micraModel = true

    const key = expr.trim()
    const tag = el.tagName
    const inputEl = el as HTMLInputElement
    const inputType = inputEl.type

    const update = () => {
      let val: unknown
      if (tag === 'INPUT' && inputType === 'checkbox') {
        val = inputEl.checked
      } else if (tag === 'INPUT' && (inputType === 'number' || inputType === 'range')) {
        // Empty string → NaN; preserve raw empty as null so state stays "unfilled"
        val = inputEl.value === '' ? null : inputEl.valueAsNumber
      } else {
        val = inputEl.value
      }
      setPath(instance.state as StateRecord, key, val) // path-aware: flat & nested
    }

    const evType = tag === 'SELECT' || inputType === 'radio' ? 'change' : 'input'
    track(instance, el, evType, update)
  }
}
