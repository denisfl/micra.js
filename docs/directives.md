# Directives

Each directive runs against the current component state and method context.

Base context used in the examples:

```ts
Micra.define("example", {
  state: {
    name: "Ana",
    content: "<strong>Hi</strong>",
    count: 1,
    loaded: true,
    url: "/users/1",
    loading: false,
    search: "",
    tab: "home",
    items: [
      { id: 1, name: "Ada" },
      { id: 2, name: "Linus" },
    ],
  },

  save() {
    console.log("save");
  },

  increment() {
    this.state.count++;
  },

  select(item: { id: number; name: string }) {
    console.log(item);
  },
});
```

## `data-text`

Sets `textContent`.

```html
<h1 data-text="name"></h1>
```

Output: `Ana`

## `data-html`

Sets `innerHTML`.

```html
<div data-html="content"></div>
```

Output: `<strong>Hi</strong>` rendered as HTML.

> ⚠️ **XSS warning.** `data-html` writes the expression value directly as HTML.
> If the value comes from user input or any untrusted source, it can inject
> `<script>` / `<img onerror=...>` / etc. Mitigate in one of three ways:
> sanitize on the server, use `data-text` (which sets `textContent`) instead,
> or register a client-side sanitizer once — it runs on every `data-html`
> value:
>
> ```js
> import DOMPurify from 'dompurify'
> Micra.config({ sanitize: DOMPurify.sanitize })
> ```

## `data-if`

Mounts or **unmounts** the element from the DOM. When the expression is falsy,
the element is removed from the document and replaced with a comment placeholder.
When it becomes truthy again, the same element is re-inserted at the same spot.

```html
<p data-if="count > 0">Visible when count is positive</p>
```

Notes:

- DOM listeners and attributes on the detached element survive — re-mount keeps
  identity, no rebinding needed.
- `this.refs.X` is **undefined** while the element is detached.
- A `<template data-each>` inside a `data-if=false` subtree is suspended — it
  re-renders correctly when the parent comes back.

> Element is *gone* from the DOM, not just hidden. For accessibility (screen
> readers, focus traps) this is the right default. If you only want a cheap
> hide/show toggle on a small, frequently-toggled element, use `data-show`
> instead.

## `data-show`

Toggles `style.display`. The element **stays in the DOM** — only its visibility
changes.

```html
<div data-show="loaded">Content is ready</div>
```

Use `data-show` for cheap visibility toggling. Use `data-if` for conditional
mounting.

| | `data-if` | `data-show` |
|---|---|---|
| Element in DOM when falsy | no | yes |
| `style.display` modified | no | yes (`none`) |
| Listeners survive | yes (on the detached node) | yes |
| `this.refs.X` available when hidden | no | yes |
| Toggle cost | DOM mutation | one style write |
| Best for | conditional sections, a11y | toggling a tooltip / dropdown |

## `data-bind`

Binds one or more attributes.

```html
<a data-bind="href:url, aria-busy:loading">Profile</a>
<button data-bind="disabled:loading">Save</button>
```

Notes:

- boolean results add or remove the attribute
- `value:` syncs an input value without fighting the active field
- `class:` replaces the full `className`
- `style:` accepts a string or object

## `data-model`

Two-way binds an input, select, textarea, checkbox, or radio to a top-level state key.

```html
<input data-model="search" placeholder="Search" />
<p data-text="search"></p>
```

Typing into the input updates `this.state.search`. Re-renders update the field value.

Dot-paths are supported — the value is read and written through the path,
reconstructing the nested object immutably:

```html
<input data-model="filters.search" />
```

This reads and writes `this.state.filters.search` (equivalent to
`this.set('filters.search', …)`). Bracket/computed paths
(`filters[0]`) are not parsed — use dot notation.

## `data-each`

Renders a list from a `<template>`.

### Keyed

```html
<ul>
  <template data-each="items" data-key="id">
    <li data-text="item.name"></li>
  </template>
</ul>
```

In each row, Micra exposes:

- `item`
- `index`
- `$index`

Use keyed mode when items have stable IDs. Micra reuses and reorders existing nodes.

### Non-keyed

```html
<ul>
  <template data-each="items">
    <li data-text="item.name"></li>
  </template>
</ul>
```

Without `data-key`, Micra re-renders the whole list on updates.

## `data-ref`

Collects a DOM element into `this.refs`.

```html
<canvas data-ref="chart"></canvas>
```

```ts
onCreate() {
  const canvas = this.refs.chart
}
```

## `data-class`

Toggles classes additively from an object expression.

```html
<nav data-class="active:tab === 'home', loading:loading"></nav>
```

Unlike `data-bind="class:..."`, this keeps existing classes and toggles only the named ones.

## `data-on`

Binds DOM events to component methods.

```html
<button data-on="click:save">Save</button>
<form data-on="submit.prevent:save"></form>
<div data-on="click.stop:save"></div>
<div data-on="click.self:save"></div>
```

Supported modifiers:

- `.prevent` — calls `event.preventDefault()`
- `.stop` — calls `event.stopPropagation()`
- `.self` — only runs when `event.target === element`
- **Key guards** — `.enter`, `.escape`, `.tab`, `.space`, `.up`, `.down`, `.left`, `.right`, `.delete`. The handler runs only when `event.key` matches. An unlisted name matches `event.key` case-insensitively (e.g. `.a`).
- **System keys** — `.ctrl`, `.shift`, `.alt`, `.meta`. The handler runs only when that modifier is held.

Combine them: `@keydown.ctrl.enter="submit"` (Ctrl+Enter), `@keydown.escape.prevent="close"`.

You can bind multiple events:

```html
<input data-on="focus:save, blur:save" />
```

## `@event` shorthand

Shorthand for `data-on`.

```html
<button @click="increment">+</button>
<form @submit.prevent="save"></form>
<div @click.stop="save"></div>
<div @click.self="save"></div>
```

The same modifiers are supported:

- `.prevent`
- `.stop`
- `.self`

## Security model

Directive expressions (`data-text`, `data-if`, etc.) are **parsed and
interpreted by a built-in evaluator — there is no `new Function` or `eval`**,
so Micra runs under a strict Content-Security-Policy (`default-src 'self'`, no
`unsafe-eval`). Identifiers resolve in this order:

1. Component state keys
2. Component methods on the instance
3. A small set of whitelisted globals: `Math`, `JSON`, `Date`, `String`, `Number`, `Boolean`, `Array`, `Object`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `NaN`, `Infinity`, `undefined`

Everything else — `window`, `document`, `fetch`, `eval`, `setTimeout`,
`constructor`, etc. — is unreachable and resolves to `undefined`. This is
enforced *by construction* (no scope contains those names), not by shadowing.
Member access additionally refuses the prototype-escape property names
`__proto__`, `constructor`, and `prototype`, so `item.constructor.constructor("...")()`
resolves to `undefined` instead of reaching the `Function` constructor.

Two caveats apply regardless:

1. **`data-html`** writes raw HTML — see the warning above. Register
   `Micra.config({ sanitize })` to clean every value, or keep untrusted input
   out of it.
2. **Templates must be trusted.** The evaluator blocks accidental footguns and
   global access, but method calls run real JS — a method you exposed can do
   anything. If an attacker can inject the directive *string itself* (not just
   its value), they can call those methods. Treat directive markup the same way
   you treat the rest of your server-rendered HTML.
