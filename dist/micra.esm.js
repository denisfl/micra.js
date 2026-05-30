/* Micra.js v2.2.1 — https://github.com/micra-js/micra — MIT */

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
  let cached = exprCache.get(expr);
  if (!cached) {
    if (SIMPLE_PATH.test(expr)) {
      cached = { kind: "path", parts: expr.split(".") };
    } else {
      try {
        cached = {
          kind: "fn",
          fn: new Function("$s", "$safe", `with($safe){with($s){return (${expr})}}`)
        };
      } catch {
        warn(`invalid expression "${expr}"`);
        cached = { kind: "fn", fn: () => void 0 };
      }
    }
    exprCache.set(expr, cached);
  }
  if (cached.kind === "path") {
    if (!safeStateHas(state, cached.parts[0])) return void 0;
    return cached.parts.reduce(
      (obj, key) => obj != null ? obj[key] : void 0,
      state
    );
  }
  try {
    return cached.fn(safeStateWrap(state), SAFE_OUTER);
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
  return function schedule() {
    if (pending) return;
    pending = true;
    Promise.resolve().then(() => {
      pending = false;
      render();
    });
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
function applyDirectives(scan, state, rawState, _instance) {
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
function bindAtEvents(els, instance) {
  for (const el of els) {
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
function scanFragment(frag) {
  const scan = emptyScan();
  const walker = document.createTreeWalker(
    frag,
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
      renderNoKey(tmpl, items, marker, state, rawState, instance);
    }
  }
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
      const rowScan2 = scanComponent(node);
      node.__micraScan = rowScan2;
      bindDataOn(rowScan2.on, instance);
      bindAtEvents(rowScan2.atEvents, instance);
      bindModels(rowScan2.model, instance);
      node._itemState = Object.create(state);
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
    applyDirectives(rowScan, itemState, rawState, instance);
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
function renderNoKey(tmpl, items, marker, state, rawState, instance) {
  tmpl.__micraList.forEach((n) => n.remove());
  tmpl.__micraList = [];
  const frag = document.createDocumentFragment();
  for (const [index, item] of items.entries()) {
    const clone = tmpl.content.cloneNode(true);
    const itemState = Object.assign(
      Object.create(state),
      { item, index, $index: index }
    );
    const fragScan = scanFragment(clone);
    applyDirectives(fragScan, itemState, rawState, instance);
    bindDataOn(fragScan.on, instance);
    bindAtEvents(fragScan.atEvents, instance);
    bindModels(fragScan.model, instance);
    const nodes = Array.from(clone.childNodes);
    nodes.forEach((n) => {
      n.__micraEach = true;
      frag.append(n);
    });
    tmpl.__micraList.push(...nodes);
  }
  marker.after(frag);
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
      applyDirectives(scan, exprState, rawState, instance);
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
export {
  FetchError,
  debug,
  define,
  defineComponent,
  emit,
  instances,
  mount,
  off,
  on,
  registry,
  start
};
//# sourceMappingURL=micra.esm.js.map
