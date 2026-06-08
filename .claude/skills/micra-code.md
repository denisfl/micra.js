# Micra.js — Code Conventions

Load this when the task involves writing or modifying Micra source code or components.

---

## Source file structure

```
src/
  index.ts          — public re-exports only, no logic
  types.ts          — all type definitions (public + internal)
  core/
    bus.ts          — global event bus (on/off/emit)
    mount.ts        — creates and wires a ComponentInstance (core runtime)
    reactive.ts     — createReactiveState (Proxy) + createScheduler (microtask batch)
    registry.ts     — define/mount registry, _instances map, debug/instances/registry
    start.ts        — scans DOM for [data-component], calls mount()
  dom/
    directives.ts   — applyDirectives: data-text/html/if/show/bind/model/class
    each.ts         — renderList: data-each, keyed diff algorithm
    events.ts       — bindDataOn (data-on), bindAtEvents (@event), bindModels
    query.ts        — queryOwn/queryAll helpers (stop at nested [data-component])
    refs.ts         — collectRefs: populates this.refs from data-ref
  utils/
    expr.ts         — evalExpr: fast-path + Function() + global cache
    fetch.ts        — micraFetch: CSRF, query params, JSON body, FetchError
```

---

## Naming conventions

- **Public exports**: camelCase (`define`, `mount`, `createReactiveState`)
- **Internal fields on DOM elements**: `__micra*` prefix (`__micraCache`, `__micraKey`, `__micraEvents`)
- **Internal instance fields**: `__micra*` prefix (`__micraSubs`)
- **Internal types**: `InternalInstance`, `MicraElement`, `MicraTemplate`, `DirectiveCache`, `CachedBinding`
- **Public types**: `ComponentInstance`, `ComponentDefinition`, `StateRecord`, `FetchOptions`, `UnsubFn`, `EventHandler`
- **Dev warnings**: always via `warn()` from `utils/expr.ts` — produces `[Micra] message`

---

## How reactivity works

```
mount()
  └─ createReactiveState(rawState, schedule)    → state Proxy
  └─ createScheduler(() => instance.render())   → schedule fn

state.key = value
  └─ Proxy.set trap fires
  └─ schedule() called
  └─ if already pending → no-op
  └─ Promise.resolve().then(() => render())     → microtask batch
```

- `rawState` is the original plain object — always available for reading without proxy overhead
- `exprState` is a second Proxy that falls back to instance methods for expressions

---

## exprState — how expressions see methods

```ts
const exprState = new Proxy(rawState, {
  get(target, key) {
    if (key in target)   return target[key]    // state property first
    if (key in instance) return instance[key]  // then method
    return undefined
  },
})
```

This is why `data-text="formatPrice(qty * 9.99)"` works — `formatPrice` resolves to the component method.

---

## Expression evaluator (utils/expr.ts)

Two paths:

1. **Fast path**: `/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/` — simple dot-paths like `count`, `user.name`. Resolved via `split('.').reduce(...)` — no `Function()`.
2. **Compiled path**: `new Function('$s', 'with($s){return (expr)}')` — compiled once, cached in a module-level `Map<string, fn>` keyed by expression string. Cache is global for the page.

Never call `Function()` at runtime without checking the cache first.

---

## Directive cache (dom/directives.ts)

On first `applyDirectives(root, ...)`:
- `buildCache(root)` runs `queryOwn(root, 'data-text')` etc. for each directive
- Result stored on `root.__micraCache` as `DirectiveCache`
- Subsequent renders call `applyFromList(el.__micraCache, state, rawState)` — no DOM scan

`DocumentFragment` (no-key `data-each` clones) never cache — they are temporary, always re-scanned.

---

## Adding a new directive

1. Add the attribute name to `DirectiveCache` in `src/types.ts`
2. Add an `apply*` function in `dom/directives.ts` (pure: reads state, writes DOM)
3. Add `pick('data-new')` to `buildCache()` and `buildFragmentList()`
4. Add the apply call in `applyFromList()`

Pattern for a new directive:
```ts
function applyNew(el: Element, expr: string, state: StateRecord): void {
  const val = evalExpr(expr, state)
  // … write to el
}
```

---

## How `mount()` works (core/mount.ts)

```
mount(selector, definition)
  1. Find root element — warn and return null if missing
  2. If already mounted (_instances.has(root)) — return existing instance
  3. Copy rawState = { ...definition.state }
  4. Create instance = { $el: root, refs: {} }
  5. Copy methods from definition onto instance (skip state/onCreate/onDestroy)
  6. Wire: instance.prop, instance.fetch, instance.emit, instance.on
  7. Create schedule + reactive state Proxy
  8. Create exprState Proxy (state + methods)
  9. Wire instance.render() — calls applyDirectives, renderList, bindEvents, collectRefs
  10. Wire instance.destroy() — runs __micraSubs unsubs + onDestroy
  11. _instances.set(root, instance)
  12. instance.render()   — synchronous initial render
  13. validateDirectives(root)  — dev warnings
  14. Promise.resolve().then(() => definition.onCreate?.call(instance))
```

---

## `query.ts` — scoping rules

`queryOwn(root, selector)` stops traversal at nested `[data-component]` elements.
This ensures directives only affect their own component subtree, not children that are mounted as separate components.

---

## `prop()` auto-cast rules

```
data-per-page="20"     → this.prop('perPage') → "20" (string, no default)
data-per-page="20"     → this.prop('perPage', 10) → 20 (number, default typed as T=number)
data-active="true"     → this.prop('active', false) → true (boolean)
data-active="false"    → this.prop('active', true) → false (boolean)
data-label="Sort by"   → this.prop('label', '') → "Sort by" (string)
```

Note: dataset keys are camelCase (`perPage` for `data-per-page`).

---

## Event binding internals

Three separate passes in `render()`:

1. **`bindDataOn(root, instance)`** — processes `data-on="event:method"` attrs; attaches listeners only once (skips if `__micraEvents` is set)
2. **`bindAtEvents(root, instance)`** — processes `@event="method"` shorthands; skips if `__micraAtScanned` is set on root
3. **`bindModels(root, instance)`** — attaches `input` listener for `data-model`; skips if `__micraModel` is set

Modifiers: `.prevent` → `e.preventDefault()`, `.stop` → `e.stopPropagation()`, `.self` → skip if `e.target !== el`.

---

## Keyed diff algorithm (dom/each.ts)

```
renderList(root, exprState, rawState, instance)
  for each <template data-each="key">
    if data-key present → keyed diff:
      1. build nextKeys = items.map(item => item[keyProp])
      2. for each item: reuse existing node from __micraNodes Map, or clone template
      3. apply directives to each row (item/index/$index added to state)
      4. reorder nodes with insertBefore
      5. remove nodes for dropped keys
    else → non-keyed:
      clone template × items.length, apply directives, replace children
```

---

## Critical patterns for LLM codegen

```ts
// ✓ Replace arrays — triggers re-render
this.state.items = [...this.state.items, newItem]
this.state.items = this.state.items.filter(i => i.id !== id)

// ✗ Mutate in place — does NOT re-render
this.state.items.push(newItem)
this.state.items.splice(0, 1)

// ✓ Replace nested objects
this.state.user = { ...this.state.user, name: 'Ana' }

// ✗ Mutate nested — does NOT re-render
this.state.user.name = 'Ana'

// ✓ Multiple writes → single render (microtask batch)
this.state.loading = true
this.state.page = 2
this.state.query = 'billing'

// ✓ Read data-* props in onCreate (not in state initializer)
async onCreate() {
  const page = this.prop('page', 1)
  this.state.items = await this.fetch('/api/items', { page })
}

// ✓ Outside-click cleanup pattern
onCreate() {
  this._outside = (e: MouseEvent) => {
    if (!this.$el.contains(e.target as Node)) this.state.open = false
  }
  document.addEventListener('click', this._outside)
},
onDestroy() {
  document.removeEventListener('click', this._outside)
}
```
