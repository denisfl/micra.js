/* Micra.js v2.7.1 — https://github.com/denisfl/micra.js — MIT */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  FetchError: () => FetchError,
  autoCleanup: () => autoCleanup,
  config: () => config,
  debug: () => debug,
  define: () => define,
  defineComponent: () => defineComponent,
  destroy: () => destroy,
  emit: () => emit,
  instances: () => instances,
  mount: () => mount,
  off: () => off,
  on: () => on,
  registry: () => registry,
  start: () => start
});
module.exports = __toCommonJS(index_exports);

// src/utils/fetch.ts
function getCSRF() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") ?? null;
}
function sameOrigin(url) {
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return true;
  }
}
var FetchError = class extends Error {
  constructor(message, status, response) {
    super(message);
    this.status = status;
    this.response = response;
    this.name = "FetchError";
  }
};
async function micraFetch(url, options = {}) {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = {
    Accept: "application/json",
    ...options.headers
  };
  const csrf = getCSRF();
  if (csrf && sameOrigin(url)) headers["X-CSRF-Token"] = csrf;
  let finalUrl = url;
  let body;
  if (method === "GET" || method === "HEAD") {
    const params = {};
    for (const [k, v] of Object.entries(options)) {
      if (k !== "method" && k !== "headers" && k !== "signal" && v != null)
        params[k] = String(v);
    }
    if (Object.keys(params).length)
      finalUrl += (url.includes("?") ? "&" : "?") + new URLSearchParams(params);
  } else if (options.body !== void 0) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const res = await fetch(finalUrl, {
    method,
    headers,
    ...options.signal !== void 0 ? { signal: options.signal } : {},
    ...body !== void 0 ? { body } : {}
  });
  if (!res.ok)
    throw new FetchError(`[Micra] fetch: ${method} ${url} \u2192 ${res.status}`, res.status, res);
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// src/core/registry.ts
var _registry = /* @__PURE__ */ new Map();
var _instances = /* @__PURE__ */ new Map();
function define(name, definition) {
  _registry.set(name, definition);
}
function defineComponent(definition) {
  return definition;
}
function instances() {
  return _instances;
}
function registry() {
  return _registry;
}
function debug() {
  if (_instances.size === 0) {
    console.log("[Micra] No live components.");
    return;
  }
  console.group(`[Micra] ${_instances.size} live component(s)`);
  for (const [el, instance] of _instances) {
    const name = el.getAttribute("data-component") ?? "(unnamed)";
    console.group(`%c${name}`, "font-weight:bold;color:#6366f1");
    console.log("$el  ", el);
    console.log("state", { ...instance.state });
    console.groupEnd();
  }
  console.groupEnd();
}

// src/utils/expr.ts
var ALLOWED_GLOBALS = new Set(
  "Math,JSON,Date,String,Number,Boolean,Array,Object,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined".split(
    ","
  )
);
var BLOCKED_PROPS = /* @__PURE__ */ new Set([
  "__proto__",
  "constructor",
  "prototype"
]);
var OBJ_PROTO_KEYS = new Set(
  Object.getOwnPropertyNames(Object.prototype)
);
var PUNCT = [
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
  "%"
];
function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "	" || c === "\n" || c === "\r" || c === "\f") {
      i++;
      continue;
    }
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
      if (src[i] !== c) throw 0;
      i++;
      toks.push({ t: "str", v: s });
      continue;
    }
    if (c >= "0" && c <= "9") {
      let s = "";
      while (i < n && (src[i] >= "0" && src[i] <= "9" || src[i] === ".")) {
        s += src[i];
        i++;
      }
      toks.push({ t: "num", v: s });
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let s = "";
      while (i < n && /[A-Za-z0-9_$]/.test(src[i])) {
        s += src[i];
        i++;
      }
      toks.push({ t: "id", v: s });
      continue;
    }
    const m = PUNCT.find((p) => src.startsWith(p, i));
    if (!m) throw 0;
    toks.push({ t: "p", v: m });
    i += m.length;
  }
  return toks;
}
var BIN_PREC = {
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
  "%": 6
};
function parse(toks) {
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  const eat = (v) => {
    if (peek()?.v !== v) throw 0;
    pos++;
  };
  function parseExpr() {
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
  function parseBin(minPrec) {
    let left = parseUnary();
    for (; ; ) {
      const t = peek();
      const prec = t && t.t === "p" ? BIN_PREC[t.v] : void 0;
      if (prec === void 0 || prec < minPrec) break;
      next();
      const right = parseBin(prec + 1);
      left = { k: "bin", op: t.v, l: left, r: right };
    }
    return left;
  }
  function parseUnary() {
    const t = peek();
    if (t && t.t === "p" && (t.v === "!" || t.v === "-")) {
      next();
      return { k: "un", op: t.v, x: parseUnary() };
    }
    return parsePostfix();
  }
  function parsePostfix() {
    let node = parsePrimary();
    for (; ; ) {
      const t = peek();
      if (t?.v === ".") {
        next();
        const id = next();
        if (!id || id.t !== "id") throw 0;
        node = { k: "mem", o: node, p: id.v };
      } else if (t?.v === "(") {
        next();
        const args = [];
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
  function parsePrimary() {
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
      if (t.v === "undefined") return { k: "lit", v: void 0 };
      return { k: "id", n: t.v };
    }
    throw 0;
  }
  const ast = parseExpr();
  if (pos !== toks.length) throw 0;
  return ast;
}
function safeStateHas(state, key) {
  if (!Reflect.has(state, key)) return false;
  if (!OBJ_PROTO_KEYS.has(key)) return true;
  let obj = state;
  while (obj && obj !== Object.prototype) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return true;
    obj = Object.getPrototypeOf(obj);
  }
  return false;
}
function resolveIdent(name, scope) {
  if (safeStateHas(scope, name)) return scope[name];
  if (ALLOWED_GLOBALS.has(name))
    return globalThis[name];
  return void 0;
}
function evalNode(node, scope) {
  switch (node.k) {
    case "lit":
      return node.v;
    case "id":
      return resolveIdent(node.n, scope);
    case "mem": {
      const o = evalNode(node.o, scope);
      if (o == null || BLOCKED_PROPS.has(node.p)) return void 0;
      return o[node.p];
    }
    case "un": {
      const x = evalNode(node.x, scope);
      return node.op === "!" ? !x : -x;
    }
    case "tern":
      return evalNode(node.c, scope) ? evalNode(node.a, scope) : evalNode(node.b, scope);
    case "bin": {
      const op = node.op;
      if (op === "&&") {
        const l2 = evalNode(node.l, scope);
        return l2 ? evalNode(node.r, scope) : l2;
      }
      if (op === "||") {
        const l2 = evalNode(node.l, scope);
        return l2 ? l2 : evalNode(node.r, scope);
      }
      const l = evalNode(node.l, scope);
      const r = evalNode(node.r, scope);
      switch (op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
        case "%":
          return l % r;
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
      return void 0;
    }
    case "call": {
      let fn;
      let self;
      if (node.c.k === "mem") {
        self = evalNode(node.c.o, scope);
        fn = self == null || BLOCKED_PROPS.has(node.c.p) ? void 0 : self[node.c.p];
      } else {
        fn = evalNode(node.c, scope);
      }
      if (typeof fn !== "function") throw new TypeError("not a function");
      return fn.apply(
        self,
        node.a.map((x) => evalNode(x, scope))
      );
    }
  }
}
var exprCache = /* @__PURE__ */ new Map();
var warnedRuntime = /* @__PURE__ */ new Set();
var SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
function collectDeps(node, set) {
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
      return collectDeps(node.c, set) && collectDeps(node.a, set) && collectDeps(node.b, set);
    case "bin":
      return collectDeps(node.l, set) && collectDeps(node.r, set);
    case "call":
      return false;
  }
}
function compile(expr) {
  let cached = exprCache.get(expr);
  if (cached) return cached;
  const parts = SIMPLE_PATH.test(expr) ? expr.split(".") : null;
  if (parts && !parts.some((p) => BLOCKED_PROPS.has(p))) {
    cached = { kind: "path", parts, deps: /* @__PURE__ */ new Set([parts[0]]) };
  } else {
    try {
      const ast = parse(tokenize(expr));
      const set = /* @__PURE__ */ new Set();
      cached = { kind: "ast", ast, deps: collectDeps(ast, set) ? set : null };
    } catch {
      warn(`invalid expression "${expr}"`);
      cached = { kind: "err", deps: null };
    }
  }
  exprCache.set(expr, cached);
  return cached;
}
function exprDeps(expr) {
  return compile(expr).deps;
}
function evalExpr(expr, state) {
  const cached = compile(expr);
  if (cached.kind === "path") {
    const parts = cached.parts;
    if (!safeStateHas(state, parts[0])) return void 0;
    let obj = state;
    for (const key of parts)
      obj = obj != null ? obj[key] : void 0;
    return obj;
  }
  if (cached.kind === "err") return void 0;
  try {
    return evalNode(cached.ast, state);
  } catch (e) {
    if (!warnedRuntime.has(expr)) {
      warnedRuntime.add(expr);
      warn(`runtime error in "${expr}": ${e.message}`);
    }
    return void 0;
  }
}
function warn(msg) {
  console.warn(`[Micra] ${msg}`);
}

// src/core/bus.ts
var _bus = /* @__PURE__ */ new Map();
function on(event, handler) {
  if (!_bus.has(event)) _bus.set(event, /* @__PURE__ */ new Set());
  _bus.get(event).add(handler);
  return () => off(event, handler);
}
function off(event, handler) {
  const set = _bus.get(event);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) _bus.delete(event);
}
function emit(event, ...args) {
  const payload = args[0];
  _bus.get(event)?.forEach((h) => {
    try {
      h(payload);
    } catch (e) {
      console.error(`[Micra] bus error [${event}]:`, e);
    }
  });
}

// src/core/reactive.ts
function createReactiveState(obj, schedule, onKey) {
  return new Proxy(obj, {
    set(target, key, value) {
      ;
      target[key] = value;
      onKey?.(key);
      schedule();
      return true;
    },
    deleteProperty(target, key) {
      delete target[key];
      onKey?.(key);
      schedule();
      return true;
    }
  });
}
function setPath(state, path, value) {
  const parts = path.split(".");
  const top = parts[0];
  if (parts.length === 1) {
    state[top] = value;
    return;
  }
  const copy = (v) => Array.isArray(v) ? [...v] : { ...v };
  const root = copy(state[top]);
  let cur = root;
  for (let i = 1; i < parts.length - 1; i++) {
    cur = cur[parts[i]] = copy(cur[parts[i]]);
  }
  cur[parts[parts.length - 1]] = value;
  state[top] = root;
}
function createScheduler(render) {
  let pending = false;
  const flush = () => {
    pending = false;
    render();
  };
  return function schedule() {
    if (pending) return;
    pending = true;
    queueMicrotask(flush);
  };
}

// src/core/config.ts
var _config = {};
function config(opts) {
  Object.assign(_config, opts);
}

// src/dom/directives.ts
function applyText(el, expr, state) {
  const text = String(evalExpr(expr, state) ?? "");
  if (el.textContent !== text) el.textContent = text;
}
function applyHtml(el, expr, state) {
  const raw = String(evalExpr(expr, state) ?? "");
  const html = _config.sanitize ? _config.sanitize(raw) : raw;
  const m = el;
  if (m.__micraHtml === html) return;
  m.__micraHtml = html;
  el.innerHTML = html;
}
function applyIf(binding, state) {
  const el = binding.el;
  const truthy = !!evalExpr(binding.expr, state);
  if (truthy) {
    const ph = binding.placeholder;
    if (ph && ph.parentNode) ph.parentNode.replaceChild(el, ph);
    delete el.__micraIfDetached;
  } else {
    const parent = el.parentNode;
    if (parent) {
      if (!binding.placeholder)
        binding.placeholder = document.createComment("if");
      el.__micraIfDetached = true;
      parent.replaceChild(binding.placeholder, el);
    }
  }
}
function applyShow(el, expr, state) {
  const desired = evalExpr(expr, state) ? "" : "none";
  const htmlEl = el;
  if (htmlEl.style.display !== desired) htmlEl.style.display = desired;
}
function applyBind(el, pairs, state) {
  for (const [attr, valExpr] of pairs) {
    const val = evalExpr(valExpr, state);
    if (/^on[a-z]+$/.test(attr)) {
      warn(`data-bind refused event-handler attribute "${attr}" \u2014 use @${attr.slice(2)}`);
      continue;
    }
    if (attr === "class") {
      el.className = String(val ?? "");
    } else if (attr === "checked") {
      el.checked = Boolean(val) && val !== "false";
    } else if (attr === "value") {
      if (document.activeElement !== el)
        el.value = String(val ?? "");
    } else if (attr === "style") {
      if (typeof val === "object" && val !== null) {
        Object.assign(el.style, val);
      } else {
        el.setAttribute("style", String(val ?? ""));
      }
    } else if (typeof val === "boolean") {
      val ? el.setAttribute(attr, "") : el.removeAttribute(attr);
    } else if (val == null) {
      el.removeAttribute(attr);
    } else if (/^javascript:/i.test(String(val).replace(/[\u0000-\u0020]/g, ""))) {
      warn(`data-bind dropped unsafe javascript: URL from "${attr}"`);
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, String(val));
    }
  }
}
function applyClass(el, pairs, state) {
  for (const [cls, valExpr] of pairs) {
    el.classList.toggle(cls, Boolean(evalExpr(valExpr, state)));
  }
}
function applyModel(el, key, rawState) {
  const html = el;
  const stateVal = evalExpr(key, rawState);
  if (html.type === "checkbox" || html.type === "radio") {
    const want = html.type === "checkbox" ? Boolean(stateVal) : html.value === (stateVal == null ? "" : String(stateVal));
    if (html.checked !== want) html.checked = want;
    return;
  }
  const desired = stateVal == null ? "" : String(stateVal);
  if (html.value !== desired) html.value = desired;
}
function applyDirectives(scan, state, rawState, dirty = null) {
  for (const b of scan.if) if (fresh(b.deps, dirty)) applyIf(b, state);
  for (const b of scan.text) if (fresh(b.deps, dirty)) applyText(b.el, b.expr, state);
  for (const b of scan.html) if (fresh(b.deps, dirty)) applyHtml(b.el, b.expr, state);
  for (const b of scan.show) if (fresh(b.deps, dirty)) applyShow(b.el, b.expr, state);
  for (const b of scan.bind) if (fresh(b.deps, dirty)) applyBind(b.el, b.pairs, state);
  for (const b of scan.model) if (fresh(b.deps, dirty)) applyModel(b.el, b.expr.trim(), rawState);
  for (const b of scan.class) if (fresh(b.deps, dirty)) applyClass(b.el, b.pairs, state);
}
function fresh(deps, dirty) {
  if (dirty === null || deps == null) return true;
  for (const k of dirty) if (deps.has(k)) return true;
  return false;
}
function validateDirectives(scan) {
  for (const el of scan.each) {
    const tmpl = el;
    if (!el.hasAttribute("data-key") && !tmpl.__micraNoKeyWarned) {
      tmpl.__micraNoKeyWarned = true;
      warn(
        `data-each="${el.getAttribute("data-each")}" has no data-key \u2014 keyed diff disabled. Add data-key="id" for better performance.`
      );
    }
    if (el.hasAttribute("data-if")) {
      warn(`data-if on a data-each template is ignored \u2014 put it on a wrapper element`);
    }
  }
  for (const b of scan.bind) {
    const hasClassBind = b.pairs.some((p) => p[0] === "class");
    if (hasClassBind && b.el.hasAttribute("data-class")) {
      warn(
        `element has both data-bind="class:..." and data-class \u2014 they fight on every render. Use one.`
      );
    }
  }
}

// src/dom/events.ts
function track(instance, el, type, fn) {
  el.addEventListener(type, fn);
  (instance.__micraListeners ?? (instance.__micraListeners = [])).push({ el, type, fn });
}
var SYS_MOD = {
  ctrl: "ctrlKey",
  shift: "shiftKey",
  alt: "altKey",
  meta: "metaKey",
  cmd: "metaKey"
};
var KEY_MOD = {
  enter: "Enter",
  esc: "Escape",
  escape: "Escape",
  tab: "Tab",
  space: " ",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  delete: "Delete"
};
function applyModifiers(e, el, mods) {
  for (const m of mods) {
    if (m === "prevent") e.preventDefault();
    else if (m === "stop") e.stopPropagation();
    else if (m === "self") {
      if (e.target !== el) return false;
    } else if (SYS_MOD[m]) {
      if (!e[SYS_MOD[m]]) return false;
    } else {
      const key = e.key;
      if (key == null) return false;
      if (!(KEY_MOD[m] ? key === KEY_MOD[m] : key.toLowerCase() === m)) return false;
    }
  }
  return true;
}
function runHandler(instance, el, value, e) {
  if (value.includes("(")) {
    let base;
    for (let n = el; n && !base; n = n.parentElement) {
      base = n._itemState;
    }
    const scope = Object.create(base ?? instance.__micraExpr ?? null);
    scope["$event"] = e;
    scope["event"] = e;
    evalExpr(value, scope);
    return;
  }
  const fn = instance[value];
  if (typeof fn === "function") fn.call(instance, e);
  else warn(`method "${value}" not found`);
}
function bindDataOn(els, instance) {
  for (const el of els) {
    const mEl = el;
    if (mEl.__micraEvents) continue;
    mEl.__micraEvents = true;
    const spec = mEl.dataset["on"] ?? "";
    const parts = spec.split(/,(?=(?:[^'"]|'[^']*'|"[^"]*")*$)/);
    for (const part of parts) {
      const cut = part.indexOf(":");
      if (cut === -1) continue;
      const evSpec = part.slice(0, cut).trim();
      const method = part.slice(cut + 1);
      if (!evSpec || !method.trim()) continue;
      const [evName, ...mods] = evSpec.split(".");
      const handler = method.trim();
      track(instance, el, evName, (e) => {
        if (applyModifiers(e, el, mods)) runHandler(instance, el, handler, e);
      });
    }
  }
}
function bindAtEvents(els, instance) {
  for (const el of els) {
    const mEl = el;
    if (mEl.__micraAtBound) continue;
    let bound = false;
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith("@")) continue;
      const [evSpec, ...rest] = attr.name.slice(1).split(".");
      const handler = attr.value.trim();
      track(instance, el, evSpec, (e) => {
        if (applyModifiers(e, el, rest)) runHandler(instance, el, handler, e);
      });
      bound = true;
    }
    if (bound) mEl.__micraAtBound = true;
  }
}
function bindModels(bindings, instance) {
  for (const { el, expr } of bindings) {
    const mEl = el;
    if (mEl.__micraModel) continue;
    mEl.__micraModel = true;
    const key = expr.trim();
    const tag = el.tagName;
    const inputEl = el;
    const inputType = inputEl.type;
    const update = () => {
      let val;
      if (tag === "INPUT" && inputType === "checkbox") {
        val = inputEl.checked;
      } else if (tag === "INPUT" && (inputType === "number" || inputType === "range")) {
        val = inputEl.value === "" ? null : inputEl.valueAsNumber;
      } else {
        val = inputEl.value;
      }
      setPath(instance.state, key, val);
    };
    const evType = tag === "SELECT" || inputType === "radio" ? "change" : "input";
    track(instance, el, evType, update);
  }
}

// src/dom/scan.ts
function emptyScan() {
  return {
    text: [],
    html: [],
    if: [],
    show: [],
    bind: [],
    model: [],
    class: [],
    each: [],
    on: [],
    atEvents: [],
    refs: []
  };
}
function parsePairs(expr) {
  const out = [];
  for (const part of expr.split(",")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const left = part.slice(0, colon).trim();
    const right = part.slice(colon + 1).trim();
    if (!left) continue;
    out.push([left, right]);
  }
  return out;
}
function pairDeps(pairs) {
  const set = /* @__PURE__ */ new Set();
  for (const [, expr] of pairs) {
    const d = exprDeps(expr);
    if (d === null) return null;
    for (const k of d) set.add(k);
  }
  return set;
}
function classify(el, scan) {
  if (el.tagName === "TEMPLATE") {
    if (el.hasAttribute("data-each")) scan.each.push(el);
    return;
  }
  const attrs = el.attributes;
  let atEventSeen = false;
  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i];
    const name = a.name;
    const first = name.charCodeAt(0);
    if (first === 64) {
      if (!atEventSeen) {
        scan.atEvents.push(el);
        atEventSeen = true;
      }
      continue;
    }
    if (first === 100 && name.length >= 6 && name.startsWith("data-")) {
      const rest = name.slice(5);
      switch (rest) {
        case "text":
          scan.text.push({ el, expr: a.value, deps: exprDeps(a.value) });
          break;
        case "html":
          scan.html.push({ el, expr: a.value, deps: exprDeps(a.value) });
          break;
        case "if":
          scan.if.push({
            el,
            expr: a.value,
            deps: exprDeps(a.value)
          });
          break;
        case "show":
          scan.show.push({ el, expr: a.value, deps: exprDeps(a.value) });
          break;
        case "bind": {
          const pairs = parsePairs(a.value);
          scan.bind.push({
            el,
            expr: a.value,
            pairs,
            deps: pairDeps(pairs)
          });
          break;
        }
        case "model":
          scan.model.push({ el, expr: a.value, deps: exprDeps(a.value) });
          break;
        case "class": {
          const pairs = parsePairs(a.value);
          scan.class.push({
            el,
            expr: a.value,
            pairs,
            deps: pairDeps(pairs)
          });
          break;
        }
        case "on":
          scan.on.push(el);
          break;
        case "ref":
          scan.refs.push(el);
          break;
      }
    }
  }
}
var NESTED_COMPONENT_FILTER = {
  acceptNode(node) {
    if (node.hasAttribute("data-component"))
      return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }
};
function scanComponent(root) {
  const scan = emptyScan();
  classify(root, scan);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    NESTED_COMPONENT_FILTER
  );
  let node = walker.nextNode();
  while (node) {
    classify(node, scan);
    node = walker.nextNode();
  }
  return scan;
}

// src/dom/each.ts
function scanHasOpaqueBindings(scan) {
  const c = scan.__opaque;
  if (c !== void 0) return c;
  const o = scan.each.length > 0 || [scan.text, scan.html, scan.if, scan.show, scan.bind, scan.class].some(
    (g) => g.some((b) => b.deps === null)
  );
  scan.__opaque = o;
  return o;
}
var warnedRowBindings = /* @__PURE__ */ new WeakSet();
function releaseRowListeners(instance, removed) {
  const t = instance.__micraListeners;
  if (!t?.length || !removed.length) return;
  instance.__micraListeners = t.filter(
    (r) => !removed.some((n) => n === r.el || n.contains(r.el))
  );
}
function renderList(templates, state, rawState, instance, dirty) {
  for (const tmplEl of templates) {
    if (tmplEl.tagName !== "TEMPLATE") continue;
    const tmpl = tmplEl;
    const itemsExpr = tmpl.getAttribute("data-each");
    const keyAttr = tmpl.getAttribute("data-key") ?? null;
    const items = evalExpr(itemsExpr, state);
    if (!tmpl.__micraMarker) {
      const m = document.createComment(`each:${itemsExpr}`);
      tmpl.after(m);
      tmpl.__micraMarker = m;
      tmpl.__micraNodes = /* @__PURE__ */ new Map();
      tmpl.__micraList = [];
    }
    const marker = tmpl.__micraMarker;
    const keyMap = tmpl.__micraNodes;
    if (!marker.parentNode) continue;
    if (!Array.isArray(items)) {
      if (tmpl.__micraList.length) {
        tmpl.__micraList.forEach((n) => n.remove());
        releaseRowListeners(instance, tmpl.__micraList);
      }
      tmpl.__micraList = [];
      keyMap.clear();
      continue;
    }
    const canSkipUnchanged = dirty !== null && dirty.size === 1 && dirty.has(itemsExpr);
    if (keyAttr) {
      renderKeyed(tmpl, items, keyAttr, marker, keyMap, state, rawState, instance, canSkipUnchanged, dirty);
    } else {
      renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged, dirty);
    }
  }
}
function createRowNode(tmpl, state, instance) {
  const frag = tmpl.content.cloneNode(true);
  let node;
  const first = frag.firstElementChild;
  const single = !!first && !first.nextElementSibling && !Array.prototype.some.call(
    frag.childNodes,
    (c) => c.nodeType === 3 && /[^\x00- ]/.test(c.textContent)
  );
  if (single) {
    node = first;
  } else {
    node = document.createElement("micra-each-item");
    node.style.display = "contents";
    node.append(frag);
  }
  const rowScan = scanComponent(node);
  node.__micraScan = rowScan;
  node._itemState = Object.create(state);
  if (!warnedRowBindings.has(tmpl)) {
    const m = rowScan.model.find((b) => /^(item|index|\$index)\b/.test(b.expr));
    if (m || rowScan.refs.length) {
      warnedRowBindings.add(tmpl);
      warn(
        m ? `data-model="${m.expr}" in data-each is not row-scoped \u2014 use @input + a method` : `data-ref in data-each rows is not collected \u2014 query the row element`
      );
    }
  }
  bindDataOn(rowScan.on, instance);
  bindAtEvents(rowScan.atEvents, instance);
  bindModels(rowScan.model, instance);
  return node;
}
function renderKeyed(tmpl, items, keyAttr, marker, keyMap, state, rawState, instance, canSkipUnchanged, dirty) {
  const nextKeys = /* @__PURE__ */ new Set();
  const nextNodes = [];
  let warnedNullKey = false;
  let warnedDupKey = false;
  for (const [index, item] of items.entries()) {
    const key = item[keyAttr];
    if (key == null && !warnedNullKey) {
      warn(`data-key="${keyAttr}" is null/undefined on item at index ${index}`);
      warnedNullKey = true;
    }
    if (nextKeys.has(key) && !warnedDupKey) {
      warn(`data-key="${keyAttr}" has duplicate value ${JSON.stringify(key)} \u2014 rows will collide`);
      warnedDupKey = true;
    }
    nextKeys.add(key);
    let node = keyMap.get(key);
    if (!node) {
      node = createRowNode(tmpl, state, instance);
      keyMap.set(key, node);
    } else if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === index && node.__micraScan && !scanHasOpaqueBindings(node.__micraScan)) {
      nextNodes.push(node);
      continue;
    }
    const rowDirty = node.__micraItem === item && node.__micraIndex === index ? dirty : null;
    node.__micraItem = item;
    node.__micraIndex = index;
    const itemState = node._itemState;
    itemState.item = item;
    itemState.index = index;
    itemState.$index = index;
    const rowScan = node.__micraScan ?? (node.__micraScan = scanComponent(node));
    applyDirectives(rowScan, itemState, rawState, rowDirty);
    if (rowScan.each.length) renderList(rowScan.each, itemState, rawState, instance, rowDirty);
    nextNodes.push(node);
  }
  const removedNodes = [];
  for (const [key, node] of keyMap) {
    if (!nextKeys.has(key)) {
      node.remove();
      keyMap.delete(key);
      removedNodes.push(node);
    }
  }
  releaseRowListeners(instance, removedNodes);
  const prevList = tmpl.__micraList;
  if (prevList.length === 0) {
    if (nextNodes.length) {
      const frag = document.createDocumentFragment();
      for (const node of nextNodes) frag.append(node);
      marker.after(frag);
    }
  } else {
    let orderChanged = nextNodes.length !== prevList.length;
    if (!orderChanged) {
      for (let i = 0; i < nextNodes.length; i++) {
        if (nextNodes[i] !== prevList[i]) {
          orderChanged = true;
          break;
        }
      }
    }
    if (orderChanged) reorderKeyed(nextNodes, prevList, marker);
  }
  tmpl.__micraList = nextNodes;
}
function reorderKeyed(nextNodes, prevList, marker) {
  const prevPos = /* @__PURE__ */ new Map();
  for (let i = 0; i < prevList.length; i++) prevPos.set(prevList[i], i);
  const n = nextNodes.length;
  const tails = [];
  const tailIdx = [];
  const prev = new Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    const p = prevPos.get(nextNodes[i]);
    if (p === void 0) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      tails[m] < p ? lo = m + 1 : hi = m;
    }
    if (lo > 0) prev[i] = tailIdx[lo - 1];
    tails[lo] = p;
    tailIdx[lo] = i;
  }
  const stable = /* @__PURE__ */ new Set();
  let idx = tailIdx[tails.length - 1];
  while (idx >= 0) {
    stable.add(idx);
    idx = prev[idx];
  }
  let anchor = marker;
  for (let i = 0; i < n; i++) {
    const node = nextNodes[i];
    if (stable.has(i)) {
      anchor = node;
      continue;
    }
    anchor.after(node);
    anchor = node;
  }
}
function renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged, dirty) {
  const prevList = tmpl.__micraList;
  const prevLen = prevList.length;
  const nextLen = items.length;
  const reuseLen = nextLen < prevLen ? nextLen : prevLen;
  const nextList = new Array(nextLen);
  for (let i = 0; i < reuseLen; i++) {
    const node = prevList[i];
    const item = items[i];
    if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === i && node.__micraScan && !scanHasOpaqueBindings(node.__micraScan)) {
      nextList[i] = node;
      continue;
    }
    const rowDirty = node.__micraItem === item && node.__micraIndex === i ? dirty : null;
    node.__micraItem = item;
    node.__micraIndex = i;
    const itemState = node._itemState;
    itemState.item = item;
    itemState.index = i;
    itemState.$index = i;
    applyDirectives(node.__micraScan, itemState, rawState, rowDirty);
    if (node.__micraScan.each.length) renderList(node.__micraScan.each, itemState, rawState, instance, rowDirty);
    nextList[i] = node;
  }
  if (nextLen < prevLen) {
    const removedTail = [];
    for (let i = nextLen; i < prevLen; i++) {
      prevList[i].remove();
      removedTail.push(prevList[i]);
    }
    releaseRowListeners(instance, removedTail);
  }
  if (nextLen > prevLen) {
    const frag = document.createDocumentFragment();
    for (let i = prevLen; i < nextLen; i++) {
      const node = createRowNode(tmpl, state, instance);
      const item = items[i];
      const itemState = node._itemState;
      itemState.item = item;
      itemState.index = i;
      itemState.$index = i;
      node.__micraItem = item;
      node.__micraIndex = i;
      applyDirectives(node.__micraScan, itemState, rawState);
      if (node.__micraScan.each.length) renderList(node.__micraScan.each, itemState, rawState, instance, null);
      nextList[i] = node;
      frag.append(node);
    }
    const anchor = prevLen > 0 ? nextList[prevLen - 1] : marker;
    anchor.after(frag);
  }
  tmpl.__micraList = nextList;
}

// src/dom/refs.ts
function collectRefs(els, instance) {
  if (!els.length) return;
  instance.refs = {};
  for (const el of els) {
    const name = el.dataset["ref"];
    if (name) instance.refs[name] = el;
  }
}

// src/core/mount.ts
function mount(selector, definition) {
  const root = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (!root) {
    warn(`"${selector}" not found`);
    return null;
  }
  if (_instances.has(root))
    return _instances.get(root);
  const rawState = { ...definition.state ?? {} };
  const instance = { $el: root, refs: {} };
  for (const [key, val] of Object.entries(
    definition
  )) {
    if (key === "state" || key === "onCreate" || key === "onDestroy") continue;
    if (typeof val === "function") instance[key] = val;
  }
  instance.prop = function(name, defaultVal) {
    const val = root.dataset[name];
    if (val === void 0) return defaultVal;
    if (typeof defaultVal === "string") return val;
    if (val === "true") return true;
    if (val === "false") return false;
    if (val !== "" && !isNaN(Number(val))) return Number(val);
    return val;
  };
  instance.set = (path, value) => setPath(instance.state, path, value);
  instance.fetch = micraFetch;
  instance.emit = emit;
  instance.on = (event, handler) => {
    const unsub = on(event, handler);
    if (!instance.__micraSubs) instance.__micraSubs = [];
    instance.__micraSubs.push(unsub);
    return unsub;
  };
  let isRendering = false;
  const _dirty = /* @__PURE__ */ new Set();
  const schedule = createScheduler(() => instance.render());
  let warnedRenderWrite = false;
  const scheduleSafe = () => {
    if (isRendering) {
      if (!warnedRenderWrite) {
        warn(
          "state write during render is kept but not re-rendered \u2014 move writes out of directive expressions"
        );
        warnedRenderWrite = true;
      }
      return;
    }
    schedule();
  };
  instance.state = createReactiveState(rawState, scheduleSafe, (key) => {
    _dirty.add(key);
  });
  const boundMethods = /* @__PURE__ */ new Map();
  const exprState = new Proxy(rawState, {
    get(target, key) {
      if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
      if (Object.prototype.hasOwnProperty.call(instance, key) && typeof instance[key] === "function") {
        const cached = boundMethods.get(key);
        if (cached) return cached;
        const bound = instance[key].bind(instance);
        boundMethods.set(key, bound);
        return bound;
      }
      return void 0;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      if (Object.prototype.hasOwnProperty.call(target, key)) return true;
      return Object.prototype.hasOwnProperty.call(instance, key) && typeof instance[key] === "function";
    }
  });
  instance.__micraExpr = exprState;
  let warnedReentry = false;
  instance.render = function() {
    if (instance.__micraDestroyed) return;
    const dirty = _dirty.size ? new Set(_dirty) : null;
    _dirty.clear();
    if (isRendering) {
      if (!warnedReentry) {
        warn(
          "render() re-entry detected \u2014 mutation inside a directive expression is ignored. Move state writes to a method."
        );
        warnedReentry = true;
      }
      return;
    }
    isRendering = true;
    try {
      const mRoot2 = root;
      const scan = mRoot2.__micraScan ?? (mRoot2.__micraScan = scanComponent(root));
      applyDirectives(scan, exprState, rawState, dirty);
      renderList(scan.each, exprState, rawState, instance, dirty);
      bindDataOn(scan.on, instance);
      bindAtEvents(scan.atEvents, instance);
      bindModels(scan.model, instance);
      collectRefs(scan.refs, instance);
    } finally {
      isRendering = false;
    }
  };
  instance.destroy = function() {
    if (instance.__micraDestroyed) return;
    instance.__micraDestroyed = true;
    instance.__micraListeners?.forEach(
      ({ el, type, fn }) => el.removeEventListener(type, fn)
    );
    instance.__micraListeners = [];
    const scan = root.__micraScan;
    for (const b of scan?.if ?? []) {
      const ph = b.placeholder;
      if (ph?.parentNode) ph.parentNode.replaceChild(b.el, ph);
      delete b.el.__micraIfDetached;
    }
    for (const t of scan?.each ?? []) {
      t.__micraList?.forEach((n) => n.remove());
      t.__micraList = [];
      t.__micraNodes?.clear();
      t.__micraMarker?.remove();
      delete t.__micraMarker;
    }
    const clearFlags = (el) => {
      const m = el;
      delete m.__micraEvents;
      delete m.__micraAtBound;
      delete m.__micraModel;
      delete m.__micraScan;
    };
    clearFlags(root);
    root.querySelectorAll("*").forEach(clearFlags);
    instance.__micraSubs?.forEach((unsub) => unsub());
    instance.__micraSubs = [];
    if (typeof definition.onDestroy === "function")
      definition.onDestroy.call(instance);
    _instances.delete(root);
  };
  _instances.set(root, instance);
  instance.render();
  const mRoot = root;
  if (mRoot.__micraScan) validateDirectives(mRoot.__micraScan);
  if (typeof definition.onCreate === "function")
    Promise.resolve().then(
      () => definition.onCreate.call(instance)
    );
  return instance;
}

// src/core/start.ts
function start(root = document) {
  root.querySelectorAll("[data-component]").forEach((el) => {
    if (_instances.has(el)) return;
    const name = el.getAttribute("data-component");
    const def = _registry.get(name);
    if (!def) {
      warn(`component "${name}" not defined. Call Micra.define('${name}', {...}) first.`);
      return;
    }
    mount(el, def);
  });
}

// src/core/destroy.ts
function destroy(root = document) {
  root.querySelectorAll("[data-component]").forEach(
    (el) => _instances.get(el)?.destroy()
  );
  if (root instanceof HTMLElement) _instances.get(root)?.destroy();
}
var _observer = null;
function autoCleanup() {
  if (_observer) return stopAutoCleanup;
  _observer = new MutationObserver((records) => {
    for (const rec of records)
      rec.removedNodes.forEach((n) => {
        if (n.__micraIfDetached) return;
        if (n instanceof HTMLElement && !n.isConnected) destroy(n);
      });
  });
  _observer.observe(document.documentElement, { childList: true, subtree: true });
  return stopAutoCleanup;
}
function stopAutoCleanup() {
  _observer?.disconnect();
  _observer = null;
}
//# sourceMappingURL=micra.cjs.js.map
