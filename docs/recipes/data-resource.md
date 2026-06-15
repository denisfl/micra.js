# Recipe: a `resource()` data helper

This recipe is the canonical answer to "every data page repeats the same
`loading` / `error` / `data` dance around `this.fetch()` — can I collapse it?".
It uses **only what's already in Micra** — `state`, `this.fetch()`, the shallow
proxy — wrapped in a ~15-line helper you copy into your own project.

> No `this.resource(...)` builtin exists, by design. The core bundle is held
> under 7 KB gzip, and this helper isn't free to bundle — so it ships as a
> recipe, not core. You own the code (same model as the component catalog), and
> the engine stays tiny. Live demo: [`site/recipes/data-resource.html`](../../site/recipes/data-resource.html).

## The helper

Drop this into your project (e.g. `resource.js`). It touches no Micra internals
— it only calls the built-in `instance.fetch()` and writes a **top-level** state
key, so each transition fires a render through the normal shallow proxy.

```js
// resource.js
export function resource(instance, key, url, options = {}) {
  let ctrl
  const set = (s) => { instance.state[key] = { ...s, refetch } }
  function refetch(overrides = {}) {
    ctrl?.abort()                                  // cancel any in-flight request
    ctrl = new AbortController()
    set({ data: null, loading: true, error: null })
    instance.fetch(url, { ...options, ...overrides, signal: ctrl.signal })
      .then((data)  => set({ data, loading: false, error: null }))
      .catch((error) => {
        if (error.name !== 'AbortError') set({ data: null, loading: false, error })
      })
    return refetch
  }
  return refetch()
}
```

## Using it

```js
import { resource } from './resource.js'

Micra.define('users-table', {
  state: { users: { loading: true, data: null, error: null } },

  onCreate() {
    resource(this, 'users', '/api/users')   // drives state.users through its lifecycle
  },

  // Args (e.g. { page: 2 }) go through a method — directive expressions don't
  // parse object literals.
  loadPage(n) {
    this.state.users.refetch({ page: n })
  },
})
```

```html
<p data-if="users.loading">Loading…</p>
<p data-if="users.error">Couldn't load.</p>

<table data-show="users.data">
  <template data-each="users.data" data-key="id">  <!-- null while loading → no rows -->
    <tr><td data-text="item.name"></td></tr>
  </template>
</table>

<button @click="users.refetch()">Reload</button>
```

## Why this fits the shallow proxy

- **Each transition replaces the top-level key.** `instance.state[key] = {…}` is
  a top-level write, so the proxy schedules a render. No deep reactivity needed —
  the resource object is swapped wholesale on every change (loading → data /
  error). Mutating it in place (`users.loading = false`) would **not** render.
- **`refetch` rides on the object**, so the template can call `users.refetch()`
  directly (member calls work in directive expressions).
- **Stale responses can't win.** Each `refetch` aborts the previous request, so a
  slow first response can't overwrite a fresher one.

## Pitfalls

- **Don't write `data-each="users.data || []"`.** Micra's CSP-safe expression
  evaluator deliberately doesn't parse array/object literals. You don't need the
  guard: `data-each` renders nothing when its value is `null`/non-array. Use
  `data-each="users.data"`.
- **Pass object args from a method, not inline.** `@click="users.refetch({ page: 2 })"`
  won't parse for the same reason — call it from a method (`@click="loadPage"`).
- **Abort on unmount if a request can outlive the component.** The helper aborts
  on each `refetch`; if you tear down mid-flight, hold the returned handle and
  call its controller's `abort()` in `onDestroy`.
