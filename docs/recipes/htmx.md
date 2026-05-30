# Recipe: htmx + Micra.js

This recipe is the canonical answer to "I want htmx for server-driven HTML
swaps and Micra for client-side reactive islands on the same page". It uses
**only what's already in Micra** — `Micra.start()`, `Micra.instances()`,
`instance.destroy()` — plus three htmx events.

> No `Micra.bridgeHtmx()` helper exists. The bridge is twelve lines of glue
> that you wire once at app boot. A built-in helper would have to make
> opinionated choices about cleanup ordering and OOB swaps, so we ship a
> recipe instead.

## The shape of the problem

htmx replaces DOM fragments via responses to `hx-get` / `hx-post` etc. Two
things go wrong if you do nothing:

1. **New `[data-component]` elements arriving in the swapped HTML never
   mount.** `Micra.start()` ran once on page load; the new elements were not
   in the DOM then.
2. **Old Micra instances inside the replaced HTML leak.** Their event-bus
   subscriptions stay alive, their cached directive scan points at detached
   DOM, and `onDestroy` never runs.

The bridge fixes both: **destroy on `htmx:beforeSwap`, mount on
`htmx:afterSettle`.**

## 1. The bridge — twelve lines, wire once

Put this once in your bootstrap script, after `Micra.start()`:

```js
// Mount new [data-component] elements that arrived via htmx swap.
document.body.addEventListener('htmx:afterSettle', (e) => {
  Micra.start(e.target)
})

// Destroy any Micra instances inside HTML that's about to be replaced.
document.body.addEventListener('htmx:beforeSwap', (e) => {
  const target = e.target
  Micra.instances().forEach((inst, root) => {
    if (target.contains(root)) inst.destroy()
  })
})
```

That's it. Server returns HTML with `<div data-component="x">…</div>` inside
it; htmx swaps it in; `htmx:afterSettle` fires; `Micra.start(e.target)`
scopes the scan to the swapped subtree and mounts. Going the other way,
`htmx:beforeSwap` fires before the old HTML is gone, so `destroy()` runs on
live instances — their `onDestroy`, bus unsubscribes, and listener cleanup
all happen in time.

`Micra.start()` is idempotent — re-scanning a subtree that already has
mounted siblings is safe; they're skipped.

## 2. Where to put `data-component` relative to `hx-swap`

The single most common footgun: putting `hx-swap` on a `[data-component]`
element that swaps its own `innerHTML`.

```html
<!-- ❌ Don't do this -->
<div data-component="dashboard"
     hx-get="/dashboard"
     hx-trigger="every 30s"
     hx-swap="innerHTML">
  …
</div>
```

After the first swap, the Micra instance on `dashboard` is still alive but
its cached directive scan points at gone DOM. New `data-text` / `@click`
inside the swapped HTML are invisible to it.

Use a wrapper:

```html
<!-- ✅ Wrapper swaps; Micra component is fully replaced -->
<div hx-get="/dashboard" hx-trigger="every 30s" hx-swap="innerHTML" hx-target="this">
  <div data-component="dashboard">
    …
  </div>
</div>
```

Now the swap target is the outer `<div>`. The inner `data-component` is
destroyed-and-remounted by the bridge above on every refresh, with a clean
scan and fresh state.

If you genuinely need a Micra instance to survive across htmx swaps (keep
client state through a server refresh), invert it: put `data-component` on
the **outer** element and use `hx-target` to swap something **inside** that
isn't itself a `data-component`.

```html
<div data-component="filterable-list">
  <input data-model="query" @input.debounce="search" />
  <div id="results" hx-target="this" hx-swap="innerHTML">
    <!-- server returns a fragment that may contain nested [data-component] -->
  </div>
</div>
```

Here the outer instance keeps `state.query` across swaps. The inner
`#results` div is the swap target; the bridge handles any nested Micra
components that arrive in the response.

## 3. Bridging `HX-Trigger` to the Micra event bus

htmx lets the server fire client events via the `HX-Trigger` response
header. Forward them to `Micra.emit()` so any component (anywhere on the
page) can react — no special wiring per event.

```js
document.body.addEventListener('htmx:trigger', (e) => {
  // e.detail is the parsed HX-Trigger payload — a name or { name: payload }
  const detail = e.detail
  if (typeof detail === 'string') {
    Micra.emit(detail)
    return
  }
  for (const [name, payload] of Object.entries(detail)) {
    Micra.emit(name, payload)
  }
})
```

Server example (Rails):

```ruby
response.headers['HX-Trigger'] = { 'cart:updated' => { count: @cart.size } }.to_json
```

Any Micra component subscribed via `this.on('cart:updated', …)` reacts —
the server is now a first-class emitter on the bus.

For type safety, declare the events your server sends in `MicraEvents`
(see [API reference](../api-reference.md#micraevents)).

## 4. Sending Micra state to the server with `hx-include` / `hx-vals`

The opposite direction: an htmx request needs values that live in a Micra
component's `state`. Two clean options.

**Option A — render state into form inputs.** htmx already includes form
inputs in the request via `hx-include`. Micra's `data-model` keeps the
input in sync with state.

```html
<div data-component="search-box">
  <input name="q" data-model="query" />
  <button hx-get="/api/search" hx-include="[name=q]" hx-target="#results">
    Search
  </button>
</div>
<div id="results"></div>
```

**Option B — expose a getter on the instance and inject via `hx-vals`
expression.** htmx evaluates `hx-vals:'js:…'` against the global scope.
Mark the button with a way to find the right instance (a `data-ref` on a
parent, or a stable `id`):

```html
<button id="export-btn"
        hx-post="/api/export"
        hx-vals='js:{ ids: getSelectedIds() }'>
  Export selected
</button>
```

```js
// One global function, looks up the instance and forwards to a method.
window.getSelectedIds = () => {
  const el = document.getElementById('table-root')  // [data-component="rows"]
  return Micra.instances().get(el)?.selectedIds() ?? []
}
```

Prefer Option A when the input is visible to the user. Option B is for
cases where the input is computed (multi-select, derived totals, etc.).

## 5. Loading state without losing it across swaps

A common UX pattern: the search input lives in a Micra component, the
results are swapped via htmx, and you want a spinner on the input while
htmx is in flight. htmx fires `htmx:beforeRequest` / `htmx:afterRequest` —
forward them to the relevant Micra instance:

```html
<div data-component="search" id="search">
  <input data-model="query"
         hx-get="/api/search"
         hx-trigger="input changed delay:300ms"
         hx-target="#results"
         data-class="loading:busy" />
</div>
<div id="results"></div>
```

```js
Micra.define('search', {
  state: { query: '', busy: false },
  onCreate() {
    this.$el.addEventListener('htmx:beforeRequest', () => { this.state.busy = true })
    this.$el.addEventListener('htmx:afterRequest',  () => { this.state.busy = false })
  },
})
```

Listeners attached in `onCreate` to `this.$el` (which is NOT replaced by
the swap — only `#results` is) survive across requests. No manual cleanup
needed since they die with the element.

## Things to avoid

- **Don't put `hx-swap` on a `[data-component]` element that swaps its own
  `innerHTML`.** The cached directive scan points at gone DOM. See section
  2 — use a wrapper.

- **Don't skip the `htmx:beforeSwap` cleanup.** Mounting works without it
  (idempotent), but every swap leaks the previous instance's bus
  subscriptions and `onDestroy` never runs.

- **Don't pass `document` to `Micra.start()` inside the bridge.** Always
  scope to `e.target`. Scanning the full document on every htmx response
  is wasteful and may double-traverse subtrees that haven't changed.

- **Don't rely on `this.fetch()` *and* htmx for the same request.** Pick
  one path per element. Mixing — e.g. `this.fetch()` to load data, then
  htmx to swap the result — usually means you wanted plain htmx or plain
  Micra.

- **Don't forget the `htmx:trigger` bridge is global by design.** If you
  want a component-local channel, namespace the event (`cart:updated`,
  not `updated`) so other components don't react by accident.

## Minimal full example

A page that boots once, then runs server-driven swaps with Micra islands
inside:

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="csrf-token" content="…">
  <script src="https://cdn.jsdelivr.net/npm/htmx.org@2/dist/htmx.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/micra.js/dist/micra.min.js"></script>
</head>
<body>
  <main hx-get="/page/home" hx-trigger="load" hx-swap="innerHTML"></main>

  <script>
    // Define all components your server might render.
    Micra.define('counter', {
      state: { count: 0 },
      inc() { this.state.count++ },
    })

    // Initial mount.
    Micra.start()

    // The bridge.
    document.body.addEventListener('htmx:afterSettle', (e) => {
      Micra.start(e.target)
    })
    document.body.addEventListener('htmx:beforeSwap', (e) => {
      Micra.instances().forEach((inst, root) => {
        if (e.target.contains(root)) inst.destroy()
      })
    })

    // Optional: bridge HX-Trigger to the Micra bus.
    document.body.addEventListener('htmx:trigger', (e) => {
      const d = e.detail
      if (typeof d === 'string') return Micra.emit(d)
      for (const [k, v] of Object.entries(d)) Micra.emit(k, v)
    })
  </script>
</body>
</html>
```

Server returns fragments like:

```html
<h1>Home</h1>
<div data-component="counter">
  <button @click="inc">+</button>
  <strong data-text="count"></strong>
</div>
```

…and the counter is fully reactive inside an htmx-swapped page.
