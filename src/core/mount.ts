/**
 * src/core/mount.ts — Mount a component definition onto a DOM element.
 *
 * Responsibilities:
 *   - Create and initialize an InternalInstance
 *   - Set up reactive state + batch scheduler
 *   - Wire render(), destroy(), prop(), fetch(), on(), emit()
 *   - Run initial render + call onCreate() in a microtask
 *
 * LLM NOTE: This is the core of the Micra runtime.
 * mount() is called by both the public Micra.mount() API and by start()
 * (which scans the DOM for [data-component] elements).
 */

import type {
  ComponentDefinition,
  ComponentInstance,
  ComponentMethods,
  EventHandler,
  InternalInstance,
  MicraElement,
  StateRecord,
  UnsubFn,
} from "../types";
import { warn } from "../utils/expr";
import { micraFetch } from "../utils/fetch";
import { on as busOn, emit as busEmit } from "../core/bus";
import { createReactiveState, createScheduler } from "../core/reactive";
import { applyDirectives, validateDirectives } from "../dom/directives";
import { renderList } from "../dom/each";
import { bindDataOn, bindAtEvents, bindModels } from "../dom/events";
import { collectRefs } from "../dom/refs";
import { scanComponent } from "../dom/scan";
import { _instances } from "../core/registry";

/**
 * Mount a component definition onto a DOM element.
 * Returns the component instance, or null if the root element is not found.
 *
 * Already-mounted elements return the existing instance.
 *
 * Both `S` (state) and `M` (methods) are inferred from the literal — the
 * returned instance is fully typed: `inst.state.X` and `inst.someMethod()`
 * are checked.
 *
 * @example
 * const instance = Micra.mount('#counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },
 * })
 * instance?.inc()
 * instance?.state.count
 */
export function mount<S extends StateRecord, M>(
  selector: string | HTMLElement,
  definition: ComponentDefinition<S, M>,
): ComponentInstance<S, M> | null {
  const root =
    typeof selector === "string"
      ? document.querySelector<HTMLElement>(selector)
      : selector;

  if (!root) {
    warn(`"${selector}" not found`);
    return null;
  }

  // Already mounted — return existing instance without re-mounting
  if (_instances.has(root))
    return _instances.get(root) as unknown as ComponentInstance<S, M>;

  const rawState: StateRecord = { ...(definition.state ?? {}) };
  const instance = { $el: root, refs: {} } as InternalInstance<S>;

  // Copy user-defined methods from definition to instance
  for (const [key, val] of Object.entries(
    definition as Record<string, unknown>,
  )) {
    if (key === "state" || key === "onCreate" || key === "onDestroy") continue;
    if (typeof val === "function") instance[key] = val;
  }

  // ── prop() ────────────────────────────────────────────────────────────────
  // Read data-* attributes from the root element with auto-cast.
  instance.prop = function <T>(name: string, defaultVal?: T): T | undefined {
    const val = root.dataset[name];
    if (val === undefined) return defaultVal;
    if (val === "true") return true as unknown as T;
    if (val === "false") return false as unknown as T;
    if (val !== "" && !isNaN(Number(val))) return Number(val) as unknown as T;
    return val as unknown as T;
  } as ComponentInstance<S>["prop"];

  // ── fetch(), emit(), on() ─────────────────────────────────────────────────
  instance.fetch = micraFetch;
  instance.emit = busEmit;

  instance.on = <T = unknown>(
    event: string,
    handler: EventHandler<T>,
  ): UnsubFn => {
    const unsub = busOn(event, handler);
    if (!instance.__micraSubs) instance.__micraSubs = [];
    instance.__micraSubs.push(unsub);
    return unsub;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  let isRendering = false;
  const schedule = createScheduler(() => instance.render());
  instance.state = createReactiveState(rawState, schedule) as S;

  // Expression state: proxy that falls back to instance methods so expressions
  // like `data-text="formatDate(item.date)"` can call component methods.
  //
  // Instance methods are returned BOUND to the instance — directive expressions
  // call them as bare identifiers via `with()`, which would normally lose `this`.
  // Bound copies are memoized per method name so repeated reads are cheap.
  //
  // Both traps reject Object.prototype names ('constructor', 'toString', ...) —
  // accessing them via a directive expression returns undefined instead of
  // leaking the prototype.
  const boundMethods = new Map<string, Function>();
  const exprState = new Proxy(rawState, {
    get(target, key: string) {
      if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
      if (
        Object.prototype.hasOwnProperty.call(instance, key) &&
        typeof instance[key] === "function"
      ) {
        const cached = boundMethods.get(key);
        if (cached) return cached;
        const bound = (instance[key] as Function).bind(instance);
        boundMethods.set(key, bound);
        return bound;
      }
      return undefined;
    },
    has(target, key: string) {
      if (typeof key !== "string") return false;
      if (Object.prototype.hasOwnProperty.call(target, key)) return true;
      return (
        Object.prototype.hasOwnProperty.call(instance, key) &&
        typeof instance[key] === "function"
      );
    },
  });

  let warnedReentry = false;
  instance.render = function () {
    if (instance.__micraDestroyed) return;
    if (isRendering) {
      if (!warnedReentry) {
        warn(
          "render() re-entry detected — mutation inside a directive expression is ignored. Move state writes to a method.",
        );
        warnedReentry = true;
      }
      return;
    }
    isRendering = true;
    try {
      // Single-pass scan, cached on the root for re-renders. Replaces what
      // used to be ~10 separate querySelectorAll passes per render.
      const mRoot = root as MicraElement;
      const scan =
        mRoot.__micraScan ?? (mRoot.__micraScan = scanComponent(root));
      applyDirectives(scan, exprState, rawState, instance);
      renderList(scan.each, exprState, rawState, instance);
      bindDataOn(scan.on, instance);
      bindAtEvents(scan.atEvents, instance);
      bindModels(scan.model, instance);
      collectRefs(scan.refs, instance);
    } finally {
      isRendering = false;
    }
  };

  // ── Destroy ───────────────────────────────────────────────────────────────
  instance.destroy = function () {
    if (instance.__micraDestroyed) return;
    instance.__micraDestroyed = true;

    // Remove every DOM listener attached by bindDataOn / bindAtEvents / bindModels.
    instance.__micraListeners?.forEach(({ el, type, fn }) =>
      el.removeEventListener(type, fn),
    );
    instance.__micraListeners = [];

    // Clear per-element flags & cached directive scan so a future re-mount of the same DOM works.
    const clearFlags = (el: Element) => {
      const m = el as MicraElement;
      delete m.__micraEvents;
      delete m.__micraAtBound;
      delete m.__micraModel;
      delete m.__micraScan;
    };
    clearFlags(root);
    root.querySelectorAll("*").forEach(clearFlags);

    instance.__micraSubs?.forEach((unsub) => unsub());
    instance.__micraSubs = [];

    if (typeof (definition as Record<string, unknown>).onDestroy === "function")
      (definition.onDestroy as () => void).call(instance);
    _instances.delete(root);
  };

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  _instances.set(root, instance as InternalInstance);
  instance.render();

  // Validate directive usage and emit dev warnings — reuses the same scan.
  const mRoot = root as MicraElement;
  if (mRoot.__micraScan) validateDirectives(mRoot.__micraScan);

  if (typeof (definition as Record<string, unknown>).onCreate === "function")
    Promise.resolve().then(() =>
      (definition.onCreate as () => void | Promise<void>).call(instance),
    );

  return instance as unknown as ComponentInstance<S, M>;
}
