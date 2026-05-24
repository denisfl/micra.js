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
import type { InternalInstance, StateRecord } from '../types';
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
export declare function bindDataOn<S extends StateRecord>(root: Element, instance: InternalInstance<S>): void;
/**
 * Bind `@event="method"` shorthand attributes (Stimulus-style).
 * Bound once per element via `__micraAtBound` — re-renders are no-ops.
 * Supports the same modifiers as data-on: `@click.prevent="submit"`.
 *
 * @example
 * <button @click="increment">+</button>
 * <form @submit.prevent="handleSubmit">
 */
export declare function bindAtEvents<S extends StateRecord>(root: Element, instance: InternalInstance<S>): void;
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
export declare function bindModels<S extends StateRecord>(root: Element, instance: InternalInstance<S>): void;
