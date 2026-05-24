# Getting Started

## Installation

### CDN

```html
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
```

This exposes a global `Micra` object.

### npm

```bash
npm install micra.js
```

```ts
import * as Micra from "micra.js";
```

## Hello Micra

This example builds a small counter with automatic mounting.

### 1. Add HTML

```html
<div data-component="counter">
  <h1 data-text="count"></h1>
  <button @click="decrement">-</button>
  <button @click="increment">+</button>
</div>
```

`data-component="counter"` tells Micra which component definition to use.

### 2. Define the component

```ts
import * as Micra from "micra.js";

Micra.define("counter", {
  state: { count: 0 },

  increment() {
    this.state.count++;
  },

  decrement() {
    this.state.count--;
  },
});
```

- `state` becomes reactive when the component mounts.
- Changing `this.state.count` schedules a re-render.
- `@click="increment"` calls the matching method on the component instance.

### 3. Start Micra

```ts
Micra.start();
```

Micra scans the page for elements with `data-component`, looks up each registered definition, and mounts them.

## Step-by-step flow

When the page starts:

1. Micra finds `<div data-component="counter">`.
2. It looks for a registered `counter` definition.
3. It creates a component instance.
4. It wraps `state` in a reactive `Proxy`.
5. It renders directives like `data-text`.
6. It binds DOM events like `@click` and `data-on`.

After that, each state assignment triggers a batched re-render.

## How auto-mount works

Auto-mount is the default pattern for server-rendered HTML.

```html
<section data-component="dashboard"></section>
<section data-component="billing"></section>
```

```ts
Micra.define("dashboard", { state: {} });
Micra.define("billing", { state: {} });
Micra.start();
```

`Micra.start()`:

- scans a `Document` or `HTMLElement` root
- mounts every `[data-component]` element it finds
- skips elements that are already mounted
- is safe to call multiple times

You can also limit the scan to a subtree:

```ts
Micra.start(document.getElementById("account-panel")!);
```

## Direct mount

If you do not want auto-mount, mount directly:

```ts
const instance = Micra.mount("#counter", {
  state: { count: 0 },
  increment() {
    this.state.count++;
  },
});
```

`Micra.mount()` returns the instance or `null` if the element is missing.

## Debugging

While developing, inspect live components with `Micra.debug()`:

```ts
Micra.debug();
// [Micra] 3 live component(s)
//   counter   $el: <div>  state: { count: 5 }
//   dropdown  $el: <div>  state: { open: false, label: "Sort by" }
```

This prints every mounted component, its root element, and current state to the browser console — useful for checking that components mounted correctly and inspecting state values.
