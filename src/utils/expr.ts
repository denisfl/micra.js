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

import type { StateRecord } from '../types'

// ── Expression cache ──────────────────────────────────────────────────────────
// Compiled functions are keyed by expression string — Function() is only called
// once per unique expression across the entire app lifetime.

// LLM NOTE: exprCache is module-level (shared across all components).
// This is intentional — most apps reuse the same expressions.
type Compiled = (state: object, safe: object) => unknown
const exprCache = new Map<string, Compiled>()
// Expressions whose runtime error we have already warned about. Prevents log spam
// when the same `data-text="item.naame"` typo fires every render.
const warnedRuntime = new Set<string>()

// Simple identifier or dot-path: "count", "user.name", "item.email"
// Matches: letter/$/_ followed by word chars, optionally with .property chains
const SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/

// ── Safe scope ────────────────────────────────────────────────────────────────

/**
 * Globals reachable from directive expressions. Anything else (window, fetch,
 * constructor, eval, ...) is shadowed by SAFE_OUTER and resolves to undefined.
 */
const ALLOWED_GLOBALS = new Set<string>([
  'Math', 'JSON', 'Date', 'String', 'Number', 'Boolean', 'Array', 'Object',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'NaN', 'Infinity', 'undefined',
])

/**
 * Outer `with()` scope. Its `has` trap claims every non-whitelisted identifier
 * is "in scope" so the JS engine resolves the read on this Proxy (which returns
 * undefined) instead of walking up to the global object. Whitelisted names fall
 * through to globalThis.
 */
// Sentinel parameter names used by the compiled function. SAFE_OUTER must NOT
// shadow them, or `with($s)` would resolve to `undefined` via SAFE_OUTER.
const PARAM_S = '$s'
const PARAM_SAFE = '$safe'

const SAFE_OUTER: object = new Proxy(Object.create(null) as object, {
  has(_target, key): boolean {
    if (typeof key !== 'string') return false
    if (key === PARAM_S || key === PARAM_SAFE) return false
    return !ALLOWED_GLOBALS.has(key)
  },
  get(): undefined {
    return undefined
  },
})

/**
 * @internal Per-state safe wrappers — one per source state object. WeakMap so
 * short-lived itemStates get GC'd with their wrappers.
 */
const safeWrapCache = new WeakMap<object, object>()

/**
 * @internal Pre-computed names that live on `Object.prototype`
 * (constructor, toString, hasOwnProperty, ...). Used by safeStateHas to detect
 * built-in keys without re-walking the chain on every call.
 */
const OBJ_PROTO_KEYS = new Set<string>(Object.getOwnPropertyNames(Object.prototype))

/**
 * Wrap a state object so its `has` trap reports only "real" keys — own
 * properties or keys reachable up to (but not including) `Object.prototype`.
 * This blocks `'constructor' in state` from leaking the prototype.
 */
function safeStateWrap(state: object): object {
  const cached = safeWrapCache.get(state)
  if (cached) return cached
  const wrapped = new Proxy(state, {
    has(target, key) {
      return safeStateHas(target, key)
    },
    get(target, key) {
      return Reflect.get(target, key)
    },
  })
  safeWrapCache.set(state, wrapped)
  return wrapped
}

/**
 * Return true iff `key` is reachable on `state` without walking into
 * `Object.prototype`. Works for plain objects, prototype-chained objects, and
 * Proxies with their own `has` trap.
 */
function safeStateHas(state: object, key: PropertyKey): boolean {
  if (typeof key !== 'string') return false
  if (!Reflect.has(state, key)) return false
  // Identifiers that are NOT on Object.prototype are always safe — accept them
  // immediately without walking the chain.
  if (!OBJ_PROTO_KEYS.has(key)) return true
  // Built-in Object.prototype names (constructor, toString, hasOwnProperty, ...)
  // are only accepted when they have been explicitly placed on the state chain.
  let obj: object | null = state
  while (obj && obj !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return true
    obj = Object.getPrototypeOf(obj) as object | null
  }
  return false
}

// ── evalExpr ──────────────────────────────────────────────────────────────────

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
  // Fast-path: simple property access — no Function() needed.
  // Still guarded so bare access to Object.prototype names returns undefined.
  if (SIMPLE_PATH.test(expr)) {
    const parts = expr.split('.')
    if (!safeStateHas(state, parts[0]!)) return undefined
    return parts.reduce<unknown>((obj, key) =>
      obj != null ? (obj as StateRecord)[key] : undefined,
      state,
    )
  }

  if (!exprCache.has(expr)) {
    try {
      // Two with() statements: $s wins for state keys; $safe shadows globals.
      exprCache.set(
        expr,
        new Function('$s', '$safe', `with($safe){with($s){return (${expr})}}`) as Compiled,
      )
    } catch {
      warn(`invalid expression "${expr}"`)
      exprCache.set(expr, () => undefined)
    }
  }

  try {
    return exprCache.get(expr)!(safeStateWrap(state), SAFE_OUTER)
  } catch (e) {
    if (!warnedRuntime.has(expr)) {
      warnedRuntime.add(expr)
      warn(`runtime error in "${expr}": ${(e as Error).message}`)
    }
    return undefined
  }
}

// ── Dev warnings ──────────────────────────────────────────────────────────────

/** @internal Consistent warning prefix. */
export function warn(msg: string): void {
  console.warn(`[Micra] ${msg}`)
}
