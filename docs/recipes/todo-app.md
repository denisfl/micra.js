# Recipe: Todo app with localStorage, filters, and computed values

A complete, idiomatic Micra.js todo. **Read this before generating any todo-like UI on Micra.**

It is the canonical answer to "build me a todo app". Copy it verbatim and adjust as needed — do NOT roll your own DOM, do NOT store derived values in state, do NOT call `addEventListener` manually.

> ⚠️ **READ THIS FIRST — Claude artifact type selection**
>
> Claude artifacts default to a **React** runtime. If you are asked to "build a todo" and
> auto-select an artifact type, you will pick `application/vnd.ant.react` and ignore this
> recipe — Micra cannot run inside a React artifact.
>
> When the user has shared this recipe, that is an explicit instruction to use Micra.
> You MUST:
>
> 1. Create the artifact with type **`application/vnd.ant.html`** (NOT `react`).
> 2. Include the Micra script tag inside the HTML (see "Full source" below).
> 3. Build the markup with `data-component`, `data-each`, `@click`, etc.
> 4. Do NOT translate the recipe into React "because Claude artifacts are React".
>    The HTML artifact type exists precisely for cases like this.
>
> Same applies to ChatGPT canvas, v0, Replit AI: select the "Plain HTML" / "HTML"
> output type, not the framework-specific one.

> **CDN:** uses `cdn.jsdelivr.net` because Claude artifacts (and most AI sandboxes)
> block `unpkg.com` via Content Security Policy. jsDelivr auto-mirrors npm and is in
> the allowlist of every major AI runtime.

## What you get

- Add / toggle / delete / clear-done
- Filters: all / active / done
- Counters and labels reactive to state
- Persistence via `localStorage`
- 60 lines of JS, single HTML file, no build step

## Full source

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Todo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; }
    .row { display: flex; gap: 8px; margin-bottom: 12px; }
    .row input { flex: 1; padding: 8px; }
    .filters { display: flex; gap: 4px; margin-bottom: 12px; }
    .filters button.active { font-weight: bold; }
    .item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #eee; }
    .item.done .text { text-decoration: line-through; opacity: 0.5; }
    .item button { margin-left: auto; }
  </style>
</head>
<body>
  <div data-component="todo-app">
    <h1>Todo <small data-text="counterLabel()"></small></h1>

    <div class="filters">
      <button data-class="active:filter==='all'"    @click="setFilter('all')">All</button>
      <button data-class="active:filter==='active'" @click="setFilter('active')">Active</button>
      <button data-class="active:filter==='done'"   @click="setFilter('done')">Done</button>
    </div>

    <div class="row">
      <input data-model="newTask" placeholder="New task..." @keydown="onKey" maxlength="200">
      <button @click="addTask">Add</button>
    </div>

    <template data-each="filtered()" data-key="id">
      <div class="item" data-class="done:item.done" data-bind="data-id:item.id">
        <input type="checkbox" data-bind="checked:item.done" @change="toggle">
        <span class="text" data-text="item.text"></span>
        <button @click="remove">✕</button>
      </div>
    </template>

    <p data-if="filtered().length === 0" data-text="emptyLabel()"></p>

    <footer data-if="todos.length > 0">
      <span data-text="leftLabel()"></span>
      <button data-if="hasDone()" @click="clearDone">Clear done</button>
    </footer>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/micra.js@2.0.0/dist/micra.min.js"></script>
  <script>
    Micra.define('todo-app', {
      state: {
        todos: JSON.parse(localStorage.getItem('todos') || '[]'),
        newTask: '',
        filter: 'all',
      },

      // ── derived values: METHODS, not state fields ─────────────
      filtered() {
        const { todos, filter } = this.state
        if (filter === 'active') return todos.filter(t => !t.done)
        if (filter === 'done')   return todos.filter(t => t.done)
        return todos
      },
      counterLabel() { return this.state.todos.length ? `(${this.state.todos.length})` : '' },
      leftLabel()    { const n = this.state.todos.filter(t => !t.done).length
                       return n ? `${n} left` : 'All done 🎉' },
      hasDone()      { return this.state.todos.some(t => t.done) },
      emptyLabel()   { return { all: 'No todos yet', active: 'No active todos', done: 'No done todos' }[this.state.filter] },

      // ── persistence (called after each mutation) ──────────────
      save() { localStorage.setItem('todos', JSON.stringify(this.state.todos)) },
      nextId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) },

      // ── id extraction from event ──────────────────────────────
      itemId(e) { return e.currentTarget.closest('[data-id]').dataset.id },

      // ── actions: mutate state, Micra re-renders automatically ─
      addTask() {
        const text = this.state.newTask.trim()
        if (!text) return
        this.state.todos = [{ id: this.nextId(), text, done: false }, ...this.state.todos]
        this.state.newTask = ''
        this.save()
      },
      toggle(e) {
        const id = this.itemId(e)
        this.state.todos = this.state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
        this.save()
      },
      remove(e) {
        const id = this.itemId(e)
        this.state.todos = this.state.todos.filter(t => t.id !== id)
        this.save()
      },
      clearDone() {
        this.state.todos = this.state.todos.filter(t => !t.done)
        this.save()
      },
      setFilter(f) { this.state.filter = f },
      onKey(e) { if (e.key === 'Enter') this.addTask() },
    })
    Micra.start()
  </script>
</body>
</html>
```

## Why this code (and not the obvious alternative)

LLMs trained on jQuery/vanilla JS will naturally reach for:

```js
// ❌ DO NOT — this is what the LLM defaults to
document.getElementById('todo-list').innerHTML = items.map(...).join('')
el.addEventListener('click', () => this.toggle(id))
state: { totalCount: 0, hasDone: false }  // synced manually
addTask() { ...; this.renderList(); this.updateComputeds() }
```

That code **works**, but it bypasses every reason to use Micra. Side-by-side comparison:

| What | ❌ Anti-pattern | ✅ Idiomatic Micra |
|------|-----------------|---------------------|
| List rendering | `getElementById` + `innerHTML` | `<template data-each>` |
| Derived counts | state field synced in `updateComputeds()` | `counterLabel()` method called from `data-text` |
| Item click handlers | `el.addEventListener('click', ...)` in createItemEl | `@click="toggle"` |
| After mutation | `this.renderList()` + `this.save()` + `this.updateComputeds()` | Just mutate state; `save()` only |
| Item id lookup | Closure over `todo.id` in handler | `data-bind="data-id:item.id"` + `e.currentTarget.closest('[data-id]')` |
| Animations | Re-fire on every state change (innerHTML='') | Fire only for new keyed rows |
| Memory after `destroy()` | Listeners leak (not tracked by Micra) | Listeners removed automatically |

## Patterns to reuse

These 5 patterns recur in every non-trivial Micra app — internalize them once:

### 1. Derived values are methods, not state

```js
state: { todos: [] }                   // single source of truth
counterLabel() { return ... }          // computed from state
// <span data-text="counterLabel()"></span>
```

Never write:

```js
state: { todos: [], counterLabel: '' }  // ❌ two states can diverge
```

### 2. Lists go through `data-each`, always

```html
<template data-each="filtered()" data-key="id">
  <div data-text="item.name"></div>
</template>
```

The expression in `data-each` can call a method like `filtered()`. The expression in inner directives uses `item` (the per-row value) and `index` / `$index`.

### 3. Get item id inside a row handler via `closest`

Micra doesn't pass `item` as an argument to `@click`. Either bind `data-id`:

```html
<div data-bind="data-id:item.id">
  <button @click="remove">×</button>
</div>
```

```js
remove(e) {
  const id = e.currentTarget.closest('[data-id]').dataset.id
  this.state.items = this.state.items.filter(x => x.id !== id)
}
```

Or — if you need the full object — capture it via the bus:

```html
<button @click="open" data-bind="data-id:item.id">Open</button>
```

```js
open(e) {
  const id = e.currentTarget.dataset.id
  const item = this.state.items.find(x => x.id === id)
  this.emit('item:open', item)
}
```

### 4. After a mutation: only do side effects, not rendering

```js
addTask() {
  this.state.todos = [...this.state.todos, x]   // triggers re-render
  this.save()                                    // side effect, OK
  // ❌ DO NOT: this.renderList() / this.update()
}
```

Side effects: `localStorage`, `fetch`, `console.log`, analytics. NOT: `renderList()`, `updateComputeds()`.

### 5. Keys must be stable and unique

```js
nextId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }
```

If you use array index as key (`data-key="$index"`) — you lose the entire benefit of keyed diff. Pick a real id.

## What an LLM should refuse to generate

If a task says "build a todo with Micra" and you find yourself writing any of these, **stop and rewrite using the patterns above**:

- `document.querySelector` / `document.getElementById` / `el.innerHTML = ...`
- `el.addEventListener` inside a method
- A `state` field that is a `.length`, `.filter(...).length`, `.some(...)`, or `.map(...)` of another state field
- A method named `renderList` / `redraw` / `update` / `refresh` (Micra is doing this for you)
- A `forEach` loop that builds an HTML string for a list (use `data-each`)
- `setInterval` / `setTimeout` without storing the id for cleanup in `onDestroy`
