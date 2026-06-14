# Migrating from Alpine.js to Micra.js

> Alpine.js taught us declarative reactivity belongs in HTML. Micra.js takes the same idea and ships in ~7 kB gzip — about 3× smaller, with standard `data-*` syntax and a built-in event bus.

This guide ports a typical Alpine app to Micra. Most files change by less than 20 lines.

---

## TL;DR — the syntax map

| Alpine | Micra |
|---|---|
| `x-data="{ count: 0 }"` | `data-component="counter"` + `Micra.define("counter", { state: { count: 0 } })` |
| `x-text="count"` | `data-text="count"` |
| `x-html="markup"` | `data-html="markup"` |
| `x-show="open"` | `data-show="open"` |
| `x-if="open"` (with `<template>`) | `data-if="open"` |
| `x-bind:class="active && 'on'"` | `data-class="on:active"` |
| `x-model="name"` | `data-model="name"` |
| `x-on:click="open = true"` or `@click="…"` | `@click="toggle"` (handler is a method) |
| `x-init="fetchUser()"` | `onCreate()` lifecycle hook |
| `x-ref="input"` + `$refs.input` | `data-ref="input"` + `this.refs.input` |
| `Alpine.store('toasts', …)` + `$store.toasts` | `Micra.emit('toast', …)` + `Micra.on('toast', …)` |
| `Alpine.start()` | `Micra.start()` |

The big shape change: **state and methods live on a single `define()` object**, not inline in the HTML. Templates stay in HTML; logic moves to JS.

---

## Step 1 — install

```html
<!-- Drop Alpine -->
<script src="//unpkg.com/alpinejs" defer></script>

<!-- Add Micra (jsDelivr, no defer needed) -->
<script src="https://cdn.jsdelivr.net/npm/micra.js/dist/micra.min.js"></script>
```

Or via npm:

```bash
npm uninstall alpinejs
npm install micra.js
```

```js
import * as Micra from "micra.js"
```

---

## Step 2 — convert a counter

**Alpine:**

```html
<div x-data="{ count: 0 }">
  <button @click="count--">−</button>
  <span x-text="count"></span>
  <button @click="count++">+</button>
</div>
```

**Micra:**

```html
<div data-component="counter">
  <button @click="dec">−</button>
  <span data-text="count"></span>
  <button @click="inc">+</button>
</div>

<script>
  Micra.define("counter", {
    state: { count: 0 },
    inc() { this.state.count++ },
    dec() { this.state.count-- },
  })
  Micra.start()
</script>
```

The state moved off the HTML and into a `define()` block. Two new methods (`inc`, `dec`) replace the inline mutations. **Tradeoff:** more vertical lines, but every component is shaped the same way — easier to grep, easier to test, easier for LLMs to generate.

---

## Step 3 — convert a list

Alpine uses `x-for` directly on the element. Micra uses `<template data-each>` + `data-key` for keyed diffing.

**Alpine:**

```html
<ul x-data="{ todos: [{ id: 1, text: 'Pay rent' }] }">
  <template x-for="todo in todos" :key="todo.id">
    <li x-text="todo.text"></li>
  </template>
</ul>
```

**Micra:**

```html
<ul data-component="todos">
  <template data-each="todos" data-key="id">
    <li data-text="item.text"></li>
  </template>
</ul>

<script>
  Micra.define("todos", {
    state: { todos: [{ id: 1, text: "Pay rent" }] },
  })
</script>
```

Two differences: the loop variable is always `item` (not `todo`), and `data-key` is mandatory for keyed diffing. **Don't push/splice the array in place** — replace it:

```js
// add
this.state.todos = [...this.state.todos, next]

// remove
this.state.todos = this.state.todos.filter(t => t.id !== id)

// update
this.state.todos = this.state.todos.map(t =>
  t.id === id ? { ...t, done: true } : t
)
```

If you mutate in place, Micra won't see it (top-level writes only — see [Anti-patterns](./anti-patterns.md)).

---

## Step 4 — convert stores → event bus

Alpine stores require importing the global `Alpine` object. Micra's event bus is built-in.

**Alpine:**

```js
Alpine.store("toasts", {
  items: [],
  push(msg) { this.items.push({ id: Date.now(), msg }) },
})
```

```html
<button @click="$store.toasts.push('Saved')">Save</button>

<div x-data x-init="$watch('$store.toasts.items', render)">
  <template x-for="t in $store.toasts.items">
    <div x-text="t.msg"></div>
  </template>
</div>
```

**Micra:**

```html
<button data-component="save-btn" @click="save">Save</button>

<div data-component="toast-stack">
  <template data-each="toasts" data-key="id">
    <div data-text="item.msg"></div>
  </template>
</div>

<script>
  Micra.define("save-btn", {
    save() { Micra.emit("toast", { msg: "Saved" }) },
  })

  Micra.define("toast-stack", {
    state: { toasts: [] },
    onCreate() {
      Micra.on("toast", ({ msg }) => {
        this.state.toasts = [...this.state.toasts, { id: Date.now(), msg }]
      })
    },
  })
</script>
```

No global store, no `$watch`. Components emit, others listen. Less code, easier to trace.

---

## Step 5 — convert SSR props

Alpine reads server data via `data-*` attributes manually:

```html
<div x-data="{ user: JSON.parse($el.dataset.user) }" data-user='{"name":"Ada"}'>
  <h1 x-text="user.name"></h1>
</div>
```

Micra has a built-in `this.prop()`:

```html
<div data-component="user-card" data-user='{"name":"Ada"}'>
  <h1 data-text="user.name"></h1>
</div>

<script>
  Micra.define("user-card", {
    state: { user: null },
    onCreate() { this.state.user = this.prop("user") },
  })
</script>
```

JSON-parsed automatically. Strings and numbers also work without parsing.

---

## Step 6 — convert fetch + cleanup

Alpine has no built-in fetch helper. Micra has `this.fetch()` with auto-cancel on destroy:

**Alpine (manual abort):**

```js
init() {
  this.controller = new AbortController()
  fetch("/api/users", { signal: this.controller.signal })
    .then(r => r.json())
    .then(users => this.users = users)
},
destroy() { this.controller.abort() },
```

**Micra:**

```js
async onCreate() {
  this.state.users = await this.fetch("/api/users").then(r => r.json())
},
// no destroy needed — this.fetch ties to the component's lifetime
```

When the component unmounts, any in-flight `this.fetch()` is aborted automatically.

---

## Gotchas you'll hit

1. **No inline state mutations** — `@click="count++"` doesn't work. You must write a method: `inc() { this.state.count++ }`. This is intentional: Micra validates expressions via AST and only allows reads.

2. **No nested writes** — `this.state.user.name = "Ada"` is invisible. Replace the top-level key: `this.state.user = { ...this.state.user, name: "Ada" }`.

3. **`@keydown.enter` shorthands don't exist** — branch on `event.key` in the method:
   ```js
   submit(e) { if (e.key === "Enter") this.save() }
   ```

4. **No plugins** — Alpine's intersect / collapse / focus plugins have no direct equivalent. Most are 10-line vanilla solutions in `onCreate()`.

5. **Event bus replaces stores** — if you used `$store.X.Y`, replace with `Micra.emit("X", { Y })` + listener.

---

## What you gain

- **3× smaller bundle** (~7 kB vs ~14 kB gzip)
- **AST-validated expressions** — no `window` access from markup, no surprise side effects
- **Built-in `this.fetch()`** with auto-abort on destroy
- **`this.prop()` for SSR data** — no manual JSON.parse
- **Cleaner LLM ergonomics** — fewer ways to write the same thing, less anti-pattern surface

## What you lose

- **Plugin ecosystem** — Alpine has 30+ community plugins; Micra has none. You write what you need.
- **Inline mutations** — sometimes nice for prototypes; gone in Micra by design.
- **`x-cloak`** equivalent — Micra renders synchronously on mount, so flicker is rare; add `[data-component]:not([data-mounted]) { visibility: hidden }` if needed.

---

A typical 200-line Alpine app ports to Micra in about an hour. The migration is mechanical — the syntax map at the top covers ~90% of substitutions. The remaining 10% is replacing stores with the event bus, which usually shortens the code.

[GitHub](https://github.com/denisfl/micra.js) · [Docs](https://denisfl.github.io/micra.js/) · [Anti-patterns](./anti-patterns.md)
