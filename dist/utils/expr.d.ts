/**
 * src/utils/expr.ts — CSP-safe JS-expression evaluator.
 *
 * Directive expressions (`data-text="count > 0"`, `data-class="x:a === b"`, …)
 * are parsed once into a tree of small closures and cached; evaluating is a
 * plain call. There is NO `new Function` / `eval` anywhere — so Micra runs
 * under a strict Content-Security-Policy (`default-src 'self'`, no `unsafe-eval`).
 *
 * LLM NOTE: This module is PURE. It does not touch the DOM or mutate state.
 *
 * Security model:
 *   An expression can only reach: top-level state keys, component methods,
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
 *   primary = number | string | true | false | null | identifier | ( expr )
 *   (`undefined`, `NaN`, `Infinity` resolve as whitelisted globals)
 */
import type { StateRecord } from "../types";
/**
 * The set of top-level state keys an expression reads, or `null` when that
 * can't be determined statically (it contains a call). The renderer uses this
 * to skip directives whose dependencies didn't change in the current cycle.
 */
export declare function exprDeps(expr: string): Set<string> | null;
/**
 * Evaluate an expression string against a state object.
 *
 * Cached by string. Parse errors warn once and thereafter resolve to
 * `undefined`; runtime errors (e.g. calling a non-function) warn once per
 * expression.
 *
 * @example
 * evalExpr('count > 0', { count: 5 })                 // → true
 * evalExpr('user.name', { user: { name: 'Alice' } })  // → 'Alice'
 * evalExpr('price * qty', { price: 9.99, qty: 3 })     // → 29.97
 */
export declare function evalExpr(expr: string, state: StateRecord): unknown;
/**
 * @internal Split a `name:expr, …` list on top-level commas only — a comma
 * inside (), [], {} or quotes belongs to the expression: `cls(a, b)`,
 * `go('a,b')`. Shared by data-bind / data-class / data-on.
 */
export declare function splitTop(s: string): string[];
/** @internal Consistent warning prefix. */
export declare function warn(msg: string): void;
