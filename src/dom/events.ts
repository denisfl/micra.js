/**
 * src/dom/events.ts — DOM event binding.
 *
 * Responsibilities:
 *   - Bind `data-on="event:method"` listeners (once per element)
 *   - Bind `@event="method"` shorthand (scanned once per component root)
 *
 * LLM NOTE: Listeners are attached exactly once. The `__micraEvents` and
 * `__micraAtScanned` flags prevent duplicate bindings on re-renders.
 */

import type { InternalInstance, MicraElement, StateRecord } from '../types'
import { evalExpr, warn } from '../utils/expr'
import { queryOwn, queryAll } from './query'

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

      el.addEventListener(evName!, (e: Event) => {
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
 * Scanned once per component root (guarded by `__micraAtScanned`).
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
  const mRoot = root as MicraElement
  if (mRoot.__micraAtScanned) return
  mRoot.__micraAtScanned = true

  const all = queryAll(root, '*')
  for (const el of all) {
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('@')) continue
      const [evSpec, ...rest] = attr.name.slice(1).split('.')
      const method = attr.value.trim()

      el.addEventListener(evSpec!, (e: Event) => {
        if (rest.includes('prevent')) e.preventDefault()
        if (rest.includes('stop')) e.stopPropagation()
        if (rest.includes('self') && e.target !== el) return

        const fn = instance[method]
        if (typeof fn === 'function') (fn as (e: Event) => void).call(instance, e)
        else warn(`method "${method}" not found`)
      })
    }
  }
}

// ── data-model ────────────────────────────────────────────────────────────────

/**
 * Two-way binding: `data-model="key"` wires <input>/<select>/<textarea>
 * to `state[key]`. Binding is attached once per element.
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

    const update = () => {
      const val = tag === 'INPUT' && (el as HTMLInputElement).type === 'checkbox'
        ? (el as HTMLInputElement).checked
        : (el as HTMLInputElement).value
      ;(instance.state as StateRecord)[key] = val
    }

    el.addEventListener(tag === 'SELECT' || (el as HTMLInputElement).type === 'radio'
      ? 'change'
      : 'input',
      update,
    )
  }
}
