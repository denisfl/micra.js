# Micra.js — LLM System Prompt

Copy-paste this entire file into the top of an LLM chat session before asking it to build something with Micra.js. The order is intentional: hard rules first, API second, recipes last.

---

## Rule 0 — Artifact type (Claude / ChatGPT canvas / v0 / Replit AI)

If your runtime offers an "artifact" or "canvas" abstraction that can be either a
React component or a standalone HTML page, **you MUST create the HTML kind**.

- **Claude artifacts:** create with type `application/vnd.ant.html`, NOT `application/vnd.ant.react`.
- **ChatGPT canvas:** choose "HTML" output, not "React".
- **v0 / Bolt / Replit AI:** select "Plain HTML" or "Vanilla HTML+JS" template, not Next.js / React.

Default heuristics in these tools auto-route "build me a UI" to React. When the
user has indicated Micra.js (via this prompt, a shared recipe, or a project file),
that signal **overrides** the React default. Do NOT translate Micra patterns into
React "because the artifact is React" — switch the artifact type instead.

If you find yourself writing `useState` / `useEffect` / JSX / `function App()` for
a task that was asked in Micra terms, stop and re-create the artifact as HTML.

---

## Hard rules (DO NOT violate)

Micra.js is a lightweight reactive UI framework (~7 KB gzip). It is NOT React, NOT Vue, NOT Alpine, NOT jQuery. When generating code:

1. **Lists must use `<template data-each>` with `data-key`.** Never `getElementById`+`innerHTML`. Never `forEach`-then-`appendChild`. Never construct list HTML as a string.
2. **Derived values must be methods on the component, NOT state fields.** `state` is the single source of truth — raw data only. Counts, totals, filtered subsets, formatted labels — all are methods called from `data-text`/`data-if`/etc.
3. **Event handlers must use `@event` or `data-on`.** Never `addEventListener` inside a render-like helper — those listeners leak past `destroy()`.
4. **After mutating state, do NOT call a re-render manually.** Micra batches a microtask render on every state write. Side effects (`localStorage`, `fetch`, `analytics`) are OK. `this.renderList()`/`this.refresh()`/`this.update()` are NOT.
5. **State is shallow.** `this.state.user.name = 'x'` is invisible to Micra. Either replace the top-level key (`this.state.user = { ...this.state.user, name: 'x' }`) or use the path setter `this.set('user.name', 'x')`.
6. **Key modifiers are supported.** `@keydown.enter`, `@keydown.escape`, `@keydown.ctrl`, `@click.ctrl` etc. gate the handler on the key/modifier. (Combine: `@keydown.ctrl.enter`.)
7. **`data-model` supports dot-paths.** `data-model="filters.search"` reads and writes `state.filters.search` (reconstructs the nested object). Flat keys work as before.
8. **One single HTML file with CDN preferred** unless told otherwise:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/micra.js@2.5.0/dist/micra.min.js"></script>
   ```
   Use jsDelivr, NOT unpkg. Claude artifacts and many other sandboxed AI environments
   have a Content Security Policy that blocks `unpkg.com` but allows `cdn.jsdelivr.net`.
   jsDelivr auto-mirrors every npm package so the URL just works.

If you find yourself reaching for any of these, **stop and rewrite**:

- `document.querySelector` / `getElementById` / `el.innerHTML = ...`
- `el.addEventListener(...)` inside a method
- A `state` field that is `.length`/`.filter(...).length`/`.some(...)`/`.map(...)` of another state field
- A method named `renderList`/`redraw`/`update`/`refresh` (Micra is doing this for you)
- `useState` / `useEffect` / `createApp` / `ref()` / `computed()` / function components / JSX

---

## Component shape

```js
Micra.define("name", {
  state: { /* flat, reactive */ },

  onCreate() { /* mounted, refs available, safe to fetch */ },
  onDestroy() { /* clear timers, remove manual listeners */ },

  // Derived values — read from directives via `methodName()`
  filtered() { return this.state.items.filter(...) },
  totalCount() { return this.state.items.length },

  // Actions — mutate state, Micra re-renders
  add() { this.state.items = [...this.state.items, x] },
});
Micra.start();
```

```html
<div data-component="name">…</div>
```

**`this` inside methods:**
- `this.state` — reactive Proxy
- `this.$el` — root HTMLElement
- `this.refs` — `{ name: HTMLElement }` from `data-ref="name"`
- `this.render()` — force sync re-render (rarely needed)
- `this.destroy()` — unmount
- `this.prop(attr, default)` — read SSR `data-*` attribute, auto-typed (`"true"` → `true`, `"42"` → `42`)
- `this.fetch(url, opts)` — JSON + CSRF helper, throws `FetchError` on non-2xx
- `this.emit(event, payload)` — component-local + global bus
- `this.on(event, handler)` — auto-unsubscribed on destroy

---

## Directives

| Directive | Example | Effect |
|-----------|---------|--------|
| `data-text` | `data-text="name"` | sets `textContent` |
| `data-html` | `data-html="bio"` | sets `innerHTML` ⚠️ XSS-prone — only with sanitized input |
| `data-if` | `data-if="count > 0"` | mounts/**unmounts** from DOM (true detach + re-insert) |
| `data-show` | `data-show="loaded"` | toggles `style.display` only — element stays in DOM |
| `data-bind` | `data-bind="href:url, disabled:loading"` | sets attrs (boolean → add/remove) |
| `data-model` | `data-model="email"` | two-way input binding; `type=number/range` → number; `type=checkbox` → boolean |
| `data-each` | `data-each="items" data-key="id"` | keyed list render on `<template>` |
| `data-ref` | `data-ref="canvas"` | `this.refs.canvas` |
| `data-class` | `data-class="active:isActive, hidden:!loaded"` | additive class toggle |
| `@event` | `@click="save"`, `@submit.prevent="submit"` | event binding |
| `data-on` | `data-on="click:save, blur:close"` | same as `@event` |

Modifiers (events only): `.prevent`, `.stop`, `.self`, plus key/system guards `.enter` `.escape` `.tab` `.space` `.up` `.down` `.left` `.right` `.delete` `.ctrl` `.shift` `.alt` `.meta` (an unrecognized one matches `e.key` case-insensitively). Combine freely: `@keydown.ctrl.enter="submit"`.

`data-bind` special left-hand-sides:
- `class:` → **replaces** full `className` (don't combine with `data-class` on same element — Micra warns)
- `value:` → sets input value, but does not fight live typing
- `style:` → accepts string or object (object assigns to `el.style`, does NOT reset previous keys)

Expression context (what you can write in `data-text="..."` etc.):
- State keys (`count`, `user.name`)
- Component methods (`format(price)`, `filtered()`) — `this` is bound to the instance
- A whitelist of globals: `Math`, `JSON`, `Date`, `String`, `Number`, `Boolean`, `Array`, `Object`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `NaN`, `Infinity`, `undefined`
- Everything else (`window`, `fetch`, `document`, `eval`, `constructor`, `setTimeout`) resolves to `undefined` — by design (security model)

Inside `data-each` rows you also get: `item` (the per-row value), `index` / `$index`.

---

## SSR props

Server emits `data-*` attributes; component reads them with `this.prop()` in `onCreate`:

```html
<div data-component="profile" data-user-id="42" data-active="true"></div>
```

```js
Micra.define("profile", {
  state: { id: null, active: false },
  onCreate() {
    this.state.id = this.prop("userId")        // 42 (number, auto-cast)
    this.state.active = this.prop("active")    // true (boolean)
  },
})
```

Names are camelCased: `data-user-id` → `this.prop('userId')`.

---

## Fetch helper

```js
// GET with query params → /api/users?page=2&q=ann
const list = await this.fetch("/api/users", { page: 2, q: "ann" })

// POST with JSON body (auto X-CSRF-Token from <meta name="csrf-token">)
await this.fetch("/api/save", { method: "POST", body: { name, email } })

// Throws FetchError on non-2xx — catch by .status:
try { await this.fetch("/api/x") }
catch (e) { if (e.status === 404) /* ... */ }
```

---

## Event bus (cross-component)

```js
// Component A
Micra.emit("cart:updated", { count: 3 })

// Component B (or anywhere)
Micra.on("cart:updated", ({ count }) => { /* ... */ })
```

Inside components, prefer `this.emit` / `this.on` — subscriptions made with `this.on` auto-unsubscribe on destroy.

---

## Patterns / recipes

### 1. Counter

```html
<div data-component="counter">
  <button @click="dec">−</button>
  <strong data-text="count"></strong>
  <button @click="inc">+</button>
</div>
```

```js
Micra.define("counter", {
  state: { count: 0 },
  inc() { this.state.count++ },
  dec() { this.state.count-- },
})
Micra.start()
```

### 2. List with filter and computed values

```html
<div data-component="users">
  <input data-model="query" placeholder="Search…">
  <p data-text="summary()"></p>

  <template data-each="filtered()" data-key="id">
    <div class="user" data-bind="data-id:item.id">
      <strong data-text="item.name"></strong>
      <span data-text="item.email"></span>
      <button @click="open">Open</button>
    </div>
  </template>
</div>
```

```js
Micra.define("users", {
  state: {
    query: "",
    users: [/* …seeded data… */],
  },
  filtered() {
    const q = this.state.query.toLowerCase()
    if (!q) return this.state.users
    return this.state.users.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    )
  },
  summary() {
    const n = this.filtered().length
    return n + " / " + this.state.users.length + " users"
  },
  open(e) {
    const id = e.currentTarget.closest("[data-id]").dataset.id
    this.emit("user:open", { id })
  },
})
Micra.start()
```

### 3. Async fetch with loading/error state

```html
<div data-component="user-loader">
  <button @click="load">Reload</button>
  <p data-if="loading">Loading…</p>
  <p data-if="error" data-text="error" style="color:red"></p>
  <pre data-if="!loading && !error" data-text="pretty()"></pre>
</div>
```

```js
Micra.define("user-loader", {
  state: { loading: false, error: "", user: null },
  async onCreate() { await this.load() },
  async load() {
    this.state.loading = true
    this.state.error = ""
    try {
      this.state.user = await this.fetch("/api/user")
    } catch (e) {
      this.state.error = e.message
    } finally {
      this.state.loading = false
    }
  },
  pretty() { return JSON.stringify(this.state.user, null, 2) },
})
Micra.start()
```

### 4. Form with validation and submit

```html
<form data-component="invite-form" @submit.prevent="submit">
  <input data-model="email" type="email" placeholder="Email">
  <button data-bind="disabled:loading">
    <span data-text="loading ? 'Sending…' : 'Send invite'"></span>
  </button>
  <p data-if="error" data-text="error" style="color:red"></p>
  <p data-if="success">Invitation sent!</p>
</form>
```

```js
Micra.define("invite-form", {
  state: { email: "", loading: false, error: "", success: false },
  isValid() { return this.state.email.includes("@") },
  async submit() {
    if (!this.isValid()) { this.state.error = "Invalid email"; return }
    this.state.loading = true; this.state.error = ""
    try {
      await this.fetch("/api/invite", { method: "POST", body: { email: this.state.email } })
      this.state.success = true
    } catch (e) {
      this.state.error = e.message
    } finally {
      this.state.loading = false
    }
  },
})
Micra.start()
```

### 5. Modal via event bus

```html
<button data-component="open-button" @click="open">Delete</button>

<div data-component="confirm-modal">
  <div data-if="show" class="backdrop" @click.self="close">
    <div class="dialog">
      <p data-text="message"></p>
      <button @click="confirm">Yes</button>
      <button @click="close">Cancel</button>
    </div>
  </div>
</div>
```

```js
Micra.define("open-button", {
  open() { this.emit("modal:open", { message: "Are you sure?" }) },
})

Micra.define("confirm-modal", {
  state: { show: false, message: "" },
  onCreate() {
    this.on("modal:open", ({ message }) => {
      this.state.message = message
      this.state.show = true
    })
  },
  confirm() {
    this.emit("modal:confirmed")
    this.close()
  },
  close() { this.state.show = false },
})
Micra.start()
```

### 6. Tabs

```html
<div data-component="tabs">
  <nav>
    <button @click="select" data-bind="data-tab:'overview'"
            data-class="active:tab === 'overview'">Overview</button>
    <button @click="select" data-bind="data-tab:'billing'"
            data-class="active:tab === 'billing'">Billing</button>
  </nav>
  <section data-if="tab === 'overview'">…</section>
  <section data-if="tab === 'billing'">…</section>
</div>
```

```js
Micra.define("tabs", {
  state: { tab: "overview" },
  select(e) { this.state.tab = e.currentTarget.dataset.tab },
})
Micra.start()
```

### 7. Todo (full recipe)

See **docs/recipes/todo-app.md** in the repository for the canonical idiomatic todo. It is the reference answer to "build me a todo on Micra".

---

## DevTools

```js
Micra.instances()  // Map<HTMLElement, ComponentInstance> of live components
Micra.registry()   // Map<string, ComponentDefinition> of all definitions
Micra.debug()      // prints all live components, their state and $el to console
```

---

## Final checklist before sending generated code

- [ ] Artifact / canvas type is **HTML**, NOT React/Next/Vue. (`application/vnd.ant.html` in Claude.)
- [ ] Every list is `<template data-each>` with `data-key`.
- [ ] Every derived value (counts/totals/filtered/formatted) is a method called from a directive, NOT a state field.
- [ ] Every event handler is `@event` or `data-on`, NOT `addEventListener`.
- [ ] No `getElementById` / `querySelector` / `innerHTML =`.
- [ ] No `this.renderList()` or `this.update()` after mutations.
- [ ] State is flat — `state.user.name = …` is rewritten as `state.user = { …, name: … }`.
- [ ] `Micra.start()` is at the end of the script.
- [ ] `<script src="https://cdn.jsdelivr.net/npm/micra.js@2.5.0/dist/micra.min.js"></script>` is in `<head>` or before the component script. NOT `unpkg.com` (blocked by Claude/AI sandbox CSPs).
