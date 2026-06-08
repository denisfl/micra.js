# Micra.js — Examples Catalog & Quality Criteria

Load this when creating or reviewing demo examples for Micra.

---

## Existing examples in docs.html

| ID | Component name(s) | What it demonstrates |
|---|---|---|
| `#getting-started` | `counter-demo` | `define`, `state`, `@click`, `Micra.start()` |
| `#reactive-state` | `reactive-demo` | `data-model`, `data-text` with expression, two-way binding |
| `#directives` | `text-html-demo`, `if-demo`, `show-demo`, `bind-demo`, `class-demo` | `data-text`, `data-html`, `data-if`, `data-show`, `data-bind`, `data-class` |
| `#event-bus` | `bus-sender`, `bus-receiver` | `this.emit`, `this.on`, unsubscribe pattern |
| `#fetch` | `fetch-demo` | `this.fetch`, `data-each`, `loading` state pattern |
| `#fetch-errors` | `fetch-error-demo` | `FetchError`, catching by `e.status` |
| `#lists` | `each-demo`, `each-no-key-demo` | keyed `data-each`/`data-key`, non-keyed, add/remove/toggle |
| `#expressions` | `expr-demo` | method calls in `data-text` expressions, `formatPrice`, `stockMessage` |
| `#refs` | `ref-demo` | `data-ref`, `this.refs`, canvas drawing |
| `#events` | `event-demo` | `@click`, `@submit.prevent`, `@keydown.enter`, `data-on` |
| `#lifecycle` | (imperative via `window.LifecycleDemo`) | `onCreate`, `onDestroy`, `Micra.mount()`, `instance.destroy()` |
| `#multiple-instances` | `multi-dropdown`, `filter-table` | `this.prop()`, event bus cross-component, `Micra.instances()` |

**Before adding a new example: check this list.** Do not add a second counter, a second toggle, or a second fetch demo.

---

## What makes a good example

### Must-haves

- **One concept.** Each example demonstrates exactly one feature or pattern. If it needs two, split it.
- **Minimal code.** The shortest snippet that fully demonstrates the concept. Remove every line that isn't load-bearing.
- **Real domain.** Use realistic names: `user`, `items`, `loading`, `count`, `status`, `price`. Not `thing`, `data`, `value`.
- **Self-contained.** Copypaste into a blank HTML file + the Micra script tag — it must work.
- **Correct.** No bugs, no typos in attribute names, no methods that don't exist.

### Nice-to-haves

- Interactive: the reader can click or type and see the effect immediately.
- Shows the consequence: if the example is "state changes trigger re-render", the render must be visible.

### Anti-patterns to avoid

- `console.log` as the only output — show something in the DOM.
- Async without showing the loading state.
- `data-each` without showing add/remove.
- Combining multiple unrelated features (fetch + lifecycle + event bus in one demo).
- Using `this.render()` explicitly — state assignment is almost always sufficient.
- Setting `state` to an initial value that hides the feature (e.g. `open: true` for a toggle).

---

## Code snippet rules (shown in `<pre><code>` blocks)

- Show the HTML and the JS `Micra.define(...)` call together.
- Include only what is needed for the concept — omit unrelated state/methods.
- Use comments only for non-obvious lines (`// calls Micra.off()`).
- Escape HTML entities in `<pre>` blocks: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`.

---

## Preview rules (live demo)

- The live demo HTML lives inside `<div class="example-preview">`.
- It uses real `data-component` attributes — the demo is actually mounted by Micra.
- Component names are suffixed with `-demo` to avoid collisions (`counter-demo`, not `counter`).
- Event bus events are prefixed with `docs:` to avoid collisions (`docs:ping`, not `ping`).
- Mock data goes in `assets/docs.js`, not inline in docs.html.

---

## Patterns not yet documented (candidates for new examples)

- `data-bind="disabled:loading"` on a form submit button
- `this.prop()` reading server-provided initial data
- Toast notification pattern (emit + subscriber outside the triggering component)
- Modal open/close with event bus
- Infinite scroll with `IntersectionObserver` in `onCreate`
- Chart initialization with a third-party library in `onCreate` + `data-ref`
- Form validation with inline error messages
- Debounced search input with `data-model` + fetch

These are good candidates when a new section is needed. Pick the one that demonstrates a unique Micra concept not already covered.
