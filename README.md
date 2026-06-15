# Micra.js

[![CI](https://github.com/denisfl/micra.js/actions/workflows/ci.yml/badge.svg)](https://github.com/denisfl/micra.js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/micra.js)](https://www.npmjs.com/package/micra.js)
[![bundle size](https://img.shields.io/bundlephobia/minzip/micra.js?label=gzip)](https://bundlephobia.com/package/micra.js)
[![types included](https://img.shields.io/badge/types-included-blue)](./dist/index.d.ts)
[![license MIT](https://img.shields.io/npm/l/micra.js)](./LICENSE)

Micra.js is a lightweight reactive TypeScript framework for small sites and SaaS apps. It gives you reactive state, DOM directives, keyed list rendering, an event bus, SSR-friendly props, and auto-mounting in about 7 KB gzip.

## Project status

- **Stable, SemVer-disciplined.** Breaking changes only in majors; every
  release documented in [CHANGELOG.md](./CHANGELOG.md) with migration notes.
- **Tested.** 277 tests across 15 suites run on every push and before every
  npm publish; the build fails if the bundle exceeds **7 KB gzip** or if
  `eval` / `new Function` ever reappears (CSP guard).
- **CSP-safe.** Runs under a strict `default-src 'self'` Content-Security-Policy —
  directive expressions are parsed and interpreted, never `eval`'d.
- **Typed.** Ships its own `.d.ts` — state, methods, and event-bus payloads
  are checked end-to-end (see [TypeScript](#typescript)).
- **Security policy.** See [SECURITY.md](./SECURITY.md) — private reporting,
  72-hour acknowledgement, supported-versions table.

## When to use Micra.js

Built for **server-rendered apps** (Rails, Laravel, Django, Phoenix, ASP.NET) and small SaaS frontends that need a sprinkle of reactivity without a build step.

Reach for Micra.js instead of React/Vue when:

- ~7 KB gzip matters (full bundle, not "core")
- you want to drop a `<script>` tag on an existing page and go — no toolchain
- you have HTML rendered by your server template engine that needs reactive directives
- you don't need client-side routing or a full SPA
- you want **htmx + reactive client state** in the same page

Compared to Alpine.js: smaller surface, no `x-*` shorthand soup, AST-validated expressions (no global `window` / `fetch` access from markup), cleaner LLM ergonomics — fewer anti-patterns to fall into.

What you get:

- reactive `state` via a shallow `Proxy` (top-level writes only)
- JS expressions in directives: `data-if="count > 0"`
- keyed list diffing: `data-each` + `data-key`
- auto-mounting via `data-component` + `Micra.start()`
- SSR props from `data-*` attributes via `this.prop()`
- built-in `this.fetch()` helper with `AbortSignal` support
- global event bus: `Micra.on()` / `Micra.emit()`
- DOM refs via `data-ref`, additive class toggling via `data-class`
- lifecycle hooks: `onCreate`, `onDestroy`

## Quick Start

```html
<div data-component="counter">
  <button @click="decrement">-</button>
  <strong data-text="count"></strong>
  <button @click="increment">+</button>
</div>

<script src="https://cdn.jsdelivr.net/npm/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("counter", {
    state: { count: 0 },
    increment() {
      this.state.count++;
    },
    decrement() {
      this.state.count--;
    },
  });

  Micra.start();
</script>
```

## Installation

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/micra.js/dist/micra.min.js"></script>
```

### npm

```bash
npm install micra.js
```

```ts
import * as Micra from "micra.js";
```

### TypeScript

The npm package ships its own `dist/index.d.ts` — no `@types/micra.js` package
needed. Inside every method body and lifecycle hook, both `this.state.X` and
`this.someMethod()` are fully checked at the call site (both `state` and the
method set are inferred from the literal you pass to `Micra.define`).

```ts
import * as Micra from "micra.js";

Micra.define("counter", {
  state: { count: 0 },
  inc() {
    this.state.count++;   // ✓ number
    this.dec();           // ✓ inferred sibling method
    // this.foo();        // ✗ Property 'foo' does not exist
  },
  dec() { this.state.count--; },
});

// Type-safe event bus via declaration merging
declare module "micra.js" {
  interface MicraEvents {
    "cart:updated": { count: number };
    "modal:close":  void;
  }
}

Micra.emit("cart:updated", { count: 3 });    // ✓
Micra.emit("cart:updated", { count: "3" });  // ✗ type error
Micra.emit("modal:close");                   // ✓ void → no args
```

**What's checked:** imports, state shape, method names, event-bus payloads,
lifecycle hooks, refs, `Micra.mount()` return type.

**What's not:** the expression strings inside `data-text="…"` / `@click="…"`
attributes — those are plain HTML to the IDE and validated only at mount
time. Same trade-off as Alpine.js `x-*` and petite-vue `v-*`; the
alternatives are JSX or a single-file-component compiler, neither of which
Micra ships.

## Basic usage

A counter mounted automatically from `data-component`:

```html
<div data-component="counter">
  <p>Count: <span data-text="count"></span></p>
  <button @click="decrement">-</button>
  <button @click="increment">+</button>
  <button @click="reset">Reset</button>
</div>
```

```ts
import * as Micra from "micra.js";

Micra.define("counter", {
  state: { count: 0 },

  increment() {
    this.state.count++;
  },

  decrement() {
    this.state.count--;
  },

  reset() {
    this.state.count = 0;
  },
});

Micra.start();
```

## Directives

| Directive    | Example                                  | Description               |
| ------------ | ---------------------------------------- | ------------------------- |
| `data-text`  | `data-text="name"`                       | Set `textContent`         |
| `data-html`  | `data-html="content"`                    | Set `innerHTML`           |
| `data-if`    | `data-if="count > 0"`                    | Mount / unmount from DOM  |
| `data-show`  | `data-show="loaded"`                     | Toggle `style.display`    |
| `data-bind`  | `data-bind="href:url, disabled:loading"` | Bind attributes           |
| `data-model` | `data-model="search"`                    | Two-way input binding     |
| `data-each`  | `data-each="items" data-key="id"`        | List rendering            |
| `data-ref`   | `data-ref="chart"`                       | DOM ref in `this.refs`    |
| `data-class` | `data-class="active:isActive"`           | Toggle classes additively |
| `data-on`    | `data-on="click:save"`                   | Bind DOM events           |
| `@event`     | `@click="increment"`                     | Shorthand event binding   |

## API reference summary

### Register

```ts
Micra.define(name: string, definition: ComponentDefinition): void
Micra.defineComponent(definition): ComponentDefinition
```

### Mount

```ts
Micra.mount(selector: string | HTMLElement, definition): ComponentInstance | null
Micra.start(root?: Document | HTMLElement): void
```

### Event bus

```ts
Micra.on(event, handler): UnsubFn
Micra.off(event, handler): void
Micra.emit(event, payload?): void
```

### DevTools

```ts
Micra.instances(): ReadonlyMap<HTMLElement, ComponentInstance>
Micra.registry(): ReadonlyMap<string, ComponentDefinition>
Micra.debug()    // prints all live components, their state and $el to the console
```

### Component instance (`this` inside methods)

```ts
this.$el
this.state
this.refs
this.render()
this.destroy()
this.prop(name, default?)
this.fetch(url, options?)   // supports AbortSignal in options.signal
this.emit(event, payload?)
this.on(event, handler)
```

## Documentation

- **AI / LLM code generation:** [`llms.txt`](./llms.txt) (overview) · [`llms-full.txt`](./llms-full.txt) (10 inline recipes + anti-pattern reference) · [`docs/llm-guide.md`](./docs/llm-guide.md) (full guide)
- [Getting started](./docs/getting-started.md)
- [Core concepts](./docs/concepts.md)
- [Directives](./docs/directives.md)
- [State](./docs/state.md)
- [Lifecycle](./docs/lifecycle.md)
- [SSR](./docs/ssr.md)
- [Examples](./docs/examples.md)
- [API reference](./docs/api-reference.md)
- Recipes:
  - [Todo app](./docs/recipes/todo-app.md)
  - [Server-sent events (SSE)](./docs/recipes/sse.md)
  - [htmx bridge](./docs/recipes/htmx.md)
  - [Rails + Micra](./docs/recipes/rails.md)
  - [Data resource helper](./docs/recipes/data-resource.md)

## Code generation with LLMs

Micra has a small surface area, but LLMs default to jQuery / vanilla-JS or React patterns that defeat the framework. When generating Micra code (in Claude artifacts, ChatGPT canvas, Cursor, Copilot, etc.), follow these rules:

1. **Lists** go through `<template data-each="items" data-key="id">`. Never `getElementById` / `innerHTML` for component output.
2. **Derived values** (counts, totals, filtered subsets) are **methods**, not state fields. State holds raw data only.
3. **Event handlers** use `@event` / `data-on`. Never `addEventListener` inside methods — it leaks past `destroy()`. Document-level listeners go in `onCreate` and are removed in `onDestroy`.
4. **No manual re-render.** Micra batches a microtask render on every state write — no `this.refresh()` / `this.update()` / `this.renderList()`.
5. **State proxy is shallow.** Replace top-level (`state.user = { ...state.user, name: x }`), or use the path sugar: `this.set('user.name', x)` and `data-model="user.name"` — both reconstruct + reassign the top-level key for you. Never `state.user.name = x`.
6. **Use event modifiers.** `@keydown.enter`, `@keydown.escape`, `@keydown.tab`, `@click.ctrl`, plus `.prevent` / `.stop` / `.self` — don't branch on `e.key` by hand.
7. **No literals in directive expressions.** The CSP-safe evaluator doesn't parse object/array literals — `data-each="items || []"` and `@click="f({a:1})"` fail. `data-each` already renders nothing for `null`; pass object args from a method.
8. **Use jsDelivr, not unpkg** — `cdn.jsdelivr.net` is in the CSP allowlist of Claude artifacts / ChatGPT canvas; `unpkg.com` is blocked there.

Full anti-pattern reference with side-by-side examples: [`docs/llm-guide.md`](./docs/llm-guide.md) and [`llms-full.txt`](./llms-full.txt).
