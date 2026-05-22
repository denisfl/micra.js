/**
 * src/dom/refs.ts — data-ref collection.
 *
 * Responsibilities:
 *   - After each render, scan for `[data-ref]` elements (owned by this component)
 *   - Populate `instance.refs` so methods can do `this.refs.chart` etc.
 *
 * LLM NOTE: This module is PURE relative to state — it only reads DOM attributes
 * and writes to instance.refs. It does NOT trigger renders.
 */
import type { InternalInstance, StateRecord } from '../types';
/**
 * Collect all `[data-ref="name"]` elements owned by this component root into
 * `instance.refs`.
 *
 * Called once after the initial render and again on every re-render (refs may
 * point to newly created elements after an each-list update).
 *
 * @example
 * // HTML: <canvas data-ref="chart">
 * // JS:   this.refs.chart  →  HTMLCanvasElement
 */
export declare function collectRefs<S extends StateRecord>(root: Element, instance: InternalInstance<S>): void;
