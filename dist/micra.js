/* Micra.js v2.0.0 — https://github.com/micra-js/micra — MIT */
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
        if (k !== "method" && k !== "headers" && v != null) params[k] = String(v);
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
  var exprCache = /* @__PURE__ */ new Map();
  var warnedRuntime = /* @__PURE__ */ new Set();
  var SIMPLE_PATH = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/;
  var ALLOWED_GLOBALS = /* @__PURE__ */ new Set([
    "Math",
    "JSON",
    "Date",
    "String",
    "Number",
    "Boolean",
    "Array",
    "Object",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "NaN",
    "Infinity",
    "undefined"
  ]);
  var PARAM_S = "$s";
  var PARAM_SAFE = "$safe";
  var SAFE_OUTER = new Proxy(/* @__PURE__ */ Object.create(null), {
    has(_target, key) {
      if (typeof key !== "string") return false;
      if (key === PARAM_S || key === PARAM_SAFE) return false;
      return !ALLOWED_GLOBALS.has(key);
    },
    get() {
      return void 0;
    }
  });
  var safeWrapCache = /* @__PURE__ */ new WeakMap();
  var OBJ_PROTO_KEYS = new Set(Object.getOwnPropertyNames(Object.prototype));
  function safeStateWrap(state) {
    const cached = safeWrapCache.get(state);
    if (cached) return cached;
    const wrapped = new Proxy(state, {
      has(target, key) {
        return safeStateHas(target, key);
      },
      get(target, key) {
        return Reflect.get(target, key);
      }
    });
    safeWrapCache.set(state, wrapped);
    return wrapped;
  }
  function safeStateHas(state, key) {
    if (typeof key !== "string") return false;
    if (!Reflect.has(state, key)) return false;
    if (!OBJ_PROTO_KEYS.has(key)) return true;
    let obj = state;
    while (obj && obj !== Object.prototype) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) return true;
      obj = Object.getPrototypeOf(obj);
    }
    return false;
  }
  function evalExpr(expr, state) {
    if (SIMPLE_PATH.test(expr)) {
      const parts = expr.split(".");
      if (!safeStateHas(state, parts[0])) return void 0;
      return parts.reduce(
        (obj, key) => obj != null ? obj[key] : void 0,
        state
      );
    }
    if (!exprCache.has(expr)) {
      try {
        exprCache.set(
          expr,
          new Function("$s", "$safe", `with($safe){with($s){return (${expr})}}`)
        );
      } catch {
        warn(`invalid expression "${expr}"`);
        exprCache.set(expr, () => void 0);
      }
    }
    try {
      return exprCache.get(expr)(safeStateWrap(state), SAFE_OUTER);
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
  function emit(event, payload) {
    var _a;
    (_a = _bus.get(event)) == null ? void 0 : _a.forEach((h) => {
      try {
        h(payload);
      } catch (e) {
        console.error(`[Micra] bus error [${event}]:`, e);
      }
    });
  }

  // src/core/reactive.ts
  function createReactiveState(obj, schedule) {
    return new Proxy(obj, {
      set(target, key, value) {
        ;
        target[key] = value;
        schedule();
        return true;
      }
    });
  }
  function createScheduler(render) {
    let pending = false;
    return function schedule() {
      if (pending) return;
      pending = true;
      Promise.resolve().then(() => {
        pending = false;
        render();
      });
    };
  }

  // src/dom/query.ts
  function queryAll(root, sel) {
    return Array.from(root.querySelectorAll(sel));
  }
  function queryOwn(root, attr) {
    return filterOwn(root, queryAll(root, `[${attr}]`));
  }
  function queryOwnAll(root, sel) {
    return filterOwn(root, queryAll(root, sel));
  }
  function filterOwn(root, els) {
    return els.filter((el) => {
      let node = el.parentElement;
      while (node && node !== root) {
        if (node.hasAttribute("data-component")) return false;
        node = node.parentElement;
      }
      return true;
    });
  }

  // src/dom/directives.ts
  function applyText(el, expr, state) {
    var _a;
    const text = String((_a = evalExpr(expr, state)) != null ? _a : "");
    if (el.textContent !== text) el.textContent = text;
  }
  function applyHtml(el, expr, state) {
    var _a;
    el.innerHTML = String((_a = evalExpr(expr, state)) != null ? _a : "");
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
    el.style.display = evalExpr(expr, state) ? "" : "none";
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
  function parsePairs(expr) {
    const out = [];
    for (const part of expr.split(",")) {
      const colonIdx = part.indexOf(":");
      if (colonIdx === -1) continue;
      const left = part.slice(0, colonIdx).trim();
      const right = part.slice(colonIdx + 1).trim();
      if (!left) continue;
      out.push([left, right]);
    }
    return out;
  }
  function applyModel(el, key, rawState) {
    const html = el;
    const stateVal = rawState[key];
    const desired = stateVal == null ? "" : String(stateVal);
    if (html.value !== desired) html.value = desired;
  }
  function buildCache(root) {
    const pick = (attr) => {
      var _a;
      const els = queryOwn(root, attr);
      if ((_a = root.hasAttribute) == null ? void 0 : _a.call(root, attr)) els.unshift(root);
      return els.filter((el) => !el.closest("template")).map((el) => ({ el, expr: el.getAttribute(attr) }));
    };
    const pickPairs = (attr) => pick(attr).map((b) => ({ ...b, pairs: parsePairs(b.expr) }));
    return {
      text: pick("data-text"),
      html: pick("data-html"),
      if: pick("data-if"),
      show: pick("data-show"),
      bind: pickPairs("data-bind"),
      model: pick("data-model"),
      class: pickPairs("data-class")
    };
  }
  function applyDirectives(root, state, rawState, _instance) {
    if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      applyFromList(buildFragmentList(root), state, rawState);
      return;
    }
    const el = root;
    if (!el.__micraCache) el.__micraCache = buildCache(el);
    applyFromList(el.__micraCache, state, rawState);
  }
  function applyFromList(cache, state, rawState) {
    cache.if.forEach((b) => applyIf(b, state));
    cache.text.forEach((b) => applyText(b.el, b.expr, state));
    cache.html.forEach((b) => applyHtml(b.el, b.expr, state));
    cache.show.forEach((b) => applyShow(b.el, b.expr, state));
    cache.bind.forEach((b) => applyBind(b.el, b.pairs, state));
    cache.model.forEach((b) => applyModel(b.el, b.expr.trim(), rawState));
    cache.class.forEach((b) => applyClass(b.el, b.pairs, state));
  }
  function buildFragmentList(frag) {
    const pick = (attr) => queryAll(frag, `[${attr}]`).filter((el) => !el.closest("template")).map((el) => ({ el, expr: el.getAttribute(attr) }));
    const pickPairs = (attr) => pick(attr).map((b) => ({ ...b, pairs: parsePairs(b.expr) }));
    return {
      text: pick("data-text"),
      html: pick("data-html"),
      if: pick("data-if"),
      show: pick("data-show"),
      bind: pickPairs("data-bind"),
      model: pick("data-model"),
      class: pickPairs("data-class")
    };
  }
  function validateDirectives(root) {
    var _a, _b;
    queryOwn(root, "data-each").forEach((el) => {
      const tmpl = el;
      if (!el.hasAttribute("data-key") && !tmpl.__micraNoKeyWarned) {
        tmpl.__micraNoKeyWarned = true;
        warn(`data-each="${el.getAttribute("data-each")}" has no data-key \u2014 keyed diff disabled. Add data-key="id" for better performance.`);
      }
    });
    const bindEls = queryOwn(root, "data-bind");
    if (((_a = root.hasAttribute) == null ? void 0 : _a.call(root, "data-bind")) && !bindEls.includes(root)) bindEls.unshift(root);
    for (const el of bindEls) {
      const spec = (_b = el.getAttribute("data-bind")) != null ? _b : "";
      const hasClassBind = spec.split(",").some((p) => {
        var _a2;
        return ((_a2 = p.trim().split(":")[0]) == null ? void 0 : _a2.trim()) === "class";
      });
      if (hasClassBind && el.hasAttribute("data-class")) {
        warn(`element has both data-bind="class:..." and data-class \u2014 they fight on every render. Use one.`);
      }
    }
  }

  // src/dom/events.ts
  function track(instance, el, type, fn) {
    var _a;
    el.addEventListener(type, fn);
    ((_a = instance.__micraListeners) != null ? _a : instance.__micraListeners = []).push({ el, type, fn });
  }
  function bindDataOn(root, instance) {
    var _a, _b;
    const isFragment = root.nodeType === 11;
    const els = isFragment ? queryAll(root, "[data-on]") : queryOwn(root, "data-on");
    if (!isFragment && ((_a = root.hasAttribute) == null ? void 0 : _a.call(root, "data-on")) && !els.includes(root))
      els.unshift(root);
    for (const el of els) {
      const mEl = el;
      if (mEl.__micraEvents) continue;
      mEl.__micraEvents = true;
      const spec = (_b = mEl.dataset["on"]) != null ? _b : "";
      for (const part of spec.split(",")) {
        const [evSpec, method] = part.trim().split(":");
        if (!evSpec || !method) continue;
        const [evName, ...mods] = evSpec.split(".");
        track(instance, el, evName, (e) => {
          if (mods.includes("prevent")) e.preventDefault();
          if (mods.includes("stop")) e.stopPropagation();
          if (mods.includes("self") && e.target !== el) return;
          const fn = instance[method.trim()];
          if (typeof fn === "function") fn.call(instance, e);
          else warn(`method "${method.trim()}" not found`);
        });
      }
    }
  }
  function bindAtEvents(root, instance) {
    const isFragment = root.nodeType === 11;
    const all = isFragment ? queryAll(root, "*") : queryOwnAll(root, "*");
    if (!isFragment && !all.includes(root)) all.unshift(root);
    for (const el of all) {
      const mEl = el;
      if (mEl.__micraAtBound) continue;
      let bound = false;
      for (const attr of Array.from(el.attributes)) {
        if (!attr.name.startsWith("@")) continue;
        const [evSpec, ...rest] = attr.name.slice(1).split(".");
        const method = attr.value.trim();
        track(instance, el, evSpec, (e) => {
          if (rest.includes("prevent")) e.preventDefault();
          if (rest.includes("stop")) e.stopPropagation();
          if (rest.includes("self") && e.target !== el) return;
          const fn = instance[method];
          if (typeof fn === "function") fn.call(instance, e);
          else warn(`method "${method}" not found`);
        });
        bound = true;
      }
      if (bound) mEl.__micraAtBound = true;
    }
  }
  function bindModels(root, instance) {
    var _a;
    const isFragment = root.nodeType === 11;
    const els = isFragment ? queryAll(root, "[data-model]") : queryOwn(root, "data-model");
    for (const el of els) {
      const mEl = el;
      if (mEl.__micraModel) continue;
      mEl.__micraModel = true;
      const key = (_a = el.dataset["model"]) != null ? _a : "";
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

  // src/dom/each.ts
  function renderList(root, state, rawState, instance) {
    queryOwn(root, "data-each").forEach((tmplEl) => {
      var _a;
      if (tmplEl.tagName !== "TEMPLATE") return;
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
      const parent = marker.parentNode;
      if (!parent) return;
      if (!Array.isArray(items)) {
        tmpl.__micraList.forEach((n) => n.remove());
        tmpl.__micraList = [];
        keyMap.clear();
        return;
      }
      if (keyAttr) {
        renderKeyed(tmpl, items, keyAttr, marker, keyMap, parent, state, rawState, instance);
      } else {
        renderNoKey(tmpl, items, marker, parent, state, rawState, instance);
      }
    });
  }
  function renderKeyed(tmpl, items, keyAttr, marker, keyMap, parent, state, rawState, instance) {
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
        const frag = tmpl.content.cloneNode(true);
        if (frag.childNodes.length === 1) {
          node = frag.firstElementChild;
        } else {
          node = document.createElement("micra-each-item");
          node.style.display = "contents";
          node.append(frag);
        }
        node.__micraKey = key;
        keyMap.set(key, node);
        bindDataOn(node, instance);
        bindAtEvents(node, instance);
      }
      const itemState = Object.assign(
        Object.create(state),
        { item, index, $index: index }
      );
      applyDirectives(node, itemState, rawState, instance);
      nextNodes.push(node);
    }
    for (const [key, node] of keyMap) {
      if (!nextKeys.has(key)) {
        node.remove();
        keyMap.delete(key);
      }
    }
    let cursor = marker;
    for (const node of nextNodes) {
      if (cursor.nextSibling !== node) parent.insertBefore(node, cursor.nextSibling);
      cursor = node;
    }
    tmpl.__micraList = nextNodes;
  }
  function renderNoKey(tmpl, items, marker, parent, state, rawState, instance) {
    tmpl.__micraList.forEach((n) => n.remove());
    tmpl.__micraList = [];
    const frag = document.createDocumentFragment();
    for (const [index, item] of items.entries()) {
      const clone = tmpl.content.cloneNode(true);
      const itemState = Object.assign(
        Object.create(state),
        { item, index, $index: index }
      );
      applyDirectives(clone, itemState, rawState, instance);
      bindDataOn(clone, instance);
      bindAtEvents(clone, instance);
      const nodes = Array.from(clone.childNodes);
      nodes.forEach((n) => {
        n.__micraEach = true;
        frag.append(n);
      });
      tmpl.__micraList.push(...nodes);
    }
    parent.insertBefore(frag, marker.nextSibling);
  }

  // src/dom/refs.ts
  function collectRefs(root, instance) {
    instance.refs = {};
    for (const el of queryOwn(root, "data-ref")) {
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
    if (_instances.has(root)) return _instances.get(root);
    const rawState = { ...(_a = definition.state) != null ? _a : {} };
    const instance = { $el: root, refs: {} };
    for (const [key, val] of Object.entries(definition)) {
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
    const schedule = createScheduler(() => instance.render());
    instance.state = createReactiveState(rawState, schedule);
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
    let warnedReentry = false;
    instance.render = function() {
      if (instance.__micraDestroyed) return;
      if (isRendering) {
        if (!warnedReentry) {
          warn("render() re-entry detected \u2014 mutation inside a directive expression is ignored. Move state writes to a method.");
          warnedReentry = true;
        }
        return;
      }
      isRendering = true;
      try {
        applyDirectives(root, exprState, rawState, instance);
        renderList(root, exprState, rawState, instance);
        bindDataOn(root, instance);
        bindAtEvents(root, instance);
        bindModels(root, instance);
        collectRefs(root, instance);
      } finally {
        isRendering = false;
      }
    };
    instance.destroy = function() {
      var _a2, _b;
      if (instance.__micraDestroyed) return;
      instance.__micraDestroyed = true;
      (_a2 = instance.__micraListeners) == null ? void 0 : _a2.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
      instance.__micraListeners = [];
      const clearFlags = (el) => {
        const m = el;
        delete m.__micraEvents;
        delete m.__micraAtBound;
        delete m.__micraModel;
        delete m.__micraCache;
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
    validateDirectives(root);
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
