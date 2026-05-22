# Directives

Each directive runs against the current component state and method context.

Base context used in the examples:

```ts
Micra.define('example', {
  state: {
    name: 'Ana',
    content: '<strong>Hi</strong>',
    count: 1,
    loaded: true,
    url: '/users/1',
    loading: false,
    search: '',
    tab: 'home',
    items: [
      { id: 1, name: 'Ada' },
      { id: 2, name: 'Linus' },
    ],
  },

  save() {
    console.log('save')
  },

  increment() {
    this.state.count++
  },

  select(item: { id: number; name: string }) {
    console.log(item)
  },
})
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

## `data-if`

Shows or hides an element by toggling `style.display`.

```html
<p data-if="count > 0">Visible when count is positive</p>
```

## `data-show`

Alias of `data-if`.

```html
<div data-show="loaded">Loaded</div>
```

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
<input data-model="search" placeholder="Search">
<p data-text="search"></p>
```

Typing into the input updates `this.state.search`. Re-renders update the field value.

Use top-level keys only:

```html
<input data-model="search">
```

Not:

```html
<input data-model="filters.search">
```

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

You can bind multiple events:

```html
<input data-on="focus:save, blur:save">
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
