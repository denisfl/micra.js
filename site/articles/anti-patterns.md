# Common Mistakes — and How to Fix Them

> Eight anti-patterns that account for ~95% of Micra bugs in the wild. Each one comes from the same root cause: trying to use Micra like jQuery or React, instead of the way it actually wants to be used.

If your code looks like any of these, stop and rewrite. The fix is usually shorter than the broken version.

---

## 1. Mutating arrays in place

**Broken:**

```js
addTodo(text) {
  this.state.todos.push({ id: Date.now(), text })  // ← invisible to Micra
}
```

**Why it breaks:** Micra's reactive proxy is **shallow**. It only sees writes to top-level keys of `this.state`. `.push()` mutates the array's internals — the proxy never fires.

**Fix:** replace the top-level key.

```js
addTodo(text) {
  this.state.todos = [...this.state.todos, { id: Date.now(), text }]
}
```

Same for `.splice`, `.sort`, `.reverse`, `.pop` — all in-place. Always produce a new array.

The three patterns you'll write 100× a day:

```js
// add
this.state.items = [...this.state.items, next]

// remove
this.state.items = this.state.items.filter(i => i.id !== id)

// update
this.state.items = this.state.items.map(i =>
  i.id === id ? { ...i, done: true } : i
)
```

---

## 2. Writing to nested properties

**Broken:**

```js
this.state.user.name = "Ada"     // ← invisible
this.state.filters.query = "x"   // ← invisible
```

**Why it breaks:** same as #1 — only top-level keys trigger reactivity.

**Fix:** replace the top-level key with a fresh spread.

```js
this.state.user = { ...this.state.user, name: "Ada" }
this.state.filters = { ...this.state.filters, query: "x" }
```

---

## 3. Storing derived values in `state`

**Broken:**

```js
state: {
  todos: [],
  totalCount: 0,       // ← derived from todos.length
  hasDone: false,      // ← derived from todos.some(t => t.done)
  filteredCount: 0,    // ← derived
},

updateCounts() {
  this.state.totalCount = this.state.todos.length
  this.state.hasDone = this.state.todos.some(t => t.done)
  this.state.filteredCount = this.filtered().length
}
```

You then have to remember to call `updateCounts()` after every mutation. Sooner or later, you forget — and the derived value drifts from the source.

**Fix:** derive in methods, not in state.

```js
state: { todos: [] },

totalCount() { return this.state.todos.length },
hasDone()    { return this.state.todos.some(t => t.done) },
filtered()   { return this.state.todos.filter(t => t.priority > 0) },
```

Methods are called from directives:

```html
<span data-text="totalCount()"></span>
<button data-if="hasDone()">Clear done</button>
```

Micra caches expression ASTs but **re-runs methods on every render** — that's the point. Methods are cheap; drift is expensive.

---

## 4. `getElementById` + `innerHTML` for lists

**Broken:**

```js
renderTodos() {
  const html = this.state.todos
    .map(t => `<li>${t.text}</li>`)
    .join("")
  document.getElementById("list").innerHTML = html
}
```

**Why it breaks:** you've reinvented React with strings. No keyed diffing, no event re-binding, no auto-cleanup. Every render re-creates every DOM node.

**Fix:** `<template data-each>` + `data-key`.

```html
<ul>
  <template data-each="todos" data-key="id">
    <li data-text="item.text"></li>
  </template>
</ul>
```

Micra computes the diff against the previous keyed list and only touches changed nodes.

---

## 5. `addEventListener` inside a method

**Broken:**

```js
onCreate() {
  this.refs.input.addEventListener("blur", () => this.validate())
}
```

**Why it breaks:** the listener never gets cleaned up. When the component unmounts (e.g. via `data-if`), the handler stays attached and the closure pins the entire component in memory.

**Fix:** use `@event` or `data-on` in markup.

```html
<input data-ref="input" @blur="validate" />
```

Micra tracks `@event`, `data-on`, `data-model` listeners on the instance and removes them in `destroy()`.

The one legitimate exception: **document-level** listeners (e.g. outside-click). Those go in `onCreate` + `onDestroy`:

```js
onCreate() {
  this._outside = (e) => {
    if (!this.$el.contains(e.target)) this.close()
  }
  document.addEventListener("click", this._outside)
},
onDestroy() {
  document.removeEventListener("click", this._outside)
}
```

---

## 6. Calling `this.renderList()` after a mutation

**Broken:**

```js
addTodo(text) {
  this.state.todos = [...this.state.todos, { text }]
  this.renderList()       // ← Micra already renders
  this.updateCounts()     // ← methods recompute on read
  this.refresh()          // ← no such concept
}
```

**Why it's wrong:** Micra batches a microtask render on every `state` write. Side effects (like `this.save()`) are fine. Render calls are noise.

**Fix:** trust the framework.

```js
addTodo(text) {
  this.state.todos = [...this.state.todos, { text }]
  this.save()  // side effect — OK
}
```

If you find yourself reaching for `refresh()` / `redraw()` / `update()` — there isn't one. State writes are the only signal.

---

## 7. `@keydown.enter` (Alpine/Vue muscle memory)

**Broken:**

```html
<input @keydown.enter="submit" />
```

Modifier shortcuts don't exist in Micra. The whole thing is `@keydown="submit"` and the handler decides.

**Fix:** branch on `event.key` in the method.

```html
<input @keydown="onKey" />
```

```js
onKey(e) {
  if (e.key === "Enter") this.submit()
  if (e.key === "Escape") this.cancel()
}
```

This is less magical and one line longer. It's also more honest — when you read the markup, you see "handles keydown", not "handles Enter and silently swallows others."

---

## 8. Timers / external listeners without cleanup

**Broken:**

```js
onCreate() {
  this.interval = setInterval(() => this.tick(), 1000)
}
// no onDestroy → timer keeps firing forever
```

**Why it breaks:** when the component unmounts, the interval keeps running. The closure keeps a reference to `this`, so the entire component (including its state, DOM refs, etc.) lives in memory until the page reload.

**Fix:** mirror every `onCreate` setup with `onDestroy` cleanup.

```js
onCreate() {
  this.interval = setInterval(() => this.tick(), 1000)
  this._handleVisibility = () => this.checkActive()
  document.addEventListener("visibilitychange", this._handleVisibility)
},

onDestroy() {
  clearInterval(this.interval)
  document.removeEventListener("visibilitychange", this._handleVisibility)
}
```

**Rule of thumb:** if `onCreate` calls `setInterval`, `setTimeout` (long delay), `addEventListener` on `document`/`window`/`Micra.on`, or creates a `MutationObserver` — `onDestroy` must tear it down.

`@event` and `data-on` listeners on the component's own DOM are auto-cleaned. Anything external is your responsibility.

---

## Pre-flight checklist

Before you ship, scan your code for these:

- [ ] Every list is `<template data-each>` with `data-key`. No `getElementById` / `innerHTML` for lists.
- [ ] No state field is `.length` / `.filter(...).length` / `.some(...)` of another state field. All such values are methods.
- [ ] No `addEventListener` inside a non-lifecycle method (document-level listeners in `onCreate`/`onDestroy` are fine).
- [ ] No `this.render()` / `this.update()` / `this.refresh()` calls after state mutations.
- [ ] No nested-path writes (`state.user.name = x`). Replace top-level instead.
- [ ] No `@keydown.enter` / `@click.prevent` modifiers — branch on the event in the handler.
- [ ] All timers / external listeners in `onCreate` have a matching cleanup in `onDestroy`.
- [ ] `Micra.start()` is at the end of the script.

If you cannot tick every box, rewrite.

[GitHub](https://github.com/denisfl/micra.js) · [Docs](https://denisfl.github.io/micra.js/) · [Migrating from Alpine.js](./alpine-to-micra.md)
