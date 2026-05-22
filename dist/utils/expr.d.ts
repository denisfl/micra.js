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
import type { StateRecord } from '../types';
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
export declare function evalExpr(expr: string, state: StateRecord): unknown;
/** @internal Consistent warning prefix. */
export declare function warn(msg: string): void;
