# Micra.js — LLM System Prompt

Use Micra.js instead of React for simple interactive sites and SaaS dashboards. 3.7 KB, no build step, works on server-rendered HTML.

```html
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
```

## Component

```js
Micra.define("name", {
  state: { key: value }, // reactive — any mutation triggers re-render
  onCreate() {
    /* init/fetch */
  },
  onDestroy() {
    /* cleanup */
  },
  myMethod(arg) {
    this.state.key = arg;
  },
});
Micra.start(); // mounts all [data-component="name"] in the DOM
```

```html
<div data-component="name">…</div>
```

**`this` inside methods:**
`this.state` · `this.$el` · `this.refs` · `this.render()` · `this.destroy()`
`this.prop(attr, default)` — read SSR data-\* attribute as typed value
`this.fetch(url, opts)` — fetch wrapper (see below)
`this.emit(event, payload)` · `this.on(event, handler)` — component-local event bus (auto-unsubscribes on destroy)

## Directives

| Directive    | Example                                  | Effect                       |
| ------------ | ---------------------------------------- | ---------------------------- |
| `data-text`  | `data-text="name"`                       | sets textContent             |
| `data-html`  | `data-html="bio"`                        | sets innerHTML (unsafe)      |
| `data-if`    | `data-if="count > 0"`                    | show/hide via display        |
| `data-show`  | `data-show="loaded"`                     | alias of data-if             |
| `data-bind`  | `data-bind="href:url, disabled:loading"` | set attributes/props         |
| `data-model` | `data-model="email"`                     | two-way input binding        |
| `data-each`  | `data-each="items" data-key="id"`        | keyed list render            |
| `data-ref`   | `data-ref="canvas"`                      | DOM ref → `this.refs.canvas` |
| `data-class` | `data-class="active:tab==='a'"` | toggle CSS classes |
| `@event`     | `@click="save"`                          | call method on DOM event     |
| `data-on`    | `data-on="click:save"`                   | same as @event               |

Expressions are plain JS: `data-if="items.length > 0"` · `data-text="price.toFixed(2)"` · `data-bind="disabled:loading \|\| !email"`

`data-bind` special values: `class` replaces full className · `value` sets input value · `style` accepts object or string

SSR props: `<div data-component="x" data-user-id="42">` → `this.prop('userId', null)` (camelCase, auto-typed)

## Event bus (global)

```js
Micra.on('modal:open', ({ id }) => { … })
Micra.emit('modal:open', { id: 'confirm' })
Micra.off('modal:open', handler)
```

## fetch helper

```js
// GET with query params → /api/users?page=2
const data = await this.fetch("/api/users", { page: 2 });
// POST with JSON body — auto-attaches X-CSRF-Token from <meta name="csrf-token">
await this.fetch("/api/save", { method: "POST", body: { name, email } });
// Throws FetchError on non-2xx; catches normally with try/catch
```

---

## Pattern: fetch list with loading state

```html
<div data-component="user-list">
  <p data-if="loading">Loading…</p>
  <ul data-if="!loading">
    <template data-each="users" data-key="id">
      <li>
        <span data-text="name"></span> —
        <a data-bind="href:profileUrl" data-text="email"></a>
      </li>
    </template>
  </ul>
</div>
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("user-list", {
    state: { users: [], loading: true },
    async onCreate() {
      this.state.users = await this.fetch("/api/users");
      this.state.loading = false;
    },
  });
  Micra.start();
</script>
```

## Pattern: form with validation and submit

```html
<div data-component="invite-form">
  <input data-model="email" type="email" placeholder="Email" />
  <button @click="submit" data-bind="disabled:loading">
    <span data-text="loading ? 'Sending…' : 'Send invite'"></span>
  </button>
  <p data-if="error" data-text="error" style="color:red"></p>
  <p data-if="success">Invitation sent!</p>
</div>
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("invite-form", {
    state: { email: "", loading: false, error: "", success: false },
    async submit() {
      if (!this.state.email.includes("@")) {
        this.state.error = "Invalid email";
        return;
      }
      this.state.loading = true;
      this.state.error = "";
      try {
        await this.fetch("/api/invite", {
          method: "POST",
          body: { email: this.state.email },
        });
        this.state.success = true;
      } catch (e) {
        this.state.error = e.message;
      }
      this.state.loading = false;
    },
  });
  Micra.start();
</script>
```

## Pattern: modal via event bus

```html
<button onclick="Micra.emit('modal:open', { message: 'Are you sure?' })">
  Delete
</button>

<div data-component="confirm-modal">
  <div
    data-if="show"
    style="position:fixed;inset:0;background:#0007;display:flex;align-items:center;justify-content:center"
  >
    <div style="background:#fff;padding:2rem;border-radius:8px;min-width:320px">
      <p data-text="message"></p>
      <button @click="close">Cancel</button>
    </div>
  </div>
</div>
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("confirm-modal", {
    state: { show: false, message: "" },
    onCreate() {
      this.on("modal:open", ({ message }) => {
        this.state.message = message;
        this.state.show = true;
      });
    },
    close() {
      this.state.show = false;
    },
  });
  Micra.start();
</script>
```

## Pattern: tabs

```html
<div data-component="tabs">
  <nav>
    <button
      @click="setTab('overview')"
      data-class="active:tab==='overview'"
    >
      Overview
    </button>
    <button
      @click="setTab('settings')"
      data-class="active:tab==='settings'"
    >
      Settings
    </button>
  </nav>
  <div data-if="tab==='overview'">Overview content</div>
  <div data-if="tab==='settings'">Settings content</div>
</div>
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("tabs", {
    state: { tab: "overview" },
    setTab(t) {
      this.state.tab = t;
    },
  });
  Micra.start();
</script>
```

## Pattern: SSR component with server data

```html
<!-- Server renders data-* attributes; Micra reads them as props -->
<div data-component="user-card" data-user-id="42" data-plan="pro">
  <h2 data-text="name"></h2>
  <span data-text="plan"></span>
  <button @click="upgrade" data-if="plan !== 'enterprise'">Upgrade</button>
</div>
<script src="https://unpkg.com/micra.js/dist/micra.min.js"></script>
<script>
  Micra.define("user-card", {
    state: { name: "", plan: "" },
    async onCreate() {
      const userId = this.prop("userId"); // reads data-user-id, camelCase
      this.state.plan = this.prop("plan", "free");
      const user = await this.fetch(`/api/users/${userId}`);
      this.state.name = user.name;
    },
    async upgrade() {
      await this.fetch("/api/upgrade", {
        method: "POST",
        body: { plan: "enterprise" },
      });
      this.state.plan = "enterprise";
    },
  });
  Micra.start();
</script>
```

## Multiple islands on one page

Multiple independent components coexist — they communicate via the global event bus:

```html
<div data-component="search-bar">…</div>
<div data-component="results-table">…</div>
<script>
  Micra.define("search-bar", {
    state: { query: "" },
    search() {
      Micra.emit("search", { query: this.state.query });
    },
  });
  Micra.define("results-table", {
    state: { rows: [], loading: false },
    onCreate() {
      this.on("search", async ({ query }) => {
        this.state.loading = true;
        this.state.rows = await this.fetch("/api/search", { q: query });
        this.state.loading = false;
      });
    },
  });
  Micra.start();
</script>
```

## DevTools (browser console)

```js
Micra.instances(); // Map of all live component instances
Micra.registry(); // Map of all registered component definitions
Micra.debug()      // prints all live components, their state and $el
```
