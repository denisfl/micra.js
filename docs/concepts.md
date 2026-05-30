# Concepts

## Reactive state

Micra wraps your `state` object in a shallow `Proxy`.

- writing to a top-level property schedules a render
- reads are normal property reads
- nested objects are not tracked deeply

```ts
this.state.count = 1
```

This re-renders. This does not:

```ts
this.state.user.name = 'Ana'
```

Replace the top-level property instead:

```ts
this.state.user = { ...this.state.user, name: 'Ana' }
```

Arrays follow the same rule. Replace them instead of mutating in place:

```ts
this.state.items = [...this.state.items, nextItem]
```

## Batch scheduler

Micra batches synchronous state writes into one microtask render.

```ts
this.state.loading = true
this.state.page = 2
this.state.query = 'billing'
```

These writes trigger one render, not three. The scheduler uses `Promise.resolve().then(...)`, so updates flush after the current call stack.

## Directive cache

On the first render, Micra scans the component root and records directive bindings such as:

- `data-text`
- `data-html`
- `data-if`
- `data-bind`
- `data-model`
- `data-class`

That scan result is cached on the root element. Later renders reuse the cached binding list instead of calling `querySelectorAll()` again.

Result: first render pays the scan cost; re-renders are much faster.

## Expression evaluator

Most directives accept JavaScript expressions:

```html
<div data-if="count > 0"></div>
<a data-bind="href:'/users/' + user.id"></a>
```

Micra evaluates expressions against a state object using two paths:

1. **Fast path for simple property access**: expressions like `count`, `user.name`, and `item.email` are resolved directly without `Function()`.
2. **Compiled path for full expressions**: other expressions are compiled once with `Function('with(...)')` and cached by expression string.

The cache is global for the page, so reused expressions stay fast.

## `exprState`

During rendering, expressions see more than raw state. Micra creates an expression proxy that exposes:

- top-level state properties
- component methods
- component helpers like `prop`, `emit`, and `fetch`

That means expressions can call methods:

```html
<time data-text="formatDate(user.createdAt)"></time>
```

```ts
formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}
```

## Keyed diff algorithm

`data-each` renders lists from a `<template>`.

```html
<template data-each="items" data-key="id">
  <li data-text="item.name"></li>
</template>
```

With `data-key`, Micra uses keyed diffing:

1. read the next item list
2. build the next key order
3. reuse existing DOM nodes when keys match
4. create nodes only for new keys
5. reorder nodes with `insertBefore`
6. remove nodes for missing keys

This keeps DOM state stable and avoids full list replacement.

Without `data-key`, Micra falls back to a **positional reuse** diff:
the first `min(prev, next)` row nodes are kept in place, the tail is
removed when the list shrinks, and fresh rows are cloned for the growth
delta. Reused rows get a re-applied directive pass through their cached
scan, so content updates without remove-and-re-clone overhead. Compared
to keyed diffing this still misses two things: identity is positional
(reordering treats the entire list as "every row changed"), and rows
with more than one top-level node are wrapped in `<micra-each-item
style="display:contents">` so each row corresponds to one stable DOM
node. Use `data-key` when row identity matters (reordering, animation,
preserving focus on a moved row).

## Multiple instances of the same component

A single `Micra.define()` call registers a **definition** — a blueprint. Every `[data-component]` element gets its own isolated **instance** with its own state.

This is how you put multiple dropdowns, tooltips, or accordion panels on the same page without any duplication.

### How it works

Each `data-component="dropdown"` element mounts independently. The definition is shared (no memory cost), but state is **per-element**:

```html
<!-- Three independent dropdowns — one definition, three instances -->
<div data-component="dropdown" data-label="Sort by">...</div>
<div data-component="dropdown" data-label="Filter by status">...</div>
<div data-component="dropdown" data-label="Per page">...</div>
```

```ts
Micra.define('dropdown', {
  state: { open: false, selected: null },

  // Read initial label from the HTML attribute
  onCreate() {
    this.state.label = this.prop('label', 'Choose...')
  },

  toggle() { this.state.open = !this.state.open },

  select(e: Event) {
    const item = (e.currentTarget as HTMLElement).dataset['value']
    this.state.selected = item
    this.state.open = false
    this.emit('dropdown:change', { id: this.$el.id, value: item })
  },

  onDestroy() {
    // cleanup (e.g. outside-click listener)
  },
})
```

Each instance has:
- Its own `state` object
- Its own `$el` (the root element)
- Its own event subscriptions (auto-cleaned on `destroy()`)

### Communicating between instances

Use the event bus. Any component can publish or subscribe:

```ts
// Dropdown publishes a change
this.emit('dropdown:change', { id: this.$el.id, value })

// Table subscribes to react
this.on('dropdown:change', ({ id, value }) => {
  if (id === 'status-filter') this.state.statusFilter = value
})
```

### Props from data-attributes

`this.prop(name, default)` reads `data-*` attributes from the root element — useful for per-instance configuration set by the server:

```html
<div data-component="chart"
     data-endpoint="/api/revenue"
     data-period="30"
     data-type="line">
</div>
<div data-component="chart"
     data-endpoint="/api/signups"
     data-period="7"
     data-type="bar">
</div>
```

```ts
Micra.define('chart', {
  state: { data: [] },
  async onCreate() {
    const endpoint = this.prop('endpoint', '/api/data')
    const period   = this.prop('period', 30)  // auto-cast to number
    this.state.data = await this.fetch(endpoint, { period })
  },
})
```

### Accessing a specific instance

`Micra.instances()` returns a `Map<HTMLElement, ComponentInstance>`. Look up by element:

```ts
const el = document.getElementById('sort-dropdown')!
const inst = Micra.instances().get(el)
inst?.state.open = true
```

