/* Micra.js v2.8.0 — https://github.com/denisfl/micra.js — MIT */
"use strict";
var Micra = (() => {
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

  // src/utils/fetch.ts
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
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (csrf && sameOrigin(url)) headers["X-CSRF-Token"] = csrf;
    let finalUrl = url;
    let body;
    if (method === "GET" || method === "HEAD") {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(options)) {
        if (k !== "method" && k !== "headers" && k !== "signal" && v != null)
          params.set(k, String(v));
      }
      const qs = String(params);
      if (qs) finalUrl += (url.includes("?") ? "&" : "?") + qs;
    } else if (options.body !== void 0) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }
    const res = await fetch(finalUrl, {
      method,
      headers,
      signal: options.signal,
      body
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
  var TOKEN = /([0-9][0-9.]*|[A-Za-z_$][\w$]*|'(?:\\[^]|[^\\'])*'|"(?:\\[^]|[^\\"])*"|===|!==|[=!<>]=|&&|\|\||[-().,?:!<>+*/%])|\S/g;
  var IDENT = /^[A-Za-z_$]/;
  var BIN_OPS = /* @__PURE__ */ new Map([
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
    ["%", [6, (l, r) => l % r()]]
  ]);
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
  var member = (o, p) => o == null || BLOCKED_PROPS.has(p) ? void 0 : o[p];
  function parse(src) {
    const toks = [...src.matchAll(TOKEN)].map((m) => {
      if (!m[1]) throw 0;
      return m[1];
    });
    const deps = /* @__PURE__ */ new Set();
    let opaque = false;
    let pos = 0;
    const peek = () => toks[pos];
    const next = (expect) => {
      if (expect && toks[pos] !== expect) throw 0;
      return toks[pos++];
    };
    function parseExpr() {
      const c = parseBin(1);
      if (peek() !== "?") return c;
      next();
      const a = parseExpr();
      next(":");
      const b = parseExpr();
      return (s) => (c(s) ? a : b)(s);
    }
    function parseBin(minPrec) {
      let left = parseUnary();
      for (let op; (op = BIN_OPS.get(peek())) && op[0] >= minPrec; ) {
        next();
        const l = left, r = parseBin(op[0] + 1), f2 = op[1];
        left = (s) => f2(l(s), () => r(s));
      }
      return left;
    }
    function parseUnary() {
      const t = peek();
      if (t !== "!" && t !== "-") return parsePostfix();
      next();
      const x = parseUnary();
      return t === "!" ? (s) => !x(s) : (s) => -x(s);
    }
    function parsePostfix() {
      let node = parsePrimary();
      for (let t; (t = peek()) === "." || t === "("; ) {
        next();
        const o = node;
        if (t === ".") {
          const p = next();
          if (!p || !IDENT.test(p)) throw 0;
          node = Object.assign((s) => member(o(s), p), { o, p });
        } else {
          opaque = true;
          const args = [];
          if (peek() !== ")")
            do
              args.push(parseExpr());
            while (peek() === "," && next());
          next(")");
          const { o: self, p } = o;
          node = (s) => {
            const that = self && self(s);
            const fn = self ? member(that, p) : o(s);
            if (typeof fn !== "function") throw new TypeError("not a function");
            return fn.apply(that, args.map((a) => a(s)));
          };
        }
      }
      return node;
    }
    function parsePrimary() {
      const t = next();
      if (!t) throw 0;
      if (t === "(") {
        const e = parseExpr();
        next(")");
        return e;
      }
      let v;
      if (/^[0-9]/.test(t)) v = Number(t);
      else if (t[0] === "'" || t[0] === '"')
        v = t.slice(1, -1).replace(/\\([^])/g, "$1");
      else if (/^(true|false|null)$/.test(t)) v = JSON.parse(t);
      else if (IDENT.test(t)) {
        deps.add(t);
        return (s) => resolveIdent(t, s);
      } else throw 0;
      return () => v;
    }
    const f = parseExpr();
    if (pos !== toks.length) throw 0;
    return { f, deps: opaque ? null : deps };
  }
  var exprCache = /* @__PURE__ */ new Map();
  function compile(expr) {
    let cached = exprCache.get(expr);
    if (!cached) {
      try {
        cached = parse(expr);
      } catch {
        warn(`invalid expression "${expr}"`);
        cached = { f: () => void 0, deps: null };
      }
      exprCache.set(expr, cached);
    }
    return cached;
  }
  function exprDeps(expr) {
    return compile(expr).deps;
  }
  function evalExpr(expr, state) {
    const cached = compile(expr);
    try {
      return cached.f(state);
    } catch (e) {
      if (!cached.warned) {
        cached.warned = 1;
        warn(`runtime error in "${expr}": ${e.message}`);
      }
      return void 0;
    }
  }
  function splitTop(s) {
    const out = [];
    let depth = 0, q = "", start2 = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) {
        if (c === "\\") i++;
        else if (c === q) q = "";
      } else if (c === "'" || c === '"') q = c;
      else if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) depth--;
      else if (c === "," && !depth) {
        out.push(s.slice(start2, i));
        start2 = i + 1;
      }
    }
    out.push(s.slice(start2));
    return out;
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
      binding.placeholder?.replaceWith(el);
      delete el.__micraIfDetached;
    } else if (el.parentNode) {
      el.__micraIfDetached = true;
      el.replaceWith(binding.placeholder ?? (binding.placeholder = document.createComment("if")));
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
    const desired = String(stateVal ?? "");
    if (html.type === "checkbox" || html.type === "radio") {
      const want = html.type === "checkbox" ? Boolean(stateVal) : html.value === desired;
      if (html.checked !== want) html.checked = want;
      return;
    }
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
      scope["$event"] = scope["event"] = e;
      evalExpr(value, scope);
      return;
    }
    const fn = instance[value];
    if (typeof fn === "function") fn.call(instance, e);
    else warn(`method "${value}" not found`);
  }
  function listen(instance, el, spec, handler) {
    const [type, ...mods] = spec.split(".");
    track(instance, el, type, (e) => {
      if (applyModifiers(e, el, mods)) runHandler(instance, el, handler, e);
    });
  }
  function bindDataOn(els, instance) {
    for (const el of els) {
      const mEl = el;
      if (mEl.__micraEvents) continue;
      mEl.__micraEvents = true;
      for (const part of splitTop(mEl.dataset["on"] ?? "")) {
        const cut = part.indexOf(":");
        if (cut === -1) continue;
        const evSpec = part.slice(0, cut).trim();
        const method = part.slice(cut + 1);
        if (!evSpec || !method.trim()) continue;
        listen(instance, el, evSpec, method.trim());
      }
      for (const attr of el.attributes)
        if (attr.name[0] === "@") listen(instance, el, attr.name.slice(1), attr.value.trim());
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
      refs: []
    };
  }
  function parsePairs(expr) {
    const out = [];
    for (const part of splitTop(expr)) {
      const m = /^\s*(['"]?)(.*?)\1\s*:([\s\S]*)$/.exec(part);
      const left = m?.[2].trim();
      if (left) out.push([left, m[3].trim()]);
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
    let eventSeen = false;
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      const name = a.name;
      const first = name.charCodeAt(0);
      if (first === 64 || name === "data-on") {
        if (!eventSeen) {
          scan.on.push(el);
          eventSeen = true;
        }
        continue;
      }
      if (name.startsWith("data-")) {
        const rest = name.slice(5);
        const expr = a.value;
        switch (rest) {
          case "text":
          case "html":
          case "if":
          case "show":
          case "model":
            scan[rest].push({ el, expr, deps: exprDeps(expr) });
            break;
          case "bind":
          case "class": {
            const pairs = parsePairs(expr);
            scan[rest].push({ el, expr, pairs, deps: pairDeps(pairs) });
            break;
          }
          case "ref":
            scan.refs.push(el);
            break;
        }
      }
    }
  }
  var NESTED_COMPONENT_FILTER = (node) => node.hasAttribute("data-component") ? 2 : 1;
  function scanComponent(root) {
    const scan = emptyScan();
    classify(root, scan);
    const walker = document.createTreeWalker(
      root,
      1,
      NESTED_COMPONENT_FILTER
    );
    for (let node; node = walker.nextNode(); ) classify(node, scan);
    return scan;
  }

  // src/dom/each.ts
  function releaseRowListeners(instance, removed) {
    const t = instance.__micraListeners;
    if (!t?.length || !removed.length) return;
    instance.__micraListeners = t.filter(
      (r) => !removed.some((n) => n === r.el || n.contains(r.el))
    );
  }
  function renderList(templates, state, rawState, instance, dirty) {
    for (const tmplEl of templates) {
      const tmpl = tmplEl;
      const itemsExpr = tmpl.getAttribute("data-each");
      const keyAttr = tmpl.getAttribute("data-key");
      const value = evalExpr(itemsExpr, state);
      const items = Array.isArray(value) ? value : [];
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
      const canSkipUnchanged = dirty !== null && dirty.size === 1 && dirty.has(itemsExpr);
      if (!keyAttr) {
        renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged, dirty);
        continue;
      }
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
        if (!node) keyMap.set(key, node = createRowNode(tmpl, state, instance));
        patchRow(node, item, index, rawState, instance, canSkipUnchanged, dirty);
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
        const frag = document.createDocumentFragment();
        for (const node of nextNodes) frag.append(node);
        marker.after(frag);
      } else {
        if (nextNodes.length !== prevList.length || nextNodes.some((node, i) => node !== prevList[i])) reorderKeyed(nextNodes, prevList, marker);
      }
      tmpl.__micraList = nextNodes;
    }
  }
  function createRowNode(tmpl, state, instance) {
    const frag = tmpl.content.cloneNode(true);
    let node;
    const first = frag.firstElementChild;
    const single = !!first && !first.nextElementSibling && !Array.from(frag.childNodes).some(
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
    const listKey = tmpl.getAttribute("data-each");
    node.__micraOpaque = rowScan.each.length > 0 || [rowScan.text, rowScan.html, rowScan.if, rowScan.show, rowScan.bind, rowScan.model, rowScan.class].some(
      (g) => g.some((b) => !b.deps || b.deps.has(listKey))
    );
    node._itemState = Object.create(state);
    if (!tmpl.__micraRowWarned) {
      const m = rowScan.model.find((b) => /^(item|index|\$index)\b/.test(b.expr));
      if (m || rowScan.refs.length) {
        tmpl.__micraRowWarned = true;
        warn(
          m ? `data-model="${m.expr}" in data-each is not row-scoped \u2014 use @input + a method` : `data-ref in data-each rows is not collected \u2014 query the row element`
        );
      }
    }
    bindDataOn(rowScan.on, instance);
    bindModels(rowScan.model, instance);
    return node;
  }
  function patchRow(node, item, index, rawState, instance, canSkip, dirty) {
    const rowScan = node.__micraScan;
    const same = node.__micraItem === item && node.__micraIndex === index;
    if (same && canSkip && !node.__micraOpaque) return;
    const rowDirty = same ? dirty : null;
    node.__micraItem = item;
    node.__micraIndex = index;
    const itemState = node._itemState;
    itemState.item = item;
    itemState.index = itemState.$index = index;
    applyDirectives(rowScan, itemState, rawState, rowDirty);
    if (rowScan.each.length) renderList(rowScan.each, itemState, rawState, instance, rowDirty);
  }
  function reorderKeyed(nextNodes, prevList, marker) {
    const prevPos = /* @__PURE__ */ new Map();
    for (let i = 0; i < prevList.length; i++) prevPos.set(prevList[i], i);
    const n = nextNodes.length;
    const tails = [];
    const tailIdx = [];
    const prev = [];
    for (let i = 0; i < n; i++) {
      const p = prevPos.get(nextNodes[i]);
      if (p === void 0) continue;
      let lo = 0, hi = tails.length;
      while (lo < hi) {
        const m = lo + hi >> 1;
        tails[m] < p ? lo = m + 1 : hi = m;
      }
      prev[i] = tailIdx[lo - 1];
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
    nextNodes.forEach((node, i) => {
      if (!stable.has(i)) anchor.after(node);
      anchor = node;
    });
  }
  function renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged, dirty) {
    const prevList = tmpl.__micraList;
    const prevLen = prevList.length;
    const nextLen = items.length;
    const nextList = prevList.slice(0, nextLen);
    nextList.forEach((node, i) => patchRow(node, items[i], i, rawState, instance, canSkipUnchanged, dirty));
    const removed = prevList.slice(nextLen);
    removed.forEach((n) => n.remove());
    releaseRowListeners(instance, removed);
    const frag = document.createDocumentFragment();
    for (let i = prevLen; i < nextLen; i++) {
      const node = createRowNode(tmpl, state, instance);
      patchRow(node, items[i], i, rawState, instance, false, null);
      frag.append(nextList[i] = node);
    }
    ;
    (nextList[prevLen - 1] ?? marker).after(frag);
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
    const rawState = { ...definition.state };
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
      (instance.__micraSubs ?? (instance.__micraSubs = [])).push(unsub);
      return unsub;
    };
    let isRendering = false;
    const _dirty = /* @__PURE__ */ new Set();
    const schedule = createScheduler(() => instance.render());
    const warned = /* @__PURE__ */ new Set();
    const warnOnce = (msg) => {
      if (!warned.has(msg)) warned.add(msg), warn(msg);
    };
    const scheduleSafe = () => {
      if (isRendering)
        warnOnce(
          "state write during render is kept but not re-rendered \u2014 move writes out of directive expressions"
        );
      else schedule();
    };
    instance.state = createReactiveState(rawState, scheduleSafe, (key) => {
      _dirty.add(key);
    });
    const boundMethods = /* @__PURE__ */ new Map();
    const hasOwn = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
    const isMethod = (key) => hasOwn(instance, key) && typeof instance[key] === "function";
    const exprState = new Proxy(rawState, {
      get(target, key) {
        if (hasOwn(target, key)) return target[key];
        if (isMethod(key)) {
          let bound = boundMethods.get(key);
          if (!bound)
            boundMethods.set(key, bound = instance[key].bind(instance));
          return bound;
        }
      },
      has: (target, key) => hasOwn(target, key) || isMethod(key)
    });
    instance.__micraExpr = exprState;
    instance.render = function() {
      if (instance.__micraDestroyed) return;
      const dirty = _dirty.size ? new Set(_dirty) : null;
      _dirty.clear();
      if (isRendering)
        return warnOnce(
          "render() re-entry detected \u2014 mutation inside a directive expression is ignored. Move state writes to a method."
        );
      isRendering = true;
      try {
        const mRoot = root;
        const scan = mRoot.__micraScan ?? (mRoot.__micraScan = scanComponent(root));
        applyDirectives(scan, exprState, rawState, dirty);
        renderList(scan.each, exprState, rawState, instance, dirty);
        bindDataOn(scan.on, instance);
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
      const scan = root.__micraScan;
      for (const b of scan?.if ?? []) {
        b.placeholder?.replaceWith(b.el);
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
        delete m.__micraModel;
        delete m.__micraScan;
      };
      clearFlags(root);
      root.querySelectorAll("*").forEach(clearFlags);
      instance.__micraSubs?.forEach((unsub) => unsub());
      if (typeof definition.onDestroy === "function")
        definition.onDestroy.call(instance);
      _instances.delete(root);
    };
    _instances.set(root, instance);
    instance.render();
    validateDirectives(root.__micraScan);
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
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=micra.js.map
