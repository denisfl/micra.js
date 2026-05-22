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
import type { ComponentDefinition, ComponentInstance, InternalInstance, StateRecord } from '../types';
export declare const _registry: Map<string, ComponentDefinition>;
export declare const _instances: Map<HTMLElement, InternalInstance<StateRecord>>;
/**
 * Register a component definition under `name`.
 *
 * @example
 * define('counter', { state: { count: 0 }, inc() { this.state.count++ } })
 */
export declare function define<S extends StateRecord>(name: string, definition: ComponentDefinition<S>): void;
/**
 * Type-helper — returns `definition` unchanged but lets TypeScript infer `S`
 * from the `state` literal so all methods are typed with the correct `this`.
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
export declare function defineComponent<S extends StateRecord>(definition: ComponentDefinition<S>): ComponentDefinition<S>;
/**
 * Returns a read-only view of all live instances (keyed by root element).
 * Useful for DevTools / debugging.
 */
export declare function instances(): ReadonlyMap<HTMLElement, ComponentInstance>;
/**
 * Returns a read-only view of all registered component definitions.
 * Useful for DevTools / debugging.
 */
export declare function registry(): ReadonlyMap<string, ComponentDefinition>;
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
export declare function debug(): void;
