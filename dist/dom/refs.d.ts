/**
 * src/dom/refs.ts — data-ref collection.
 *
 * Responsibilities:
 *   - Populate `instance.refs` from a pre-scanned list of [data-ref] elements.
 *
 * LLM NOTE: This module is PURE relative to state — it only reads DOM attributes
 * and writes to instance.refs. It does NOT trigger renders.
 */
import type { InternalInstance, StateRecord } from '../types';
/**
 * Build `instance.refs` from the pre-scanned [data-ref] elements.
 *
 * Called once after the initial render and again on every re-render (refs may
 * point to newly created elements after an each-list update).
 *
 * @param els - List of [data-ref] elements from scan.ts
 *
 * @example
 * // HTML: <canvas data-ref="chart">
 * // JS:   this.refs.chart  →  HTMLCanvasElement
 */
export declare function collectRefs<S extends StateRecord>(els: Element[], instance: InternalInstance<S>): void;
