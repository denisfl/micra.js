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
import type { StateRecord } from '../types';
/**
 * Wrap `obj` in a shallow Proxy. Any property write calls `schedule()`.
 * Arrays: replace, don't mutate — `state.items = [...state.items, x]`.
 *
 * @example
 * const raw = { count: 0 }
 * const state = createReactiveState(raw, render)
 * state.count = 5  // triggers render() in next microtask
 */
export declare function createReactiveState<S extends StateRecord>(obj: S, schedule: () => void, onKey?: (key: string) => void): S;
/**
 * Return a debounce function that defers `render` to the next microtask.
 * Multiple calls within the same tick collapse to a single render.
 *
 * @example
 * const schedule = createScheduler(render)
 * schedule()  // defers render
 * schedule()  // no-op — already pending
 */
export declare function createScheduler(render: () => void): () => void;
