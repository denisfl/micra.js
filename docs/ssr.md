# SSR

Micra works well with server-rendered HTML. Render markup on the server, embed props in `data-*` attributes, and call `Micra.start()` in the browser.

## Basic SSR pattern

Server HTML:

```html
<div
  data-component="users-page"
  data-page="2"
  data-per-page="25"
  data-filter="active"
>
  <h1>Users</h1>
  <p>Page <span data-text="page"></span></p>
</div>
```

Client code:

```ts
import * as Micra from 'micra.js'

Micra.define('users-page', {
  state: {
    page: 1,
    perPage: 10,
    filter: 'all',
  },

  onCreate() {
    this.state.page = this.prop('page', 1)
    this.state.perPage = this.prop('perPage', 10)
    this.state.filter = this.prop('filter', 'all')
  },
})

document.addEventListener('DOMContentLoaded', () => {
  Micra.start()
})
```

## Props from `data-*` attributes

Use `this.prop(name, defaultValue?)` to read values from the root element.

```html
<section data-component="report" data-page="3" data-show-chart="true"></section>
```

```ts
onCreate() {
  const page = this.prop('page', 1)          // 3
  const showChart = this.prop('showChart', false) // true
}
```

Auto-casting rules:

- `"true"` → `true`
- `"false"` → `false`
- numeric strings → numbers
- anything else stays a string

Use dataset-style names: `data-per-page` becomes `this.prop('perPage')`.

## Hydration pattern

Micra does not use a virtual DOM hydration step. Instead, it enhances existing HTML in place.

Common pattern:

1. render the initial page on the server
2. include `data-component` on interactive roots
3. include initial props in `data-*` attributes
4. call `Micra.start()` when the DOM is ready
5. let Micra bind events, collect refs, and activate directives

This works well for Rails, Laravel, Phoenix, Django, and custom SSR setups.

## Hydration contract

When `mount()` runs against server-rendered HTML, the rules are simple:

1. **The initial render is synchronous and uses the state literal.**
   Before `mount()` returns, every directive has applied the values from
   `definition.state` exactly once.
2. **State is the source of truth.** If the server-rendered DOM already
   matches the initial state, nothing changes — same `textContent`, same
   attribute values. If it differs, Micra overwrites it.
3. **`onCreate` runs in a microtask, AFTER the initial render.** Any state
   mutation inside `onCreate` (including `this.state.x = this.prop('x')`)
   schedules a *second* render.

Concretely:

| Directive    | SSR matches state | SSR differs from state          |
| ------------ | ----------------- | ------------------------------- |
| `data-text`  | text preserved    | text overwritten                |
| `data-html`  | HTML preserved    | HTML overwritten                |
| `data-bind`  | attr preserved    | attr overwritten                |
| `data-class` | classes preserved | toggled to match state          |
| `data-if`    | element preserved | detached if state is falsy      |
| `data-show`  | display preserved | `style.display` flipped         |

### Two-stage flicker (and how to avoid it)

The canonical pattern in the [SSR section](#basic-ssr-pattern) above reads
props in `onCreate`:

```ts
state: { page: 1, perPage: 10 },
onCreate() {
  this.state.page = this.prop('page', 1)
  this.state.perPage = this.prop('perPage', 10)
}
```

This is **two-stage**:

1. Synchronous initial render uses `{ page: 1, perPage: 10 }` — the
   literal defaults.
2. Microtask: `onCreate` runs, copies `data-page="2"` into `state.page`,
   schedules a render.
3. Microtask: render runs again with `{ page: 2, perPage: 25 }`.

If the server also rendered `<span data-text="page">2</span>`, the text
briefly flips to `1` and back to `2` — a one-microtask flicker that's
visible on slow devices.

The no-flicker pattern: **seed the state literal directly from the
server**, so the synchronous initial render already matches the DOM:

```html
<div data-component="users-page">
  <h1>Users</h1>
  <p>Page <span data-text="page">2</span></p>
</div>

<script>
  Micra.define('users-page', {
    state: {
      page:    2,           // ← inlined by the server template
      perPage: 25,
      filter:  'active',
    },
  })
  Micra.start()
</script>
```

Server template (ERB / Twig / Blade / Liquid / EEx):

```erb
state: { page: <%= @page %>, perPage: <%= @per_page %>, filter: <%= @filter.to_json %> },
```

Now there's only one render, and it already agrees with the server's
HTML — no second pass, no flicker.

Use the `data-*` + `onCreate` pattern when:

- The SSR props are configuration that doesn't appear in the markup
  (a stream URL, an endpoint, a feature flag).
- A brief flicker is acceptable because the visible content is
  client-only anyway (loading spinners, empty placeholders).

### What hydration does NOT do

- **No partial-DOM reconciliation for `data-each`.** A server-rendered
  list inside `<template data-each>` is replaced on first render — the
  template's contents become a marker, then Micra renders rows from
  scratch. Don't bake list rows into the markup expecting them to be
  reused.
- **No SSR for the `@event` / `data-on` registry.** Event handlers are
  bound on mount, not before. Clicks fired *before* `Micra.start()`
  resolves are not delivered.
- **No automatic re-mount on swap.** If a server-driven swap (htmx,
  Turbo) replaces a `[data-component]` element, you have to destroy the
  old instance and call `Micra.start()` on the new subtree. See the
  [htmx recipe](./recipes/htmx.md) for the canonical bridge.

## Safe repeated starts

`Micra.start()` is idempotent for already-mounted roots.

```ts
Micra.start()
Micra.start()
Micra.start(document.getElementById('new-fragment')!)
```

Existing instances are skipped, so repeated calls are safe after partial page updates or HTML inserts.
