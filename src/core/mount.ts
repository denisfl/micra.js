/**
 * src/core/mount.ts — Mount a component definition onto a DOM element.
 *
 * Responsibilities:
 *   - Create and initialize an InternalInstance
 *   - Set up reactive state + batch scheduler
 *   - Wire render(), destroy(), prop(), fetch(), on(), emit()
 *   - Run initial render + call onCreate() in a microtask
 *
 * LLM NOTE: This is the core of the Micra runtime.
 * mount() is called by both the public Micra.mount() API and by start()
 * (which scans the DOM for [data-component] elements).
 */

import type {
  ComponentDefinition,
  ComponentInstance,
  EventHandler,
  InternalInstance,
  StateRecord,
  UnsubFn,
} from '../types'
import { warn } from '../utils/expr'
import { micraFetch } from '../utils/fetch'
import { on as busOn, emit as busEmit } from '../core/bus'
import { createReactiveState, createScheduler } from '../core/reactive'
import { applyDirectives, validateDirectives } from '../dom/directives'
import { renderList } from '../dom/each'
import { bindDataOn, bindAtEvents, bindModels } from '../dom/events'
import { collectRefs } from '../dom/refs'
import { _instances } from '../core/registry'

/**
 * Mount a component definition onto a DOM element.
 * Returns the component instance, or null if the root element is not found.
 *
 * Already-mounted elements return the existing instance.
 *
 * @example
 * const instance = Micra.mount('#counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },
 * })
 */
export function mount<S extends StateRecord>(
  selector: string | HTMLElement,
  definition: ComponentDefinition<S>,
): ComponentInstance<S> | null {
  const root =
    typeof selector === 'string'
      ? document.querySelector<HTMLElement>(selector)
      : selector

  if (!root) {
    warn(`"${selector}" not found`)
    return null
  }

  // Already mounted — return existing instance without re-mounting
  if (_instances.has(root)) return _instances.get(root) as ComponentInstance<S>

  const rawState: StateRecord = { ...(definition.state ?? {}) }
  const instance = { $el: root, refs: {} } as InternalInstance<S>

  // Copy user-defined methods from definition to instance
  for (const [key, val] of Object.entries(definition as Record<string, unknown>)) {
    if (key === 'state' || key === 'onCreate' || key === 'onDestroy') continue
    if (typeof val === 'function') instance[key] = val
  }

  // ── prop() ────────────────────────────────────────────────────────────────
  // Read data-* attributes from the root element with auto-cast.
  instance.prop = function <T>(name: string, defaultVal?: T): T | undefined {
    const val = root.dataset[name]
    if (val === undefined) return defaultVal
    if (val === 'true')  return true  as unknown as T
    if (val === 'false') return false as unknown as T
    if (val !== '' && !isNaN(Number(val))) return Number(val) as unknown as T
    return val as unknown as T
  } as ComponentInstance<S>['prop']

  // ── fetch(), emit(), on() ─────────────────────────────────────────────────
  instance.fetch = micraFetch
  instance.emit  = busEmit

  instance.on = <T = unknown>(event: string, handler: EventHandler<T>): UnsubFn => {
    const unsub = busOn(event, handler)
    if (!instance.__micraSubs) instance.__micraSubs = []
    instance.__micraSubs.push(unsub)
    return unsub
  }

  // ── Render ────────────────────────────────────────────────────────────────
  let isRendering = false
  const schedule  = createScheduler(() => instance.render())
  instance.state  = createReactiveState(rawState, schedule) as S

  // Expression state: proxy that falls back to instance methods so expressions
  // like `data-text="formatDate(item.date)"` can call component methods.
  const exprState = new Proxy(rawState, {
    get(target, key: string) {
      if (key in target)   return target[key]
      if (key in instance) return instance[key]
      return undefined
    },
  })

  instance.render = function () {
    if (isRendering) return
    isRendering = true
    try {
      applyDirectives(root, exprState, rawState, instance)
      renderList(root, exprState, rawState, instance)
      bindDataOn(root, instance)
      bindAtEvents(root, instance)
      bindModels(root, instance)
      collectRefs(root, instance)
    } finally {
      isRendering = false
    }
  }

  // ── Destroy ───────────────────────────────────────────────────────────────
  instance.destroy = function () {
    instance.__micraSubs?.forEach(unsub => unsub())
    if (typeof (definition as Record<string, unknown>).onDestroy === 'function')
      (definition.onDestroy as () => void).call(instance)
    _instances.delete(root)
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  _instances.set(root, instance as InternalInstance)
  instance.render()

  // Validate directive usage and emit dev warnings
  validateDirectives(root)

  if (typeof (definition as Record<string, unknown>).onCreate === 'function')
    Promise.resolve().then(() =>
      (definition.onCreate as () => void | Promise<void>).call(instance),
    )

  return instance
}
