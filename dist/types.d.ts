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
/** Options for `this.fetch()`. For GET/HEAD extra keys become query params. */
export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    /** POST/PUT/PATCH body — serialized as JSON. */
    body?: unknown;
    [key: string]: unknown;
}
/**
 * The `this` context inside component methods and lifecycle hooks.
 * `S` is inferred from the component's `state` object.
 *
 * @example
 * // state: { count: 0 } → S = { count: number }
 * increment() { this.state.count++ }  // count is number ✓
 */
export interface ComponentInstance<S extends StateRecord = StateRecord> {
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
    /** Publish an event on the global bus. */
    emit(event: string, payload?: unknown): void;
    /** Subscribe to the global bus. Subscription is auto-removed on destroy(). */
    on<T = unknown>(event: string, handler: EventHandler<T>): UnsubFn;
}
/**
 * Component definition passed to `Micra.define` or `Micra.mount`.
 *
 * `S` is inferred from the `state` property — all methods receive
 * `this: ComponentInstance<S>` automatically via `ThisType<>`.
 *
 * @example
 * Micra.define('counter', {
 *   state: { count: 0 },
 *   inc() { this.state.count++ },  // this.state.count: number ✓
 * })
 */
export type ComponentDefinition<S extends StateRecord = StateRecord> = {
    /** Initial flat state. Becomes reactive on mount. */
    state?: S;
    /**
     * Called once after mount in a microtask — safe for async data fetching.
     * @example async onCreate() { this.state.data = await this.fetch('/api/data') }
     */
    onCreate?: () => void | Promise<void>;
    /**
     * Called on destroy — clean up DOM listeners, timers, etc.
     * Event bus subscriptions added via `this.on()` are cleaned up automatically.
     */
    onDestroy?: () => void;
    [method: string]: unknown;
} & ThisType<ComponentInstance<S>>;
/**
 * @internal Extended HTMLElement with Micra bookkeeping slots.
 */
export interface MicraElement extends HTMLElement {
    __micraModel?: true;
    __micraEvents?: true;
    __micraAtBound?: true;
    __micraKey?: unknown;
    __micraEach?: true;
    __micraCache?: DirectiveCache;
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
    __micraList: ChildNode[];
}
/**
 * @internal Per-element directive binding (element + expression string).
 */
export interface CachedBinding {
    el: Element;
    expr: string;
}
/**
 * @internal Directive scan result — built once per Element, reused every render.
 * This is the core of the performance optimization.
 *
 * LLM NOTE: DirectiveCache is built lazily on first render and stored on the
 * element. It avoids repeated querySelectorAll calls on every re-render.
 */
export interface DirectiveCache {
    text: CachedBinding[];
    html: CachedBinding[];
    if: CachedBinding[];
    show: CachedBinding[];
    bind: CachedBinding[];
    model: CachedBinding[];
    class: CachedBinding[];
}
/**
 * @internal Full instance as seen inside the runtime — extends the public
 * interface with private bookkeeping slots and an index signature for
 * dynamic method dispatch.
 */
export interface InternalInstance<S extends StateRecord = StateRecord> extends ComponentInstance<S> {
    __micraSubs?: UnsubFn[];
    __micraListeners?: TrackedListener[];
    __micraDestroyed?: true;
    [key: string]: unknown;
}
