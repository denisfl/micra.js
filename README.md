# Micra.js

Micra.js is a lightweight reactive TypeScript framework for small sites and SaaS apps. It gives you reactive state, DOM directives, keyed list rendering, an event bus, SSR-friendly props, and auto-mounting in about 3.7 KB gzip.

## What is Micra.js?

Micra.js is designed for server-rendered apps and small frontends that need a little reactivity without a large framework.

Use it when you want:

- JS expressions in directives like `data-if="count > 0"`
- keyed list diffing with `data-each` + `data-key`
- auto-mounting with `data-component`, `Micra.define()`, and `Micra.start()`
- SSR props from `data-*` attributes via `this.prop()`
- a built-in `this.fetch()` helper
- a small global event bus with `Micra.on()` and `Micra.emit()`
- DOM refs via `data-ref`
- additive class toggling with `data-class`
- simple lifecycle hooks: `onCreate`, `onDestroy`

## Quick Start

```html
<div data-component="counter">
  <button @click="decrement">-</button>
  <strong data-text="count"></strong>
  <button @click="increment">+</button>
</div>

<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define('counter', {
    state: { count: 0 },
    increment() { this.state.count++ },
    decrement() { this.state.count-- },
  })

  Micra.start()
</script>
```

## Installation

### CDN

```html
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
```

### npm

```bash
npm install micra.js
```

```ts
import * as Micra from 'micra'
```

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
import * as Micra from 'micra'

Micra.define('counter', {
  state: { count: 0 },

  increment() {
    this.state.count++
  },

  decrement() {
    this.state.count--
  },

  reset() {
    this.state.count = 0
  },
})

Micra.start()
```

## Directives

| Directive | Example | Description |
|---|---|---|
| `data-text` | `data-text="name"` | Set `textContent` |
| `data-html` | `data-html="content"` | Set `innerHTML` |
| `data-if` | `data-if="count > 0"` | Toggle display |
| `data-show` | `data-show="loaded"` | Alias of `data-if` |
| `data-bind` | `data-bind="href:url, disabled:loading"` | Bind attributes |
| `data-model` | `data-model="search"` | Two-way input binding |
| `data-each` | `data-each="items" data-key="id"` | List rendering |
| `data-ref` | `data-ref="chart"` | DOM ref in `this.refs` |
| `data-class` | `data-class="active:isActive"` | Toggle classes additively |
| `data-on` | `data-on="click:save"` | Bind DOM events |
| `@event` | `@click="increment"` | Shorthand event binding |

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
this.fetch(url, options?)
this.emit(event, payload?)
this.on(event, handler)
```

## Documentation

- [Getting started](./docs/getting-started.md)
- [Core concepts](./docs/concepts.md)
- [Directives](./docs/directives.md)
- [State](./docs/state.md)
- [Lifecycle](./docs/lifecycle.md)
- [SSR](./docs/ssr.md)
- [Examples](./docs/examples.md)
- [API reference](./docs/api-reference.md)
