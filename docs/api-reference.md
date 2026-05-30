# API Reference

## Core functions

### `Micra.define()`

```ts
function define<S extends StateRecord>(
  name: string,
  definition: ComponentDefinition<S>,
): void;
```

Registers a component definition by name for later use with `data-component` and `Micra.start()`.

- **name**: component name used in `data-component`
- **definition**: component object
- **returns**: `void`

Example:

```ts
Micra.define("counter", {
  state: { count: 0 },
  increment() {
    this.state.count++;
  },
});
```

### `Micra.defineComponent()`

```ts
function defineComponent<S extends StateRecord>(
  definition: ComponentDefinition<S>,
): ComponentDefinition<S>;
```

Type helper for TypeScript inference. Returns the same definition object.

- **definition**: component object
- **returns**: the same typed definition

Example:

```ts
const counter = Micra.defineComponent({
  state: { count: 0 },
  increment() {
    this.state.count++;
  },
});

Micra.define("counter", counter);
```

### `Micra.mount()`

```ts
function mount<S extends StateRecord>(
  selector: string | HTMLElement,
  definition: ComponentDefinition<S>,
): ComponentInstance<S> | null;
```

Mounts a component directly onto an element.

- **selector**: CSS selector or root element
- **definition**: component object
- **returns**: the instance, or `null` if the element is not found

Notes:

- if the root is already mounted, the existing instance is returned
- initial render runs immediately
- `onCreate` runs after mount in a microtask

Example:

```ts
const instance = Micra.mount("#counter", {
  state: { count: 0 },
  increment() {
    this.state.count++;
  },
});
```

### `Micra.start()`

```ts
function start(root?: Document | HTMLElement): void;
```

Scans a document or subtree for `[data-component]` and mounts registered components.

- **root**: optional document or subtree root
- **returns**: `void`

Example:

```ts
Micra.start();
Micra.start(document.getElementById("sidebar")!);
```

### `Micra.on()`

```ts
function on<K extends string>(
  event: K,
  handler: (payload: EventPayload<K>) => void,
): UnsubFn;
```

Subscribes to a global event. Payload type is resolved through the
augmentable [`MicraEvents`](#micraevents) interface — events not declared
there fall back to `unknown` (backward-compatible with untyped usage).

- **event**: event name
- **handler**: callback for the payload
- **returns**: unsubscribe function

Example:

```ts
const unsub = Micra.on("user:updated", (user) => {
  console.log(user);
});
```

### `Micra.off()`

```ts
function off<K extends string>(
  event: K,
  handler: (payload: EventPayload<K>) => void,
): void;
```

Removes a specific global event handler.

- **event**: event name
- **handler**: previously registered handler
- **returns**: `void`

Example:

```ts
function onOpen() {
  console.log("opened");
}

Micra.on("modal:open", onOpen);
Micra.off("modal:open", onOpen);
```

### `Micra.emit()`

```ts
function emit<K extends string>(event: K, ...args: EmitArgs<K>): void;
```

Publishes an event on the global bus. When the event is declared in
[`MicraEvents`](#micraevents), the payload type and arity are enforced
by the compiler — required if the declared payload doesn't include
`undefined`/`void`, optional otherwise. Unknown events accept any
optional payload.

- **event**: event name
- **payload**: typed by `MicraEvents` if declared, otherwise `unknown`
- **returns**: `void`

Example:

```ts
Micra.emit("modal:open");
Micra.emit("toast:show", { type: "success", message: "Saved" });
```

### `Micra.instances()`

```ts
function instances(): ReadonlyMap<HTMLElement, ComponentInstance>;
```

Returns the live instance map keyed by root element.

- **returns**: read-only instance map

Example:

```ts
for (const [el, instance] of Micra.instances()) {
  console.log(el, instance);
}
```

### `Micra.registry()`

```ts
function registry(): ReadonlyMap<string, ComponentDefinition>;
```

Returns the registered component definition map.

- **returns**: read-only registry map

Example:

```ts
console.log(Micra.registry().has("counter"));
```

### `Micra.debug()`

```ts
function debug(): void;
```

Prints all live component instances to the browser console grouped by component name.

- **returns**: `void`

Example:

```ts
Micra.debug();
// [Micra] 3 live component(s)
//   counter   $el: <div>  state: { count: 5 }
//   user-list $el: <div>  state: { users: [...], loading: false }
```

Use this during development to inspect which components are mounted and what state they hold.

## Component instance

`this` inside component methods is a `ComponentInstance<S>`.

### `$el`

```ts
readonly $el: HTMLElement
```

The root element.

### `state`

```ts
state: S;
```

Reactive component state. Assigning a top-level property schedules a batched re-render.

### `refs`

```ts
refs: Record<string, HTMLElement>;
```

Collected descendant refs from `data-ref="name"`.

Example:

```html
<canvas data-ref="chart"></canvas>
```

```ts
onCreate() {
  this.refs.chart
}
```

### `render()`

```ts
render(): void
```

Forces an immediate synchronous render.

### `destroy()`

```ts
destroy(): void
```

Unmounts the instance, unsubscribes `this.on()` listeners, and calls `onDestroy`.

### `prop()`

```ts
prop(name: string): string | undefined
prop<T>(name: string, defaultVal: T): T
```

Reads a `data-*` value from the root element and auto-casts booleans and numbers.

- **name**: dataset-style key
- **defaultVal**: optional fallback
- **returns**: cast value or fallback

Example:

```html
<section data-component="report" data-page="2" data-show-chart="true"></section>
```

```ts
this.prop("page", 1); // 2
this.prop("showChart", false); // true
```

### `fetch()`

```ts
fetch(url: string, options?: FetchOptions): Promise<unknown>
```

Fetch wrapper with JSON/text parsing, query param support for GET/HEAD, JSON body support for write requests, and automatic CSRF header lookup.

- **url**: request URL
- **options**: fetch helper options
- **returns**: parsed JSON or text
- **throws**: `FetchError` on non-2xx responses

Example:

```ts
await this.fetch("/api/users", { page: 2, status: "active" });
await this.fetch("/api/invite", {
  method: "POST",
  body: { email: "ana@example.com" },
});
```

### `emit()`

```ts
emit<K extends string>(event: K, ...args: EmitArgs<K>): void
```

Shortcut to `Micra.emit()`. Same `MicraEvents` typing rules apply.

### `on()`

```ts
on<K extends string>(event: K, handler: (payload: EventPayload<K>) => void): UnsubFn
```

Shortcut to `Micra.on()` with auto-cleanup on destroy. Payload typed
via `MicraEvents`.

## Public types

### `StateRecord`

```ts
type StateRecord = Record<string, unknown>;
```

Base constraint for component state objects.

### `UnsubFn`

```ts
type UnsubFn = () => void;
```

Returned by `Micra.on()` and `this.on()`.

### `EventHandler`

```ts
type EventHandler<T = unknown> = (payload: T) => void;
```

Generic handler type for the event bus.

### `MicraEvents`

```ts
interface MicraEvents {}
```

Type-safe registry for the global event bus. Empty by default —
augment it via TypeScript declaration merging to type your
application's events. Every declared key is enforced by
`Micra.emit`, `Micra.on`, `this.emit`, and `this.on`. Events absent
from `MicraEvents` fall back to `unknown` payload, so untyped code
keeps working unchanged.

```ts
// types/micra-events.d.ts
import 'micra.js'

declare module 'micra.js' {
  interface MicraEvents {
    'cart:updated': { count: number }
    'user:login':   { id: number; name: string }
    'modal:close':  void
  }
}
```

```ts
Micra.emit('cart:updated', { count: 3 })   // ✓ typed
Micra.emit('cart:updated', { count: '3' }) // ✗ type error
Micra.emit('cart:updated')                 // ✗ payload required
Micra.emit('modal:close')                  // ✓ void payload — no args
Micra.on('user:login', user => user.name)  // user: { id, name }
```

A payload type that includes `undefined` (e.g. `{ x?: T } | undefined`)
makes the `emit` argument optional. Use `void` for events that carry
no payload at all.

### `EventPayload`

```ts
type EventPayload<K extends string> = K extends keyof MicraEvents
  ? MicraEvents[K]
  : unknown;
```

Resolves the handler payload type for an event name.

### `EmitArgs`

```ts
type EmitArgs<K extends string> = K extends keyof MicraEvents
  ? [MicraEvents[K]] extends [void]
    ? [payload?: undefined]
    : undefined extends MicraEvents[K]
      ? [payload?: MicraEvents[K]]
      : [payload: MicraEvents[K]]
  : [payload?: unknown];
```

Tuple of arguments accepted by `emit` after the event name. Encodes
the rules described under [`MicraEvents`](#micraevents): required
payload for declared non-void events, optional otherwise.

### `FetchOptions`

```ts
interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  [key: string]: unknown;
}
```

Options for `this.fetch()`.

Notes:

- on `GET` and `HEAD`, extra keys become query parameters
- on other methods, `body` is JSON-serialized

### `ComponentDefinition`

```ts
type ComponentDefinition<S extends StateRecord = StateRecord> = {
  state?: S;
  onCreate?: () => void | Promise<void>;
  onDestroy?: () => void;
  [method: string]: unknown;
} & ThisType<ComponentInstance<S>>;
```

Defines state, lifecycle hooks, and methods for a component.

Example:

```ts
const modal = Micra.defineComponent({
  state: { open: false },
  open() {
    this.state.open = true;
  },
  close() {
    this.state.open = false;
  },
});
```

### `ComponentInstance`

```ts
interface ComponentInstance<S extends StateRecord = StateRecord> {
  readonly $el: HTMLElement;
  state: S;
  refs: Record<string, HTMLElement>;
  render(): void;
  destroy(): void;
  prop(name: string): string | undefined;
  prop<T>(name: string, defaultVal: T): T;
  fetch(url: string, options?: FetchOptions): Promise<unknown>;
  emit(event: string, payload?: unknown): void;
  on<T = unknown>(event: string, handler: EventHandler<T>): UnsubFn;
}
```

Public instance shape available as `this` inside methods.

### `FetchError`

```ts
class FetchError extends Error {
  readonly status: number;
  readonly response: Response;
}
```

Thrown by `this.fetch()` when the response is not `2xx`.

Example:

```ts
import { FetchError } from "micra";

try {
  await this.fetch("/api/users/404");
} catch (error) {
  if (error instanceof FetchError) {
    console.log(error.status);
  }
}
```
