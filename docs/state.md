# State

## Reactive state

`this.state` is a shallow reactive `Proxy`.

```ts
this.state.count = this.state.count + 1
```

Any assignment to a top-level key schedules a re-render.

## Flat proxy

Micra tracks top-level property writes only.

Works:

```ts
this.state.count = 2
this.state.user = { name: 'Ana' }
```

Does not trigger a render by itself:

```ts
this.state.user.name = 'Ana'
this.state.items.push(newItem)
```

Replace the parent value instead.

## Array replacement pattern

Replace arrays instead of mutating them in place.

```ts
this.state.items = [...this.state.items, nextItem]
this.state.items = this.state.items.filter(item => item.id !== id)
this.state.items = this.state.items.map(item =>
  item.id === id ? { ...item, name: 'Updated' } : item,
)
```

This is the recommended pattern for `data-each`.

## Nested objects

Nested objects are fine, but replace the top-level key when you change them.

```ts
this.state.filters = {
  ...this.state.filters,
  query: 'billing',
}
```

Think of state as a flat set of reactive entry points.

## TypeScript inference with `defineComponent`

`defineComponent()` returns the definition unchanged, but helps TypeScript infer the state shape.

```ts
import * as Micra from 'micra'

const counter = Micra.defineComponent({
  state: { count: 0 },

  increment() {
    this.state.count++
  },

  reset() {
    this.state.count = 0
  },
})

Micra.define('counter', counter)
```

Inside methods, `this.state.count` is typed as `number`.

## `exprState`

During render, Micra evaluates directive expressions against an internal proxy often described as `exprState`.

It resolves properties in this order:

1. raw state
2. instance methods and helpers

That means expressions can read state and call methods:

```html
<span data-text="count"></span>
<time data-text="formatDate(createdAt)"></time>
```

```ts
formatDate(value: string) {
  return new Date(value).toLocaleString()
}
```

The expression layer is read-only in practice. Update data through `this.state`, not through expressions.

## Force rendering

You normally do not need to call `this.render()`. State writes schedule rendering automatically.

Use `this.render()` only when you need an immediate synchronous refresh after non-state work.
