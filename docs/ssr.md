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

## Safe repeated starts

`Micra.start()` is idempotent for already-mounted roots.

```ts
Micra.start()
Micra.start()
Micra.start(document.getElementById('new-fragment')!)
```

Existing instances are skipped, so repeated calls are safe after partial page updates or HTML inserts.
