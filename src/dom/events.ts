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
 */

import type { InternalInstance, MicraElement, StateRecord } from '../types'
import { warn } from '../utils/expr'
import { queryOwn, queryAll } from './query'

/** @internal Attach a DOM listener and track it on the instance for destroy(). */
function track<S extends StateRecord>(
  instance: InternalInstance<S>,
  el: Element,
  type: string,
  fn: EventListener,
): void {
  el.addEventListener(type, fn)
  ;(instance.__micraListeners ??= []).push({ el, type, fn })
}

// ── data-on ───────────────────────────────────────────────────────────────────

/**
 * Bind `data-on="event:method[,event2:method2]"` listeners.
 * Listeners are bound once — re-render calls are no-ops for already-bound elements.
 *
 * Supports modifiers: `click.prevent`, `click.stop`, `click.self`.
 *
 * @example
 * <button data-on="click:save">Save</button>
 * <form  data-on="submit.prevent:handleSubmit">
 */
export function bindDataOn<S extends StateRecord>(
  root: Element,
  instance: InternalInstance<S>,
): void {
  const isFragment = root.nodeType === 11
  const els = isFragment
    ? queryAll(root as unknown as ParentNode, '[data-on]')
    : queryOwn(root, 'data-on')

  // Include root itself if it carries data-on (e.g., the keyed item IS the button)
  if (!isFragment && (root as HTMLElement).hasAttribute?.('data-on') && !els.includes(root))
    els.unshift(root)

  for (const el of els) {
    const mEl = el as MicraElement
    if (mEl.__micraEvents) continue
    mEl.__micraEvents = true

    const spec = mEl.dataset['on'] ?? ''
    for (const part of spec.split(',')) {
      const [evSpec, method] = part.trim().split(':') as [string, string]
      if (!evSpec || !method) continue

      const [evName, ...mods] = evSpec.split('.')

      track(instance, el, evName!, (e: Event) => {
        if (mods.includes('prevent')) e.preventDefault()
        if (mods.includes('stop')) e.stopPropagation()
        if (mods.includes('self') && e.target !== el) return

        const fn = instance[method.trim()]
        if (typeof fn === 'function') (fn as (e: Event) => void).call(instance, e)
        else warn(`method "${method.trim()}" not found`)
      })
    }
  }
}

// ── @event shorthand ──────────────────────────────────────────────────────────

/**
 * Bind `@event="method"` shorthand attributes (Stimulus-style).
 * Bound once per element via `__micraAtBound` — re-renders are no-ops.
 * Supports the same modifiers as data-on: `@click.prevent="submit"`.
 *
 * @example
 * <button @click="increment">+</button>
 * <form @submit.prevent="handleSubmit">
 */
export function bindAtEvents<S extends StateRecord>(
  root: Element,
  instance: InternalInstance<S>,
): void {
  const isFragment = root.nodeType === 11
  const all = isFragment
    ? queryAll(root as unknown as ParentNode, '*')
    : queryAll(root, '*')

  // Include root itself for the regular-element case
  if (!isFragment && !all.includes(root)) all.unshift(root)

  for (const el of all) {
    const mEl = el as MicraElement
    if (mEl.__micraAtBound) continue

    let bound = false
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('@')) continue
      const [evSpec, ...rest] = attr.name.slice(1).split('.')
      const method = attr.value.trim()

      track(instance, el, evSpec!, (e: Event) => {
        if (rest.includes('prevent')) e.preventDefault()
        if (rest.includes('stop')) e.stopPropagation()
        if (rest.includes('self') && e.target !== el) return

        const fn = instance[method]
        if (typeof fn === 'function') (fn as (e: Event) => void).call(instance, e)
        else warn(`method "${method}" not found`)
      })
      bound = true
    }
    if (bound) mEl.__micraAtBound = true
  }
}

// ── data-model ────────────────────────────────────────────────────────────────

/**
 * Two-way binding: `data-model="key"` wires <input>/<select>/<textarea>
 * to `state[key]`. Binding is attached once per element.
 *
 * Numeric inputs (`type="number"` / `type="range"`) write numbers, not strings.
 * Checkbox inputs write booleans. Everything else writes strings.
 *
 * @example
 * <input data-model="search">   // updates state.search on every keystroke
 * <select data-model="sortBy">  // updates state.sortBy on change
 */
export function bindModels<S extends StateRecord>(
  root: Element,
  instance: InternalInstance<S>,
): void {
  const isFragment = root.nodeType === 11
  const els = isFragment
    ? queryAll(root as unknown as ParentNode, '[data-model]')
    : queryOwn(root, 'data-model')

  for (const el of els) {
    const mEl = el as MicraElement
    if (mEl.__micraModel) continue
    mEl.__micraModel = true

    const key = (el as HTMLInputElement).dataset['model'] ?? ''
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
      ;(instance.state as StateRecord)[key] = val
    }

    const evType = tag === 'SELECT' || inputType === 'radio' ? 'change' : 'input'
    track(instance, el, evType, update)
  }
}
