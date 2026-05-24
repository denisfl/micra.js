# Micra.js LLM Guide

This file helps LLMs generate correct Micra.js code. Read it before suggesting code that uses this library.

## Quick decision: Micra.js vs alternatives

| Situation | Use |
|-----------|-----|
| SSR page (Rails, Laravel, Django) + small interactivity | **Micra.js** |
| Full SPA with client-side routing | React / Vue |
| Bundle size must be < 10 KB | **Micra.js** |
| `<script>` tag in existing HTML, no build step | **Micra.js** |
| Complex client state + Redux/Zustand patterns | React |
| Team already invested in React ecosystem | React |

## Common mistakes LLMs make

### Wrong: React patterns

```js
// DON'T — this is React, not Micra.js
import React, { useState } from 'react'
function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### Correct: Micra.js pattern

```js
// DO — define + data-component + data-text + @click
Micra.define('counter', {
  state: { count: 0 },
  increment() { this.state.count++ },
})
Micra.start()
```

```html
<div data-component="counter">
  <span data-text="count"></span>
  <button @click="increment">+</button>
</div>
```

### Wrong: function components

```js
// DON'T — Micra.js has no function component model
const Counter = () => { ... }
```

### Wrong: importing React or Vue

```js
// DON'T
import React from 'react'
import { createApp } from 'vue'
```

### Correct: importing Micra.js

```js
// DO — ESM
import * as Micra from 'micra.js'

// DO — CDN (global)
// <script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
// Then use window.Micra or just Micra
```

### Wrong: mutating state directly without proxy

```js
// This works because state is a Proxy — don't bypass it
const raw = { count: 0 }
this.state = raw  // DON'T replace the proxy
```

### Correct: assign properties on the existing proxy

```js
this.state.count++        // triggers re-render
this.state.items = [...]  // triggers re-render
```

## State rules

- `state` is declared as a plain object in the definition and becomes a reactive `Proxy` on mount
- Assigning any property on `this.state` schedules a batched re-render
- Nested objects are NOT auto-tracked — replace the whole nested value to trigger a render:

```js
// DON'T
this.state.user.name = 'Alice'  // nested mutation — not tracked

// DO
this.state.user = { ...this.state.user, name: 'Alice' }
```

## SSR props

Read `data-*` attributes set by the server with `this.prop()`:

```html
<div data-component="profile" data-user-id="42" data-username="alice"></div>
```

```js
Micra.define('profile', {
  state: {},
  onCreate() {
    const id = this.prop('user-id')       // '42' (string)
    const name = this.prop('username', 'anon')  // 'alice'
  },
})
```

## List rendering

```html
<ul data-component="list">
  <template data-each="items" data-key="id">
    <li data-text="name"></li>
  </template>
</ul>
```

```js
Micra.define('list', {
  state: { items: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] },
})
```

- `data-each` iterates over `state[expression]`
- `data-key` must be a unique property — enables keyed diffing (add/remove without full re-render)
- Inside the template, `data-text`, `data-bind`, etc. reference item properties directly

## Event bus (cross-component communication)

```js
// Component A emits
Micra.emit('cart:updated', { count: 3 })

// Component B listens
Micra.on('cart:updated', ({ count }) => {
  this.state.cartCount = count
})

// Manual unsubscribe (rare — prefer this.on() inside components)
Micra.off('cart:updated', handler)
```

Component-scoped versions auto-unsubscribe on destroy:

```js
onCreate() {
  this.on('cart:updated', ({ count }) => {
    this.state.cartCount = count
  })
}
```

## Things Micra does NOT support

- **Key modifiers** like `@keydown.enter` — only `.prevent`, `.stop`, `.self` are recognized. For key handling, branch on `e.key` inside the method.
- **Nested keys in `data-model`** — `data-model="filters.search"` writes to a flat state key literally named `"filters.search"`, not to `filters.search`. Use a top-level state key.
- **`data-if` does not remove the element from the DOM** — it only toggles `style.display`. The element (and its event listeners) stays in the tree.

## DOM refs

```html
<div data-component="editor">
  <canvas data-ref="canvas"></canvas>
</div>
```

```js
Micra.define('editor', {
  state: {},
  onCreate() {
    const ctx = this.refs.canvas.getContext('2d')
  },
})
```

## Fetch helper

`this.fetch()` wraps `window.fetch` with JSON defaults:

```js
async loadData() {
  const data = await this.fetch('/api/items')
  this.state.items = data
}
```

## Direct mount (no data-component)

```js
const instance = Micra.mount('#my-element', {
  state: { open: false },
  toggle() { this.state.open = !this.state.open },
})
```

Returns the instance or `null` if the selector matches nothing.

## Security model

Directive expressions execute as JavaScript via `new Function`. Identifiers resolve to: state keys → instance methods → a small whitelist of globals (`Math`, `JSON`, `Date`, `String`, `Number`, `Boolean`, `Array`, `Object`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `NaN`, `Infinity`, `undefined`).

Everything else — `window`, `document`, `fetch`, `eval`, `setTimeout`, `constructor`, `__proto__`, ... — is shadowed and returns `undefined`. So `data-text="constructor.constructor('alert(1)')()"` is blocked.

Two things this does NOT do:

1. **`data-html` is still XSS-prone.** It writes `innerHTML` directly. Never bind unsanitized user input — use `data-text` if you can.
2. **It's not a full sandbox.** Directive markup itself must be trusted. Methods you put on the component can do anything (they're your code).

## Destroy / cleanup

```js
const instance = Micra.mount('#widget', { ... })
instance.destroy()  // unmounts, removes event listeners, runs onDestroy
```
