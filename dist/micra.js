/* Micra.js v2.4.0 — https://github.com/micra-js/micra — MIT */
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
    debug: () => debug,
    define: () => define,
    defineComponent: () => defineComponent,
    emit: () => emit,
    instances: () => instances,
    mount: () => mount,
    off: () => off,
    on: () => on,
    registry: () => registry,
    start: () => start
  });

  // src/utils/fetch.ts
  function getCSRF() {
    var _a, _b;
    return (_b = (_a = document.querySelector('meta[name="csrf-token"]')) == null ? void 0 : _a.getAttribute("content")) != null ? _b : null;
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
    var _a, _b;
    const method = ((_a = options.method) != null ? _a : "GET").toUpperCase();
    const headers = {
      Accept: "application/json",
      ...options.headers
    };
    const csrf = getCSRF();
    if (csrf) headers["X-CSRF-Token"] = csrf;
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
    const ct = (_b = res.headers.get("content-type")) != null ? _b : "";
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
    var _a;
    if (_instances.size === 0) {
      console.log("[Micra] No live components.");
      return;
    }
    console.group(`[Micra] ${_instances.size} live component(s)`);
    for (const [el, instance] of _instances) {
      const name = (_a = el.getAttribute("data-component")) != null ? _a : "(unnamed)";
      console.group(`%c${name}`, "font-weight:bold;color:#6366f1");
      console.log("$el  ", el);
      console.log("state", { ...instance.state });
      console.groupEnd();
    }
    console.groupEnd();
  }

  // src/utils/expr.ts
  var ALLOWED_GLOBALS = new Set(
    "Math,JSON,Date,String,Number,Boolean,Array,Object,parseInt,parseFloat,isNaN,isFinite,NaN,Infinity,undefined".split(",")
  );
  var BLOCKED_PROPS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
  var OBJ_PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));
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
    var _a;
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
            s += (_a = src[i + 1]) != null ? _a : "";
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
      var _a;
      if (((_a = peek()) == null ? void 0 : _a.v) !== v) throw 0;
      pos++;
    };
    function parseExpr() {
      var _a;
      const c = parseBin(1);
      if (((_a = peek()) == null ? void 0 : _a.v) === "?") {
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
      var _a, _b;
      let node = parsePrimary();
      for (; ; ) {
        const t = peek();
        if ((t == null ? void 0 : t.v) === ".") {
          next();
          const id = next();
          if (!id || id.t !== "id") throw 0;
          node = { k: "mem", o: node, p: id.v };
        } else if ((t == null ? void 0 : t.v) === "(") {
          next();
          const args = [];
          if (((_a = peek()) == null ? void 0 : _a.v) !== ")") {
            args.push(parseExpr());
            while (((_b = peek()) == null ? void 0 : _b.v) === ",") {
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
    if (ALLOWED_GLOBALS.has(name)) return globalThis[name];
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
        return fn.apply(self, node.a.map((x) => evalNode(x, scope)));
      }
    }
  }
  var exprCache = /* @__PURE__ */ new Map();
  var warnedRuntime = /* @__PURE__ */ new Set();
  var SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
  function evalExpr(expr, state) {
    let cached = exprCache.get(expr);
    if (!cached) {
      if (SIMPLE_PATH.test(expr)) {
        cached = { kind: "path", parts: expr.split(".") };
      } else {
        try {
          cached = { kind: "ast", ast: parse(tokenize(expr)) };
        } catch {
          warn(`invalid expression "${expr}"`);
          cached = { kind: "err" };
        }
      }
      exprCache.set(expr, cached);
    }
    if (cached.kind === "path") {
      const parts = cached.parts;
      if (!safeStateHas(state, parts[0])) return void 0;
      let obj = state;
      for (const key of parts) obj = obj != null ? obj[key] : void 0;
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
    var _a;
    const payload = args[0];
    (_a = _bus.get(event)) == null ? void 0 : _a.forEach((h) => {
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
        onKey == null ? void 0 : onKey(key);
        schedule();
        return true;
      }
    });
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

  // src/dom/directives.ts
  function applyText(el, expr, state) {
    var _a;
    const text = String((_a = evalExpr(expr, state)) != null ? _a : "");
    if (el.textContent !== text) el.textContent = text;
  }
  function applyHtml(el, expr, state) {
    var _a;
    const html = String((_a = evalExpr(expr, state)) != null ? _a : "");
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  function applyIf(binding, state) {
    const el = binding.el;
    const truthy = !!evalExpr(binding.expr, state);
    if (truthy) {
      const ph = binding.placeholder;
      if (ph && ph.parentNode) ph.parentNode.replaceChild(el, ph);
    } else {
      const parent = el.parentNode;
      if (parent) {
        if (!binding.placeholder) binding.placeholder = document.createComment("if");
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
      if (attr === "class") {
        el.className = String(val != null ? val : "");
      } else if (attr === "value") {
        if (document.activeElement !== el)
          el.value = String(val != null ? val : "");
      } else if (attr === "style") {
        if (typeof val === "object" && val !== null) {
          Object.assign(el.style, val);
        } else {
          el.setAttribute("style", String(val != null ? val : ""));
        }
      } else if (typeof val === "boolean") {
        val ? el.setAttribute(attr, "") : el.removeAttribute(attr);
      } else {
        val == null ? el.removeAttribute(attr) : el.setAttribute(attr, String(val));
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
    const stateVal = rawState[key];
    const desired = stateVal == null ? "" : String(stateVal);
    if (html.value !== desired) html.value = desired;
  }
  function applyDirectives(scan, state, rawState) {
    for (const b of scan.if) applyIf(b, state);
    for (const b of scan.text) applyText(b.el, b.expr, state);
    for (const b of scan.html) applyHtml(b.el, b.expr, state);
    for (const b of scan.show) applyShow(b.el, b.expr, state);
    for (const b of scan.bind) applyBind(b.el, b.pairs, state);
    for (const b of scan.model) applyModel(b.el, b.expr.trim(), rawState);
    for (const b of scan.class) applyClass(b.el, b.pairs, state);
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
    var _a;
    el.addEventListener(type, fn);
    ((_a = instance.__micraListeners) != null ? _a : instance.__micraListeners = []).push({ el, type, fn });
  }
  function runHandler(instance, el, value, e) {
    var _a;
    if (value.includes("(")) {
      let base;
      for (let n = el; n && !base; n = n.parentElement) {
        base = n._itemState;
      }
      const scope = Object.create((_a = base != null ? base : instance.__micraExpr) != null ? _a : null);
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
    var _a;
    for (const el of els) {
      const mEl = el;
      if (mEl.__micraEvents) continue;
      mEl.__micraEvents = true;
      const spec = (_a = mEl.dataset["on"]) != null ? _a : "";
      for (const part of spec.split(",")) {
        const [evSpec, method] = part.trim().split(":");
        if (!evSpec || !method) continue;
        const [evName, ...mods] = evSpec.split(".");
        const handler = method.trim();
        track(instance, el, evName, (e) => {
          if (mods.includes("prevent")) e.preventDefault();
          if (mods.includes("stop")) e.stopPropagation();
          if (mods.includes("self") && e.target !== el) return;
          runHandler(instance, el, handler, e);
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
          if (rest.includes("prevent")) e.preventDefault();
          if (rest.includes("stop")) e.stopPropagation();
          if (rest.includes("self") && e.target !== el) return;
          runHandler(instance, el, handler, e);
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
        ;
        instance.state[key] = val;
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
      if (first === 100 && name.length >= 6 && name.charCodeAt(4) === 45) {
        const rest = name.slice(5);
        switch (rest) {
          case "text":
            scan.text.push({ el, expr: a.value });
            break;
          case "html":
            scan.html.push({ el, expr: a.value });
            break;
          case "if":
            scan.if.push({ el, expr: a.value });
            break;
          case "show":
            scan.show.push({ el, expr: a.value });
            break;
          case "bind": {
            const pairs = parsePairs(a.value);
            scan.bind.push({ el, expr: a.value, pairs });
            break;
          }
          case "model":
            scan.model.push({ el, expr: a.value });
            break;
          case "class": {
            const pairs = parsePairs(a.value);
            scan.class.push({ el, expr: a.value, pairs });
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
  function renderList(templates, state, rawState, instance, triggerKey) {
    var _a;
    for (const tmplEl of templates) {
      if (tmplEl.tagName !== "TEMPLATE") continue;
      const tmpl = tmplEl;
      const itemsExpr = tmpl.getAttribute("data-each");
      const keyAttr = (_a = tmpl.getAttribute("data-key")) != null ? _a : null;
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
        tmpl.__micraList.forEach((n) => n.remove());
        tmpl.__micraList = [];
        keyMap.clear();
        continue;
      }
      const canSkipUnchanged = triggerKey !== null && triggerKey !== "MULTIPLE" && triggerKey === itemsExpr;
      if (keyAttr) {
        renderKeyed(tmpl, items, keyAttr, marker, keyMap, state, rawState, instance, canSkipUnchanged);
      } else {
        renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged);
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
    bindDataOn(rowScan.on, instance);
    bindAtEvents(rowScan.atEvents, instance);
    bindModels(rowScan.model, instance);
    return node;
  }
  function renderKeyed(tmpl, items, keyAttr, marker, keyMap, state, rawState, instance, canSkipUnchanged) {
    var _a;
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
      } else if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === index) {
        nextNodes.push(node);
        continue;
      }
      node.__micraItem = item;
      node.__micraIndex = index;
      const itemState = node._itemState;
      itemState.item = item;
      itemState.index = index;
      itemState.$index = index;
      const rowScan = (_a = node.__micraScan) != null ? _a : node.__micraScan = scanComponent(node);
      applyDirectives(rowScan, itemState, rawState);
      nextNodes.push(node);
    }
    for (const [key, node] of keyMap) {
      if (!nextKeys.has(key)) {
        node.remove();
        keyMap.delete(key);
      }
    }
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
  function renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged) {
    const prevList = tmpl.__micraList;
    const prevLen = prevList.length;
    const nextLen = items.length;
    const reuseLen = nextLen < prevLen ? nextLen : prevLen;
    const nextList = new Array(nextLen);
    for (let i = 0; i < reuseLen; i++) {
      const node = prevList[i];
      const item = items[i];
      if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === i) {
        nextList[i] = node;
        continue;
      }
      node.__micraItem = item;
      node.__micraIndex = i;
      const itemState = node._itemState;
      itemState.item = item;
      itemState.index = i;
      itemState.$index = i;
      applyDirectives(node.__micraScan, itemState, rawState);
      nextList[i] = node;
    }
    for (let i = nextLen; i < prevLen; i++) {
      prevList[i].remove();
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
    var _a;
    const root = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!root) {
      warn(`"${selector}" not found`);
      return null;
    }
    if (_instances.has(root))
      return _instances.get(root);
    const rawState = { ...(_a = definition.state) != null ? _a : {} };
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
      if (val === "true") return true;
      if (val === "false") return false;
      if (val !== "" && !isNaN(Number(val))) return Number(val);
      return val;
    };
    instance.fetch = micraFetch;
    instance.emit = emit;
    instance.on = (event, handler) => {
      const unsub = on(event, handler);
      if (!instance.__micraSubs) instance.__micraSubs = [];
      instance.__micraSubs.push(unsub);
      return unsub;
    };
    let isRendering = false;
    let _triggerKey = null;
    const schedule = createScheduler(() => instance.render());
    instance.state = createReactiveState(rawState, schedule, (key) => {
      if (_triggerKey === null) _triggerKey = key;
      else if (_triggerKey !== key) _triggerKey = "MULTIPLE";
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
      var _a2;
      if (instance.__micraDestroyed) return;
      const triggerKey = _triggerKey;
      _triggerKey = null;
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
        const scan = (_a2 = mRoot2.__micraScan) != null ? _a2 : mRoot2.__micraScan = scanComponent(root);
        applyDirectives(scan, exprState, rawState);
        renderList(scan.each, exprState, rawState, instance, triggerKey);
        bindDataOn(scan.on, instance);
        bindAtEvents(scan.atEvents, instance);
        bindModels(scan.model, instance);
        collectRefs(scan.refs, instance);
      } finally {
        isRendering = false;
      }
    };
    instance.destroy = function() {
      var _a2, _b;
      if (instance.__micraDestroyed) return;
      instance.__micraDestroyed = true;
      (_a2 = instance.__micraListeners) == null ? void 0 : _a2.forEach(
        ({ el, type, fn }) => el.removeEventListener(type, fn)
      );
      instance.__micraListeners = [];
      const clearFlags = (el) => {
        const m = el;
        delete m.__micraEvents;
        delete m.__micraAtBound;
        delete m.__micraModel;
        delete m.__micraScan;
      };
      clearFlags(root);
      root.querySelectorAll("*").forEach(clearFlags);
      (_b = instance.__micraSubs) == null ? void 0 : _b.forEach((unsub) => unsub());
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
  return __toCommonJS(index_exports);
})();
//# sourceMappingURL=micra.js.map
