/**
 * src/core/registry.ts — Component definition registry and instance store.
 *
 * Responsibilities:
 *   - Store named component definitions (define / registry)
 *   - Store live component instances keyed by root HTMLElement (instances)
 *
 * LLM NOTE: Both maps are module-level singletons (one per page load).
 * They are intentionally mutable from mount.ts and start.ts.
 */

import type {
  ComponentDefinition,
  ComponentInstance,
  ComponentMethods,
  InternalInstance,
  StateRecord,
} from '../types'

// Named definition map — populated by define()
export const _registry  = new Map<string, ComponentDefinition>()

// Live instance map — populated by mount(), cleared by instance.destroy()
export const _instances = new Map<HTMLElement, InternalInstance>()

// ── Public accessors ──────────────────────────────────────────────────────────

/**
 * Register a component definition under `name`.
 *
 * Both state shape (`S`) and method set (`M`) are inferred from the literal,
 * so `this.state.X` and `this.someMethod()` are fully typed inside the
 * method bodies and lifecycle hooks.
 *
 * @example
 * define('counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },        // this.state.count: number ✓
 *   reset() { this.state.count = 0 },    // this.reset() is also typed ✓
 *   onCreate() { this.inc() },           // ✓
 * })
 */
export function define<S extends StateRecord, M>(
  name: string,
  definition: ComponentDefinition<S, M>,
): void {
  _registry.set(name, definition as unknown as ComponentDefinition)
}

/**
 * Type-helper — returns `definition` unchanged but lets TypeScript infer `S`
 * and `M` from the literal so all methods are typed with the correct `this`.
 *
 * Use this when defining a component outside a `define()` call.
 *
 * @example
 * const counter = defineComponent({
 *   state: { count: 0 },
 *   increment() { this.state.count++ },  // this.state: { count: number } ✓
 * })
 * Micra.define('counter', counter)
 */
export function defineComponent<S extends StateRecord, M>(
  definition: ComponentDefinition<S, M>,
): ComponentDefinition<S, M> {
  return definition
}

/**
 * Returns a read-only view of all live instances (keyed by root element).
 * Useful for DevTools / debugging.
 */
export function instances(): ReadonlyMap<HTMLElement, ComponentInstance> {
  return _instances as unknown as ReadonlyMap<HTMLElement, ComponentInstance>
}

/**
 * Returns a read-only view of all registered component definitions.
 * Useful for DevTools / debugging.
 */
export function registry(): ReadonlyMap<string, ComponentDefinition> {
  return _registry
}

/**
 * Print all live component instances to the browser console.
 * Shows component name, root element, and current state for each instance.
 *
 * @example
 * // In browser DevTools console:
 * Micra.debug()
 * // [Micra] 3 live component(s)
 * //   counter   $el: <div>  state: { count: 5 }
 * //   user-list $el: <div>  state: { users: [...], loading: false }
 */
export function debug(): void {
  if (_instances.size === 0) {
    console.log('[Micra] No live components.')
    return
  }
  console.group(`[Micra] ${_instances.size} live component(s)`)
  for (const [el, instance] of _instances) {
    const name = el.getAttribute('data-component') ?? '(unnamed)'
    console.group(`%c${name}`, 'font-weight:bold;color:#6366f1')
    console.log('$el  ', el)
    console.log('state', { ...instance.state })
    console.groupEnd()
  }
  console.groupEnd()
}
