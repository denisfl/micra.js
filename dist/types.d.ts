/**
 * src/types.ts — All Micra.js type definitions.
 *
 * Public types are re-exported from src/index.ts.
 * Internal types (MicraElement, MicraTemplate, InternalInstance) are used by
 * implementation modules but are NOT part of the public API.
 */
/**
 * Constraint for component state objects.
 * Use any plain object: `{ count: 0, items: [] as User[] }`.
 */
export type StateRecord = Record<string, unknown>;
/** Returns an unsubscribe function. */
export type UnsubFn = () => void;
/** Event bus handler. Generic `T` types the payload. */
export type EventHandler<T = unknown> = (payload: T) => void;
/**
 * Type-safe event bus registry. Empty by default — augment it via
 * declaration merging to type your application's events.
 *
 * @example
 * declare module 'micra.js' {
 *   interface MicraEvents {
 *     'cart:updated': { count: number }
 *     'user:login':   { id: number; name: string }
 *     'modal:close':  void
 *   }
 * }
 *
 * Micra.emit('cart:updated', { count: 3 })       // ✓ typed
 * Micra.emit('cart:updated', { count: '3' })     // ✗ type error
 * Micra.on('user:login', user => user.id)        // user: { id, name }
 *
 * Events not present in the interface fall back to `unknown` payload —
 * fully backward-compatible with untyped usage.
 */
export interface MicraEvents {
}
/**
 * Resolves the payload type for an event key. For keys registered in
 * `MicraEvents` returns the declared payload; for any other string key
 * returns `unknown` (preserving backward compatibility).
 */
export type EventPayload<K extends string> = K extends keyof MicraEvents ? MicraEvents[K] : unknown;
/**
 * Tuple of arguments passed to `emit` after the event name. When the
 * payload type for a known event includes `undefined` (or the payload is
 * declared as `void`), the argument is optional. For known events with a
 * required payload, the argument is required. Unknown events accept any
 * optional payload (backward compat).
 */
export type EmitArgs<K extends string> = K extends keyof MicraEvents ? [MicraEvents[K]] extends [void] ? [payload?: undefined] : undefined extends MicraEvents[K] ? [payload?: MicraEvents[K]] : [payload: MicraEvents[K]] : [payload?: unknown];
/** Options for `this.fetch()`. For GET/HEAD extra keys become query params. */
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    /** POST/PUT/PATCH body — serialized as JSON. */
    body?: unknown;
    [key: string]: unknown;
}
/**
 * User-defined methods on a component definition. Any function-shaped property
 * other than `state`, `onCreate`, `onDestroy` is treated as a method.
 *
 * LLM NOTE: this type is used as a structural HINT only — `M` in
 * ComponentDefinition is unconstrained so TS can infer it from the literal
 * without rejecting non-function siblings like `state`. The `[key: string]`
 * shape here just documents intent.
 */
export type ComponentMethods = Record<string, (...args: any[]) => any>;
/**
 * Built-in slots every instance gets: state, refs, $el, and the methods Micra
 * itself injects (render, destroy, prop, fetch, emit, on). Kept separate from
 * `M` so user methods can't accidentally shadow these names.
 */
export interface ComponentBuiltins<S extends StateRecord = StateRecord> {
    /** The root DOM element this component is mounted on. */
    readonly $el: HTMLElement;
    /** Reactive state — any assignment triggers a batched re-render. */
    state: S;
    /**
     * DOM refs: collect elements with `data-ref="name"` → `this.refs.name`.
     * @example <canvas data-ref="chart"> → this.refs.chart
     */
    refs: Record<string, HTMLElement>;
    /** Force a synchronous re-render. Normally not needed — state mutations batch automatically. */
    render(): void;
    /** Unmount: clean up event bus subscriptions and call onDestroy. */
    destroy(): void;
    /**
     * Read a `data-*` attribute from the root element with auto-cast.
     * Casts "true"/"false" → boolean, numeric strings → number.
     * @example this.prop('perPage', 10) // data-per-page="20" → 20
     */
    prop(name: string): string | undefined;
    prop<T>(name: string, defaultVal: T): T;
    /** Fetch helper: CSRF header, JSON body, query params, typed errors. */
    fetch(url: string, options?: FetchOptions): Promise<unknown>;
    /**
     * Publish an event on the global bus.
     * Payload is typed via the `MicraEvents` interface (augmentable).
     */
    emit<K extends string>(event: K, ...args: EmitArgs<K>): void;
    /**
     * Subscribe to the global bus. Subscription is auto-removed on destroy().
     * Handler payload is typed via the `MicraEvents` interface (augmentable).
     */
    on<K extends string>(event: K, handler: (payload: EventPayload<K>) => void): UnsubFn;
}
/**
 * The `this` context inside component methods and lifecycle hooks.
 * `S` is inferred from the component's `state` object; `M` is inferred from
 * the methods on the same definition object. Both `this.state.X` and
 * `this.someMethod()` are fully typed inside method bodies.
 *
 * @example
 * Micra.define('counter', {
 *   state: { count: 0 },
 *   inc() {
 *     this.state.count++   // this.state.count: number ✓
 *     this.dec()           // this.dec: () => void ✓
 *     // this.foo()        // ❌ Property 'foo' does not exist
 *   },
 *   dec() { this.state.count-- },
 * })
 */
export type ComponentInstance<S extends StateRecord = StateRecord, M = ComponentMethods> = ComponentBuiltins<S> & M;
/**
 * Component definition passed to `Micra.define` or `Micra.mount`.
 *
 * Both `S` (state shape) and `M` (method set) are inferred from the literal.
 * All methods and lifecycle hooks receive `this: ComponentInstance<S, M>` via
 * `ThisType<>` — so `this.state.X` and `this.someMethod()` are both typed.
 *
 * LLM NOTE: `M` is intentionally unconstrained here. A constraint like
 * `M extends ComponentMethods` would force every property in the literal to
 * be a function — which would reject `state`. Without the constraint, TS
 * structurally infers `M` as "everything in the literal except the known
 * lifecycle/state keys", which is exactly what we want.
 *
 * @example
 * Micra.define('counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },  // this.state.count: number ✓
 * })
 */
export type ComponentDefinition<S extends StateRecord = StateRecord, M = ComponentMethods> = {
    /** Initial flat state. Becomes reactive on mount. */
    state?: S;
    /**
     * Called once after mount in a microtask — safe for async data fetching.
     * @example async onCreate() { this.state.data = await this.fetch('/api/data') }
     */
    onCreate?(): void | Promise<void>;
    /**
     * Called on destroy — clean up DOM listeners, timers, etc.
     * Event bus subscriptions added via `this.on()` are cleaned up automatically.
     */
    onDestroy?(): void;
} & M & ThisType<ComponentInstance<S, M>>;
/**
 * @internal Extended HTMLElement with Micra bookkeeping slots.
 */
export interface MicraElement extends HTMLElement {
    __micraModel?: true;
    __micraEvents?: true;
    __micraAtBound?: true;
    __micraScan?: ScanIndex;
    __micraItem?: StateRecord;
    __micraIndex?: number;
    _itemState?: StateRecord;
}
/**
 * @internal A DOM listener tracked for cleanup on destroy().
 */
export interface TrackedListener {
    el: Element;
    type: string;
    fn: EventListener;
}
/**
 * @internal Extended HTMLTemplateElement with keyed-diff state.
 */
export interface MicraTemplate extends HTMLTemplateElement {
    __micraMarker?: Comment;
    __micraNodes: Map<unknown, MicraElement>;
    __micraList: MicraElement[];
    __micraNoKeyWarned?: true;
}
/**
 * @internal Per-element directive binding (element + expression string).
 */
export interface CachedBinding {
    el: Element;
    expr: string;
}
/**
 * @internal data-if binding — like CachedBinding but also carries the
 * placeholder Comment that takes the element's slot in the DOM while the
 * element is detached (unmounted).
 */
export interface CachedIfBinding extends CachedBinding {
    placeholder?: Comment;
}
/**
 * @internal Per-element directive binding with pre-parsed pairs.
 * Used by `data-bind` and `data-class` — both share the
 * `name:expression[, name:expression…]` syntax.
 */
export interface CachedPairBinding {
    el: Element;
    expr: string;
    pairs: ReadonlyArray<readonly [string, string]>;
}
/**
 * @internal Single-pass scan result — built once per Element via one TreeWalker
 * traversal, reused every render. This is the core of the performance
 * optimization: instead of 10+ querySelectorAll calls per render, the scanner
 * classifies every directive/event/ref attribute in a single DOM walk.
 *
 * LLM NOTE: ScanIndex is built lazily on first render and stored on
 * `el.__micraScan`. Subsequent renders skip the scan entirely.
 */
export interface ScanIndex {
    text: CachedBinding[];
    html: CachedBinding[];
    if: CachedIfBinding[];
    show: CachedBinding[];
    bind: CachedPairBinding[];
    model: CachedBinding[];
    class: CachedPairBinding[];
    each: Element[];
    on: Element[];
    atEvents: Element[];
    refs: Element[];
}
/**
 * @internal Full instance as seen inside the runtime — extends the public
 * built-ins with private bookkeeping slots and an index signature for
 * dynamic method dispatch.
 *
 * Note: internally we don't carry the user-method generic `M`. Internal modules
 * dispatch methods by string name (`instance[methodName]()`), which is what
 * the index signature is for. The public `mount()` return value re-projects
 * to `ComponentInstance<S, M>` so callers get full type inference.
 */
export interface InternalInstance<S extends StateRecord = StateRecord> extends ComponentBuiltins<S> {
    __micraSubs?: UnsubFn[];
    __micraListeners?: TrackedListener[];
    __micraDestroyed?: true;
    [key: string]: unknown;
}
