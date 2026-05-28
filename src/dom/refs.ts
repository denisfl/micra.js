/**
 * src/dom/refs.ts — data-ref collection.
 *
 * Responsibilities:
 *   - Populate `instance.refs` from a pre-scanned list of [data-ref] elements.
 *
 * LLM NOTE: This module is PURE relative to state — it only reads DOM attributes
 * and writes to instance.refs. It does NOT trigger renders.
 */

import type { InternalInstance, MicraElement, StateRecord } from '../types'

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
export function collectRefs<S extends StateRecord>(
  els: Element[],
  instance: InternalInstance<S>,
): void {
  if (!els.length) return
  instance.refs = {}
  for (const el of els) {
    const name = (el as MicraElement).dataset['ref']
    if (name) instance.refs[name] = el as HTMLElement
  }
}
