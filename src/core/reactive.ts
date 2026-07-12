/**
 * src/core/reactive.ts — Reactive state proxy and batch scheduler.
 *
 * Responsibilities:
 *   - Wrap a plain state object in a Proxy that notifies on writes
 *   - Batch multiple synchronous mutations into a single microtask render
 *
 * LLM NOTE: Both functions are PURE constructors — they have no side effects
 * beyond setting up a Proxy / Promise chain. No DOM access here.
 */

import type { StateRecord } from '../types'

/**
 * Wrap `obj` in a shallow Proxy. Any property write calls `schedule()`.
 * Arrays: replace, don't mutate — `state.items = [...state.items, x]`.
 *
 * @example
 * const raw = { count: 0 }
 * const state = createReactiveState(raw, render)
 * state.count = 5  // triggers render() in next microtask
 */
export function createReactiveState<S extends StateRecord>(obj: S, schedule: () => void, onKey?: (key: string) => void): S {
  return new Proxy(obj, {
    set(target, key: string, value: unknown) {
      // Cast through StateRecord — TypeScript cannot write through a generic index
      ;(target as StateRecord)[key] = value
      onKey?.(key)
      schedule()
      return true
    },
    deleteProperty(target, key: string) {
      delete (target as StateRecord)[key]
      onKey?.(key)
      schedule()
      return true
    },
  })
}

/**
 * Set a value on `state` by dot-path, reconstructing each nested level
 * immutably and reassigning the top-level key — so the shallow proxy fires
 * exactly one render. Flat paths (`"count"`) are a plain top-level write.
 *
 * Shared by `this.set()` and `data-model="a.b"`; keeps the proxy shallow
 * while removing the "spread nested objects by hand" footgun.
 *
 * @example setPath(state, 'user.name', 'Ada')  // state.user = { ...state.user, name: 'Ada' }
 */
export function setPath(state: StateRecord, path: string, value: unknown): void {
  const parts = path.split('.')
  const top = parts[0]!
  if (parts.length === 1) { state[top] = value; return }
  // Preserve arrays: `{ ...array }` would turn state.items into a plain object
  // and data-each would clear the list. Numeric segments address array indices.
  const copy = (v: unknown): StateRecord =>
    (Array.isArray(v) ? [...v] : { ...(v as StateRecord) }) as StateRecord
  const root = copy(state[top])
  let cur = root
  for (let i = 1; i < parts.length - 1; i++) {
    cur = cur[parts[i]!] = copy(cur[parts[i]!])
  }
  cur[parts[parts.length - 1]!] = value
  state[top] = root
}

/**
 * Return a debounce function that defers `render` to the next microtask.
 * Multiple calls within the same tick collapse to a single render.
 *
 * Uses `queueMicrotask` so each batch enqueues a single microtask instead of
 * allocating a Promise + reaction job. `flush` is hoisted out of the hot path
 * so it isn't re-created on every schedule() call.
 *
 * @example
 * const schedule = createScheduler(render)
 * schedule()  // defers render
 * schedule()  // no-op — already pending
 */
export function createScheduler(render: () => void): () => void {
  let pending = false
  const flush = () => { pending = false; render() }
  return function schedule() {
    if (pending) return
    pending = true
    queueMicrotask(flush)
  }
}
