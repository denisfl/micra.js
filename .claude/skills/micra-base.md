# Micra.js — Base Context

Always loaded. Covers philosophy, public API, and hard constraints.

---

## What Micra is

Micra is a **lightweight reactive UI framework for small sites and simple SaaS**, distributed as a single `dist/micra.js` file loaded via `<script src="">`. No build step, no JSX, no virtual DOM.

Target: pages where React/Vue is overkill — marketing sites, admin panels, Hotwire/HTMX complement, server-rendered HTML with interactive islands.

**Size target:** < 7 KB minified + gzipped. Every addition is weighed against this.

---

## Philosophy

- **HTML-first.** Markup carries directives as `data-*` attributes. JS only defines behavior.
- **No build step.** Works from a CDN script tag. Zero toolchain required for the consumer.
- **Shallow reactivity.** A `Proxy` on the top-level state object. Nested mutation does not trigger re-renders — replace the key instead.
- **Minimal surface.** Only the primitives that cover 90% of real use cases. Not a general-purpose framework.
- **LLM-friendly.** Component definitions are plain objects. Expressions are plain JS strings. The API is learnable in one screen.

---

## Public API — one screen

```ts
// Register a component by name (for data-component auto-mount)
Micra.define(name: string, definition: ComponentDefinition): void

// Type helper for TS inference — returns the same object
Micra.defineComponent(definition: ComponentDefinition): ComponentDefinition

// Mount directly onto an element (returns instance or null)
Micra.mount(selector: string | HTMLElement, definition): ComponentInstance | null

// Scan DOM for [data-component], mount all registered components
Micra.start(root?: Document | HTMLElement): void

// Global event bus
Micra.on(event: string, handler: fn): UnsubFn
Micra.off(event: string, handler: fn): void
Micra.emit(event: string, payload?: unknown): void

// Introspection
Micra.instances(): ReadonlyMap<HTMLElement, ComponentInstance>
Micra.registry(): ReadonlyMap<string, ComponentDefinition>
Micra.debug(): void  // prints all live instances to console
```

---

## ComponentDefinition shape

```ts
{
  state?: Record<string, unknown>,  // initial flat state
  onCreate?(): void | Promise<void>, // after first render, in a microtask
  onDestroy?(): void,               // before destroy
  [method: string]: Function        // any other key = component method
}
```

---

## ComponentInstance — `this` inside methods

```ts
this.$el           // root HTMLElement (readonly)
this.state         // reactive proxy — top-level writes trigger re-render
this.refs          // { [name]: HTMLElement } — populated from data-ref
this.render()      // force synchronous re-render (rarely needed)
this.destroy()     // unmount, auto-unsub, call onDestroy
this.prop(name, default?)  // read data-* from root element, auto-casts bool/number
this.fetch(url, options?)  // fetch wrapper with CSRF, JSON, query params
this.emit(event, payload?) // shortcut to Micra.emit()
this.on(event, handler)    // shortcut to Micra.on() — auto-cleaned on destroy
```

---

## Directives reference

| Directive | Effect |
|---|---|
| `data-text="expr"` | Sets `textContent` |
| `data-html="expr"` | Sets `innerHTML` |
| `data-if="expr"` | `display:none` when falsy |
| `data-show="expr"` | Same as `data-if` |
| `data-bind="attr:expr, ..."` | Binds attributes; boolean attrs add/remove |
| `data-model="key"` | Two-way binding for input/select/textarea |
| `data-class="cls:expr, ..."` | Additive class toggle (does not replace className) |
| `data-each="key"` on `<template>` | Renders list; use `data-key="id"` for keyed diff |
| `data-ref="name"` | Collects element into `this.refs.name` |
| `data-on="event:method"` | Binds DOM event; supports `.prevent`, `.stop`, `.self` |
| `@event="method"` | Shorthand for `data-on` |
| `data-component="name"` | Marks root element for auto-mount |

---

## Hard constraints (never violate)

1. **Shallow proxy only.** `this.state.items.push(x)` does NOT re-render. Use `this.state.items = [...this.state.items, x]`.
2. **`data-model` supports dot-paths.** `data-model="filters.search"` reads/writes `state.filters.search` (reconstructs the nested object); `this.set('filters.search', x)` does the same from JS. Bracket paths (`filters[0]`) are not parsed.
3. **No virtual DOM.** Re-render applies directives in place on the real DOM.
4. **`onCreate` runs in a microtask** after the first render — refs are available, safe for async.
5. **`this.on()` subscriptions are auto-cleaned on `destroy()`**. Manual `this.off()` is not needed.
6. **`Micra.start()` is idempotent** — already-mounted elements are skipped. Safe to call multiple times (SSR-friendly).
7. **Expressions run with `with(state)`** — they see state keys and component methods as local variables.

---

## Differentiators vs Alpine.js / petite-vue

| | Micra | Alpine | petite-vue |
|---|---|---|---|
| Bundle | < 7 KB gz | ~15 KB gz | ~6 KB gz |
| Directives in | `data-*` attrs | `x-*` attrs | `v-*` attrs |
| Event syntax | `@click="method"` | `@click="handler()"` | `@click="handler()"` |
| Reactivity | shallow Proxy, top-level only | deep Proxy | deep Proxy |
| Lists | `<template data-each>` | `x-for` | `v-for` |
| Cross-component | global event bus | `$dispatch` | emits |
| LLM codegen | plain object definition | inline expressions | Vue-like options API |
