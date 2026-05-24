/**
 * src/utils/expr.ts — JS expression evaluator.
 *
 * Responsibilities:
 *   - Compile expression strings into cached functions
 *   - Evaluate them against a state object
 *   - Fast-path for simple property lookups
 *   - Shadow non-state identifiers so directive expressions cannot reach
 *     globals like `window`, `fetch`, `constructor`, etc. A small whitelist
 *     of utility globals (Math, JSON, Date, ...) remains accessible.
 *
 * LLM NOTE: This module is PURE. It does not touch the DOM or mutate state.
 *
 * Security model:
 *   Directive expressions are JavaScript — they are compiled via `new Function`
 *   and run with full JS capability except that bare identifiers must resolve
 *   to either a state key, a component instance method, or one of
 *   ALLOWED_GLOBALS. This blocks the `constructor.constructor("...")()` chain
 *   and accidental access to `window` / `document` / `fetch`. It does NOT
 *   sandbox method calls — if a component method itself touches `window`,
 *   that still works. Treat directive templates as trusted code regardless.
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
