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

// ── AST ─────────────────────────────────────────────────────────────────────
// Compact node shapes; `k` is the kind tag.
type Node =
  | { k: "lit"; v: unknown }
  | { k: "id"; n: string }
  | { k: "mem"; o: Node; p: string }
  | { k: "call"; c: Node; a: Node[] }
  | { k: "un"; op: string; x: Node }
  | { k: "bin"; op: string; l: Node; r: Node }
  | { k: "tern"; c: Node; a: Node; b: Node };

// ── Tokenizer ────────────────────────────────────────────────────────────────
type Tok = { t: "num" | "str" | "id" | "p"; v: string };

const PUNCT = [
  "===",
  "!==",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "(",
  ")",
  ".",
  ",",
  "?",
  ":",
  "!",
  "<",
  ">",
  "+",
  "-",
  "*",
  "/",
  "%",
];

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r" || c === "\f") {
      i++;
      continue;
    }
    // string
    if (c === '"' || c === "'") {
      let s = "";
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === "\\") {
          s += src[i + 1] ?? "";
          i += 2;
        } else {
          s += src[i];
          i++;
        }
      }
      if (src[i] !== c) throw 0; // unterminated
      i++;
      toks.push({ t: "str", v: s });
      continue;
    }
    // number
    if (c >= "0" && c <= "9") {
      let s = "";
      while (i < n && ((src[i]! >= "0" && src[i]! <= "9") || src[i] === ".")) {
        s += src[i];
        i++;
      }
      toks.push({ t: "num", v: s });
      continue;
    }
    // identifier
    if (/[A-Za-z_$]/.test(c)) {
      let s = "";
      while (i < n && /[A-Za-z0-9_$]/.test(src[i]!)) {
        s += src[i];
        i++;
      }
      toks.push({ t: "id", v: s });
      continue;
    }
    // punctuator (longest match first)
    const m = PUNCT.find((p) => src.startsWith(p, i));
    if (!m) throw 0; // unknown char
    toks.push({ t: "p", v: m });
    i += m.length;
  }
  return toks;
}

// ── Parser (Pratt) ────────────────────────────────────────────────────────────
const BIN_PREC: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "===": 3,
  "!==": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
};

function parse(toks: Tok[]): Node {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const eat = (v: string) => {
    if (peek()?.v !== v) throw 0;
    pos++;
  };

  function parseExpr(): Node {
    const c = parseBin(1);
    if (peek()?.v === "?") {
      next();
      const a = parseExpr();
      eat(":");
      const b = parseExpr();
      return { k: "tern", c, a, b };
    }
    return c;
  }

  function parseBin(minPrec: number): Node {
    let left = parseUnary();
    for (;;) {
      const t = peek();
      const prec = t && t.t === "p" ? BIN_PREC[t.v] : undefined;
      if (prec === undefined || prec < minPrec) break;
      next();
      const right = parseBin(prec + 1);
      left = { k: "bin", op: t!.v, l: left, r: right };
    }
    return left;
  }

  function parseUnary(): Node {
    const t = peek();
    if (t && t.t === "p" && (t.v === "!" || t.v === "-")) {
      next();
      return { k: "un", op: t.v, x: parseUnary() };
    }
    return parsePostfix();
  }

  function parsePostfix(): Node {
    let node = parsePrimary();
    for (;;) {
      const t = peek();
      if (t?.v === ".") {
        next();
        const id = next();
        if (!id || id.t !== "id") throw 0;
        node = { k: "mem", o: node, p: id.v };
      } else if (t?.v === "(") {
        next();
        const args: Node[] = [];
        if (peek()?.v !== ")") {
          args.push(parseExpr());
          while (peek()?.v === ",") {
            next();
            args.push(parseExpr());
          }
        }
        eat(")");
        node = { k: "call", c: node, a: args };
      } else break;
    }
    return node;
  }

  function parsePrimary(): Node {
    const t = next();
    if (!t) throw 0;
    if (t.t === "num") return { k: "lit", v: Number(t.v) };
    if (t.t === "str") return { k: "lit", v: t.v };
    if (t.v === "(") {
      const e = parseExpr();
      eat(")");
      return e;
    }
    if (t.t === "id") {
      if (t.v === "true") return { k: "lit", v: true };
      if (t.v === "false") return { k: "lit", v: false };
      if (t.v === "null") return { k: "lit", v: null };
      if (t.v === "undefined") return { k: "lit", v: undefined };
      return { k: "id", n: t.v };
    }
    throw 0;
  }

  const ast = parseExpr();
  if (pos !== toks.length) throw 0; // trailing garbage
  return ast;
}

// ── Identifier resolution ─────────────────────────────────────────────────────

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

// ── Interpreter ────────────────────────────────────────────────────────────────

function evalNode(node: Node, scope: StateRecord): unknown {
  switch (node.k) {
    case "lit":
      return node.v;
    case "id":
      return resolveIdent(node.n, scope);
    case "mem": {
      const o = evalNode(node.o, scope);
      if (o == null || BLOCKED_PROPS.has(node.p)) return undefined;
      return (o as Record<string, unknown>)[node.p];
    }
    case "un": {
      const x = evalNode(node.x, scope);
      return node.op === "!" ? !x : -(x as number);
    }
    case "tern":
      return evalNode(node.c, scope)
        ? evalNode(node.a, scope)
        : evalNode(node.b, scope);
    case "bin": {
      const op = node.op;
      // short-circuit logicals (return operand value, JS semantics)
      if (op === "&&") {
        const l = evalNode(node.l, scope);
        return l ? evalNode(node.r, scope) : l;
      }
      if (op === "||") {
        const l = evalNode(node.l, scope);
        return l ? l : evalNode(node.r, scope);
      }
      const l = evalNode(node.l, scope) as never;
      const r = evalNode(node.r, scope) as never;
      switch (op) {
        case "+":
          return (l as number) + (r as number);
        case "-":
          return (l as number) - (r as number);
        case "*":
          return (l as number) * (r as number);
        case "/":
          return (l as number) / (r as number);
        case "%":
          return (l as number) % (r as number);
        case "<":
          return l < r;
        case "<=":
          return l <= r;
        case ">":
          return l > r;
        case ">=":
          return l >= r;
        case "==":
          return l == r;
        case "!=":
          return l != r;
        case "===":
          return l === r;
        case "!==":
          return l !== r;
      }
      return undefined;
    }
    case "call": {
      // member call binds `this` to the object (item.fmt(), Math.round(x));
      // bare call leaves `this` undefined (instance methods are pre-bound).
      let fn: unknown;
      let self: unknown;
      if (node.c.k === "mem") {
        self = evalNode(node.c.o, scope);
        fn =
          self == null || BLOCKED_PROPS.has(node.c.p)
            ? undefined
            : (self as Record<string, unknown>)[node.c.p];
      } else {
        fn = evalNode(node.c, scope);
      }
      if (typeof fn !== "function") throw new TypeError("not a function");
      return (fn as (...a: unknown[]) => unknown).apply(
        self,
        node.a.map((x) => evalNode(x, scope)),
      );
    }
  }
}

// ── Cache + public API ──────────────────────────────────────────────────────

type CachedEntry =
  | { kind: "path"; parts: string[]; deps: Set<string> }
  | { kind: "ast"; ast: Node; deps: Set<string> | null }
  | { kind: "err"; deps: null };

const exprCache = new Map<string, CachedEntry>();
const warnedRuntime = new Set<string>();

// Simple identifier or dot-path: "count", "user.name", "item.email".
const SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;

/**
 * Collect the root identifiers an AST reads into `set`. Returns false —
 * "depends on everything" — if the expression contains a call: a method or
 * global call is opaque (it may read any state), so the renderer must never
 * skip it on a partial re-render.
 */
function collectDeps(node: Node, set: Set<string>): boolean {
  switch (node.k) {
    case "lit":
      return true;
    case "id":
      set.add(node.n);
      return true;
    case "mem":
      return collectDeps(node.o, set);
    case "un":
      return collectDeps(node.x, set);
    case "tern":
      return (
        collectDeps(node.c, set) &&
        collectDeps(node.a, set) &&
        collectDeps(node.b, set)
      );
    case "bin":
      return collectDeps(node.l, set) && collectDeps(node.r, set);
    case "call":
      return false; // opaque — treat as depending on everything
  }
}

/** Compile (and cache) an expression into its evaluable form + dep set. */
function compile(expr: string): CachedEntry {
  let cached = exprCache.get(expr);
  if (cached) return cached;

  const parts = SIMPLE_PATH.test(expr) ? expr.split(".") : null;
  if (parts && !parts.some((p) => BLOCKED_PROPS.has(p))) {
    cached = { kind: "path", parts, deps: new Set([parts[0]!]) };
  } else {
    try {
      const ast = parse(tokenize(expr));
      const set = new Set<string>();
      cached = { kind: "ast", ast, deps: collectDeps(ast, set) ? set : null };
    } catch {
      warn(`invalid expression "${expr}"`);
      cached = { kind: "err", deps: null };
    }
  }
  exprCache.set(expr, cached);
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
 * Cached by string. Simple dot-paths take a fast path that skips tokenizing.
 * Parse errors warn once and thereafter resolve to `undefined`; runtime
 * errors (e.g. calling a non-function) warn once per expression.
 *
 * @example
 * evalExpr('count > 0', { count: 5 })                 // → true
 * evalExpr('user.name', { user: { name: 'Alice' } })  // → 'Alice'
 * evalExpr('price * qty', { price: 9.99, qty: 3 })     // → 29.97
 */
export function evalExpr(expr: string, state: StateRecord): unknown {
  const cached = compile(expr);

  if (cached.kind === "path") {
    const parts = cached.parts;
    if (!safeStateHas(state, parts[0]!)) return undefined;
    let obj: unknown = state;
    for (const key of parts)
      obj = obj != null ? (obj as StateRecord)[key] : undefined;
    return obj;
  }

  if (cached.kind === "err") return undefined;

  try {
    return evalNode(cached.ast, state);
  } catch (e) {
    if (!warnedRuntime.has(expr)) {
      warnedRuntime.add(expr);
      warn(`runtime error in "${expr}": ${(e as Error).message}`);
    }
    return undefined;
  }
}

// ── Dev warnings ──────────────────────────────────────────────────────────────

/** @internal Consistent warning prefix. */
export function warn(msg: string): void {
  console.warn(`[Micra] ${msg}`);
}
