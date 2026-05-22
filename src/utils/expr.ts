/**
 * src/utils/expr.ts — JS expression evaluator.
 *
 * Responsibilities:
 *   - Compile expression strings into cached functions
 *   - Evaluate them against a state object
 *   - Fast-path for simple property lookups
 *
 * LLM NOTE: This module is PURE. It does not touch the DOM or mutate state.
 * All side effects are isolated to console.warn on invalid expressions.
 */

import type { StateRecord } from '../types'

// ── Expression cache ──────────────────────────────────────────────────────────
// Compiled functions are keyed by expression string — Function() is only called
// once per unique expression across the entire app lifetime.

// LLM NOTE: exprCache is module-level (shared across all components).
// This is intentional — most apps reuse the same expressions.
const exprCache = new Map<string, (state: StateRecord) => unknown>()

// Simple identifier or dot-path: "count", "user.name", "item.email"
// Matches: letter/$/_ followed by word chars, optionally with .property chains
const SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/

/**
 * Evaluate a JS expression string against a state object.
 *
 * Results are cached by expression string — repeated evaluations hit the cache.
 * Uses a fast-path for simple dot-paths (e.g. "count", "user.name") that avoids
 * Function() overhead.
 *
 * @example
 * evalExpr('count > 0', { count: 5 })   // → true
 * evalExpr('user.name', { user: { name: 'Alice' } }) // → 'Alice'
 * evalExpr('price * qty', { price: 9.99, qty: 3 })   // → 29.97
 */
export function evalExpr(expr: string, state: StateRecord): unknown {
  // Fast-path: simple property access — no Function() needed
  if (SIMPLE_PATH.test(expr)) {
    return expr.split('.').reduce<unknown>((obj, key) =>
      obj != null ? (obj as StateRecord)[key] : undefined,
      state,
    )
  }

  if (!exprCache.has(expr)) {
    try {
      exprCache.set(
        expr,
        new Function('$s', `with($s){return (${expr})}`) as (s: StateRecord) => unknown,
      )
    } catch {
      warn(`invalid expression "${expr}"`)
      exprCache.set(expr, () => undefined)
    }
  }

  try {
    return exprCache.get(expr)!(state)
  } catch {
    return undefined
  }
}

// ── Dev warnings ──────────────────────────────────────────────────────────────

/** @internal Consistent warning prefix. */
export function warn(msg: string): void {
  console.warn(`[Micra] ${msg}`)
}
