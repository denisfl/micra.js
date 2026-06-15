/**
 * src/utils/expr.ts — CSP-safe JS-expression evaluator.
 *
 * Directive expressions (`data-text="count > 0"`, `data-class="x:a === b"`, …)
 * are parsed into a small AST and walked by an interpreter. There is NO
 * `new Function` / `eval` anywhere — so Micra runs under a strict
 * Content-Security-Policy (`default-src 'self'`, no `unsafe-eval`).
 *
 * LLM NOTE: This module is PURE. It does not touch the DOM or mutate state.
 *
 * Security model:
 *   The interpreter can only reach: top-level state keys, component methods,
 *   and a whitelist of utility globals (Math, JSON, Date, …). A bare
 *   identifier that is none of those resolves to `undefined` — `window`,
 *   `document`, `fetch`, `eval`, `constructor` are unreachable *by
 *   construction* (there is no scope that contains them), not by shadowing.
 *   Member access additionally refuses the prototype-escape property names
 *   (`__proto__`, `constructor`, `prototype`), closing the
 *   `item.constructor.constructor("…")()` chain that the old `with()`-based
 *   evaluator left open. Method calls still run real JS — if a component
 *   method touches `window`, that works; treat directive templates as
 *   trusted code regardless.
 *
 * Grammar (precedence low→high):
 *   ternary ?:  |  ||  |  &&  |  == != === !==  |  < <= > >=  |  + -  |
 *   * / %  |  unary ! -  |  call() / member.  |  primary
 *   primary = number | string | true | false | null | undefined |
 *             identifier | ( expr )
 */
import type { StateRecord } from "../types";
/**
 * Evaluate an expression string against a state object.
 *
 * Cached by string. Simple dot-paths take a fast path that skips tokenizing.
 * Parse errors warn once and thereafter resolve to `undefined`; runtime
 * errors (e.g. calling a non-function) warn once per expression.
 *
 * @example
 * evalExpr('count > 0', { count: 5 })                 // → true
 * evalExpr('user.name', { user: { name: 'Alice' } })  // → 'Alice'
 * evalExpr('price * qty', { price: 9.99, qty: 3 })     // → 29.97
 */
export declare function evalExpr(expr: string, state: StateRecord): unknown;
/** @internal Consistent warning prefix. */
export declare function warn(msg: string): void;
