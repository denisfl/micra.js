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
import type { CachedBinding, InternalInstance, StateRecord } from '../types';
/**
 * Bind `data-on="event:method[,event2:method2]"` listeners.
 * Listeners are bound once — re-render calls are no-ops for already-bound elements.
 *
 * Supports modifiers: `click.prevent`, `click.stop`, `click.self`.
 *
 * @param els - Pre-computed list of [data-on] elements from scan.ts
 *
 * @example
 * <button data-on="click:save">Save</button>
 * <form  data-on="submit.prevent:handleSubmit">
 */
export declare function bindDataOn<S extends StateRecord>(els: Element[], instance: InternalInstance<S>): void;
/**
 * Bind `@event="method"` shorthand attributes (Stimulus-style).
 * Bound once per element via `__micraAtBound` — re-renders are no-ops.
 *
 * @param els - Pre-computed list of elements with at least one @-prefixed attr
 *              (from scan.ts — replaces the old `querySelectorAll('*')` walk)
 *
 * @example
 * <button @click="increment">+</button>
 * <form @submit.prevent="handleSubmit">
 */
export declare function bindAtEvents<S extends StateRecord>(els: Element[], instance: InternalInstance<S>): void;
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
export declare function bindModels<S extends StateRecord>(bindings: CachedBinding[], instance: InternalInstance<S>): void;
