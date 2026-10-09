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

// ── Whitelisted globals ─────────────────────────────────────────────────────
const ALLOWED_GLOBALS = new Set<string>(
  "Math,JSON,Date,String,Number,Boolean,Array,Object,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined".split(
    ",",
  ),
);

// Property names that would let an expression climb back to the Function
// constructor / prototype. Blocked on every member access.
const BLOCKED_PROPS = new Set<string>([
  "__proto__",
  "constructor",
  "prototype",
]);

/** @internal Names that live on Object.prototype (constructor, toString, …). */
const OBJ_PROTO_KEYS = new Set<string>(
  Object.getOwnPropertyNames(Object.prototype),
);

// ── Compiled form ─────────────────────────────────────────────────────────────
// An expression compiles once into a closure tree: each grammar node becomes a
// `(scope) => value` function, so evaluation is a plain call — no AST walk.
// A member-read closure also carries its object + property (`o`, `p`) so a
// call through it — `obj.p()`, `(obj.p)()` — can bind `this`.
type Fn = ((scope: StateRecord) => unknown) & { o?: Fn; p?: string };

// ── Tokenizer ────────────────────────────────────────────────────────────────
// One match per token: number | identifier | string | punctuator. Any other
// non-space char matches the bare `\S` (group 1 empty) and is a syntax error.
// Tokens stay raw strings — the first char tells the kind (strings keep quotes).
const TOKEN =
  /([0-9][0-9.]*|[A-Za-z_$][\w$]*|'(?:\\[^]|[^\\'])*'|"(?:\\[^]|[^\\"])*"|===|!==|[=!<>]=|&&|\|\||[-().,?:!<>+*/%])|\S/g;
const IDENT = /^[A-Za-z_$]/;

// ── Operators ─────────────────────────────────────────────────────────────────
// Binary operators: [binding power (low→high), fn]. `r` is a thunk so && / ||
// short-circuit (and return operand values, JS semantics); the rest force it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BinOp = [number, (l: any, r: () => any) => unknown];
const BIN_OPS = new Map<string | undefined, BinOp>([
  ["||", [1, (l, r) => l || r()]],
  ["&&", [2, (l, r) => l && r()]],
  ["==", [3, (l, r) => l == r()]],
  ["!=", [3, (l, r) => l != r()]],
  ["===", [3, (l, r) => l === r()]],
  ["!==", [3, (l, r) => l !== r()]],
  ["<", [4, (l, r) => l < r()]],
  ["<=", [4, (l, r) => l <= r()]],
  [">", [4, (l, r) => l > r()]],
  [">=", [4, (l, r) => l >= r()]],
  ["+", [5, (l, r) => l + r()]],
  ["-", [5, (l, r) => l - r()]],
  ["*", [6, (l, r) => l * r()]],
  ["/", [6, (l, r) => l / r()]],
  ["%", [6, (l, r) => l % r()]],
]);

// ── Identifier / member resolution ───────────────────────────────────────────

/**
 * Return true iff `key` is reachable on `state` without walking into
 * `Object.prototype`. Blocks `'constructor' in state` from leaking the
 * prototype while still allowing user-defined keys that happen to share a
 * built-in name.
 */
function safeStateHas(state: object, key: string): boolean {
  if (!Reflect.has(state, key)) return false;
  if (!OBJ_PROTO_KEYS.has(key)) return true;
  let obj: object | null = state;
  while (obj && obj !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return true;
    obj = Object.getPrototypeOf(obj) as object | null;
  }
  return false;
}

function resolveIdent(name: string, scope: StateRecord): unknown {
  if (safeStateHas(scope, name)) return scope[name];
  if (ALLOWED_GLOBALS.has(name))
    return (globalThis as Record<string, unknown>)[name];
  return undefined;
}

/** Guarded member read: null-safe, and refuses BLOCKED_PROPS. */
const member = (o: unknown, p: string): unknown =>
  o == null || BLOCKED_PROPS.has(p)
    ? undefined
    : (o as Record<string, unknown>)[p];

// ── Parser (Pratt) → closures ────────────────────────────────────────────────

type Compiled = { f: Fn; deps: Set<string> | null; warned?: 1 };

/**
 * Parse `src` straight into a closure tree, collecting the root identifiers it
 * reads. `deps` is null — "depends on everything" — if the expression contains
 * a call: a method or global call is opaque (it may read any state), so the
 * renderer must never skip it on a partial re-render. Throws on syntax errors.
 */
function parse(src: string): Compiled {
  const toks = [...src.matchAll(TOKEN)].map((m) => {
    if (!m[1]) throw 0; // unknown char / unterminated string
    return m[1];
  });
  const deps = new Set<string>();
  let opaque = false;
  let pos = 0;
  const peek = () => toks[pos];
  const next = (expect?: string) => {
    if (expect && toks[pos] !== expect) throw 0;
    return toks[pos++];
  };

  function parseExpr(): Fn {
    const c = parseBin(1);
    if (peek() !== "?") return c;
    next();
    const a = parseExpr();
    next(":");
    const b = parseExpr();
    return (s) => (c(s) ? a : b)(s);
  }

  function parseBin(minPrec: number): Fn {
    let left = parseUnary();
    for (let op; (op = BIN_OPS.get(peek())) && op[0] >= minPrec; ) {
      next();
      const l = left,
        r = parseBin(op[0] + 1),
        f = op[1];
      left = (s) => f(l(s), () => r(s));
    }
    return left;
  }

  function parseUnary(): Fn {
    const t = peek();
    if (t !== "!" && t !== "-") return parsePostfix();
    next();
    const x = parseUnary();
    return t === "!" ? (s) => !x(s) : (s) => -(x(s) as number);
  }

  function parsePostfix(): Fn {
    let node = parsePrimary();
    for (let t; (t = peek()) === "." || t === "("; ) {
      next();
      const o = node;
      if (t === ".") {
        const p = next();
        if (!p || !IDENT.test(p)) throw 0;
        node = Object.assign((s: StateRecord) => member(o(s), p), { o, p });
      } else {
        opaque = true;
        const args: Fn[] = [];
        if (peek() !== ")")
          do args.push(parseExpr());
          while (peek() === "," && next());
        next(")");
        // member call binds `this` to the object (item.fmt(), Math.round(x));
        // bare call leaves `this` undefined (instance methods are pre-bound).
        const { o: self, p } = o;
        node = (s) => {
          const that = self && self(s);
          const fn = self ? member(that, p!) : o(s);
          if (typeof fn !== "function") throw new TypeError("not a function");
          return fn.apply(that, args.map((a) => a(s)));
        };
      }
    }
    return node;
  }

  function parsePrimary(): Fn {
    const t = next();
    if (!t) throw 0;
    if (t === "(") {
      const e = parseExpr();
      next(")");
      return e;
    }
    let v: unknown;
    if (/^[0-9]/.test(t)) v = Number(t);
    else if (t[0] === "'" || t[0] === '"')
      v = t.slice(1, -1).replace(/\\([^])/g, "$1");
    // `undefined` needs no keyword: it resolves via ALLOWED_GLOBALS.
    else if (/^(true|false|null)$/.test(t)) v = JSON.parse(t);
    else if (IDENT.test(t)) {
      deps.add(t);
      return (s) => resolveIdent(t, s);
    } else throw 0;
    return () => v;
  }

  const f = parseExpr();
  if (pos !== toks.length) throw 0; // trailing garbage
  return { f, deps: opaque ? null : deps };
}

// ── Cache + public API ──────────────────────────────────────────────────────

const exprCache = new Map<string, Compiled>();

/** Compile (and cache) an expression. Syntax errors warn once → undefined. */
function compile(expr: string): Compiled {
  let cached = exprCache.get(expr);
  if (!cached) {
    try {
      cached = parse(expr);
    } catch {
      warn(`invalid expression "${expr}"`);
      cached = { f: () => undefined, deps: null };
    }
    exprCache.set(expr, cached);
  }
  return cached;
}

/**
 * The set of top-level state keys an expression reads, or `null` when that
 * can't be determined statically (it contains a call). The renderer uses this
 * to skip directives whose dependencies didn't change in the current cycle.
 */
export function exprDeps(expr: string): Set<string> | null {
  return compile(expr).deps;
}

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
export function evalExpr(expr: string, state: StateRecord): unknown {
  const cached = compile(expr);
  try {
    return cached.f(state);
  } catch (e) {
    if (!cached.warned) {
      cached.warned = 1;
      warn(`runtime error in "${expr}": ${(e as Error).message}`);
    }
    return undefined;
  }
}

/**
 * @internal Split a `name:expr, …` list on top-level commas only — a comma
 * inside (), [], {} or quotes belongs to the expression: `cls(a, b)`,
 * `go('a,b')`. Shared by data-bind / data-class / data-on.
 */
export function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0,
    q = "",
    start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (q) {
      if (c === "\\") i++;
      else if (c === q) q = "";
    } else if (c === "'" || c === '"') q = c;
    else if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) depth--;
    else if (c === "," && !depth) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out;
}

// ── Dev warnings ──────────────────────────────────────────────────────────────

/** @internal Consistent warning prefix. */
export function warn(msg: string): void {
  console.warn(`[Micra] ${msg}`);
}
