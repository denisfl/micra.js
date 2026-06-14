# Recipe: Rails + Micra.js

This recipe is the canonical answer to "how do I drop Micra into an existing
Rails app?". It walks through the two integration paths — **manual** (the
Rails-native way, zero gem dependency) and the **`micra-rails`** gem
(convenience helpers) — and then builds a small reactive Tasks board that
demonstrates the five SSR-friendly patterns Micra is designed for.

> **TL;DR.** Pin Micra via importmap, drop `<script type="module">…Micra.start()</script>`
> into your layout, write components in `app/javascript/`, render them with
> `<div data-component="…">` in ERB. CSRF, props, and event bus all work
> out of the box — Rails' default meta tags and `data-*` attributes are
> exactly the surface Micra was built to integrate with.

The two paths:

- **Manual** — works on any Rails ≥ 7.1 with importmap. ~12 lines of
  boilerplate, full control, no gem dep. Use this if you want to read
  every byte of integration code yourself.
- **`micra-rails` gem** — adds an ERB helper (`micra_component`) and a
  one-shot installer. Saves ~5 lines per component on the ERB side, but
  has [a few caveats](#using-the-micra-rails-gem-optional) at the moment.
  Use it if you accept those trade-offs in exchange for the shorter ERB.

## 1. Manual integration (no gem, ~12 lines total)

### a. Pin Micra in `config/importmap.rb`

```ruby
# config/importmap.rb
pin "application"
pin "micra",
    to: "https://cdn.jsdelivr.net/npm/micra.js@2.4.0/dist/micra.esm.js",
    preload: true
```

The CDN URL is the same one our `<script>`-tag recipe uses; importmap-rails
re-serves it through its own map so production caches and CSP rules apply
normally.

### b. Boot Micra from your application layout

```erb
<%# app/views/layouts/application.html.erb %>
<!DOCTYPE html>
<html>
  <head>
    <%= csrf_meta_tags %>
    <%= javascript_importmap_tags %>
    <script type="module">
      import * as Micra from "micra"
      window.Micra = Micra            // expose for non-module inline scripts
      document.addEventListener("DOMContentLoaded", () => Micra.start())
      document.addEventListener("turbo:load",        () => Micra.start())
    </script>
  </head>
  <body>
    <%= yield %>
  </body>
</html>
```

Three things to notice:

1. **`csrf_meta_tags` already there?** Then `this.fetch()` automatically
   sends `X-CSRF-Token` on every non-GET request. No extra configuration —
   `src/utils/fetch.ts` reads `<meta name="csrf-token">`, which Rails has
   been emitting since forever.
2. **`window.Micra` assignment.** Importmap modules don't leak symbols to
   the global scope, but you'll often want to `Micra.define()` from an inline
   `<script>` inside a partial. Exposing it on `window` keeps that ergonomic.
3. **`turbo:load` mirror.** If you're using Turbo Drive (the default in
   Rails 7+), `DOMContentLoaded` only fires once — on the *first* page
   load. After a Turbo navigation, `<body>` is swapped but `DOMContentLoaded`
   does NOT fire again, so new `[data-component]` elements never mount.
   `turbo:load` is the canonical signal for "page is ready, now or after a
   soft navigation". `Micra.start()` is idempotent so calling both is safe.

### c. Define components in `app/javascript/application.js`

```js
// app/javascript/application.js
import * as Micra from "micra"

Micra.define("counter", {
  state: { count: 0 },
  inc() { this.state.count++ },
  dec() { this.state.count-- },
})
```

If you're using a single `application.js`, all `Micra.define(...)` calls go
here. For larger apps, split per feature — `import "./components/tasks"` in
`application.js`, then a sibling `components/tasks.js` does the actual
`Micra.define`.

### d. Use the component in a view

```erb
<%# app/views/welcome/index.html.erb %>
<div data-component="counter">
  <button @click="dec">−</button>
  <strong data-text="count"></strong>
  <button @click="inc">+</button>
</div>
```

Done. The whole integration is what you see above: 12 lines of ERB-side
glue and one importmap pin.

## 2. Using the `micra-rails` gem (optional)

If the inline `<script>` block in your layout grows past comfort, or you
find yourself building lots of components with server-rendered props, the
[`micra-rails`](https://github.com/denisfl/micra-rails) gem adds three
helpers and a generator. As of version `0.2.0` it ships:

```bash
bundle add micra-rails
bin/rails generate micra:install
```

The installer pins Micra in `config/importmap.rb` and inserts
`<%= micra_includes %>` into your application layout. After that:

```erb
<%# Same as section 1d, but with the helper %>
<%= micra_component :counter, count: 0 do %>
  <button @click="dec">−</button>
  <strong data-text="count"></strong>
  <button @click="inc">+</button>
<% end %>
```

Which expands to `<div data-component="counter" data-count="0">…</div>` —
exactly the markup you would write by hand.

**Caveats to be aware of:**

- **The gem pins one specific Micra.js version** (its `MICRA_JS_VERSION`),
  which can lag the latest npm release between gem versions. If you want a
  newer Micra.js before the gem catches up, override the pin in your own
  `config/importmap.rb` — it wins over the gem's default:

  ```ruby
  # config/importmap.rb — override the gem's pin
  pin "micra",
      to: "https://cdn.jsdelivr.net/npm/micra.js@2.4.0/dist/micra.esm.js",
      preload: true
  ```

- **`micra_state(...).to_html`** as shown in the gem's README does not work
  — `Hash#to_html` isn't a Rails method. If you want inline state attributes
  on an existing element, expand them yourself:

  ```erb
  <%# Workaround until the helper returns a SafeBuffer %>
  <% attrs = micra_state(intent: "signup", token: form_token) %>
  <form id="signup" <%= attrs.map { |k, v| %(#{k}="#{ERB::Util.h(v)}") }.join(" ").html_safe %>>
    …
  </form>
  ```

  In practice it's usually cleaner to wrap the element with
  `micra_component` instead.

- **JSON-encoded props need client-side `JSON.parse`.** When you pass a
  non-primitive (Hash, Array, ActiveRecord `.as_json`), `micra_component`
  serializes it with `to_json` into the `data-*` attribute. But Micra's
  `this.prop()` returns the raw string — it doesn't auto-detect JSON. See
  [section 4d](#d-seeding-non-primitive-state-from-server-rendered-props)
  for the canonical seed-in-`onCreate` pattern.

- **`micra_includes` does NOT add a `turbo:load` listener.** It only wires
  `DOMContentLoaded`. If you're on Turbo Drive (default since Rails 7),
  add the listener manually:

  ```js
  // app/javascript/application.js
  import * as Micra from "micra"
  document.addEventListener("turbo:load", () => Micra.start())
  ```

None of these block the gem from being useful — they just need to be
known. The rest of this recipe assumes you can read either path.

## 3. The Tasks board — five canonical patterns

A board with a list of tasks. Each task has a title and a done flag. The
flow:

- Server SSR-renders the initial list inside a `data-component` wrapper.
- Adding, toggling, deleting are `this.fetch(...)` calls that return JSON.
- A separate component in the header — a "pending count" badge — listens
  to a `tasks:changed` event on the global bus.

The full markup is intentionally tiny so you can map every line to a
canonical pattern in [`docs/concepts.md`](../concepts.md).

### a. Schema and controller (Ruby)

```ruby
# db/migrate/…_create_tasks.rb
class CreateTasks < ActiveRecord::Migration[8.0]
  def change
    create_table :tasks do |t|
      t.string  :title, null: false
      t.boolean :done,  null: false, default: false
      t.timestamps
    end
  end
end
```

```ruby
# app/controllers/tasks_controller.rb
class TasksController < ApplicationController
  def index
    @tasks = Task.order(created_at: :asc)
    respond_to do |fmt|
      fmt.html  # renders index.html.erb (initial SSR)
      fmt.json { render json: @tasks.as_json(only: %i[id title done]) }
    end
  end

  def create
    task = Task.create!(title: params.require(:title))
    render json: task.as_json(only: %i[id title done])
  end

  def update
    task = Task.find(params[:id])
    task.update!(params.permit(:done))
    render json: task.as_json(only: %i[id title done])
  end

  def destroy
    Task.find(params[:id]).destroy!
    head :no_content
  end
end
```

```ruby
# config/routes.rb
resources :tasks, only: %i[index create update destroy]
```

No view-level surprises — this is a stock Rails JSON controller. Note
`fmt.html` falls through to the ERB view; `this.fetch` calls always
request JSON because Micra sets `Accept: application/json`.

### b. The ERB view — initial SSR

```erb
<%# app/views/tasks/index.html.erb %>
<header>
  <div data-component="pending-count"
       data-initial='<%= @tasks.count(&:not_done?) %>'>
    <span data-text="count"></span> pending
  </div>
</header>

<section data-component="tasks-board"
         data-initial-tasks='<%= @tasks.as_json(only: %i[id title done]).to_json %>'>
  <form @submit.prevent="add">
    <input data-model="draft" placeholder="New task…" maxlength="200" />
    <button data-bind="disabled:!draft.trim()">Add</button>
  </form>

  <ul>
    <template data-each="tasks" data-key="id">
      <li data-class="done:item.done">
        <label>
          <input type="checkbox" data-bind="checked:item.done" @change="toggle" />
          <span data-text="item.title"></span>
        </label>
        <button @click="remove" data-bind="data-id:item.id">×</button>
      </li>
    </template>
  </ul>
</section>
```

Two `data-component` roots — they're independent instances and can only
talk to each other via the global event bus.

Notice the SSR seed: `data-initial-tasks` carries the full list as JSON.
On the very first paint, before any JS has run, the list is empty (the
`<template data-each>` doesn't render anything client-side). The
component picks up the JSON in `onCreate` and seeds `state.tasks` — at
which point the first render fills in the rows. For a truly no-flicker
initial paint, see [section 4d](#d-seeding-non-primitive-state-from-server-rendered-props).

### c. The components

```js
// app/javascript/components/tasks.js (imported from application.js)
import * as Micra from "micra"

Micra.define("tasks-board", {
  state: { tasks: [], draft: "" },

  onCreate() {
    // SSR seed — data-initial-tasks holds JSON, parse once.
    const raw = this.prop("initialTasks")
    if (raw) this.state.tasks = JSON.parse(raw)
  },

  async add() {
    const title = this.state.draft.trim()
    if (!title) return
    const task = await this.fetch("/tasks", { method: "POST", body: { title } })
    this.state.tasks = [...this.state.tasks, task]
    this.state.draft = ""
    this.emit("tasks:changed", { tasks: this.state.tasks })
  },

  async toggle(e) {
    const id = Number(e.currentTarget.closest("li").querySelector("[data-id]")?.dataset.id
                      || e.currentTarget.dataset.id)
    const next = !this.state.tasks.find(t => t.id === id).done
    const task = await this.fetch(`/tasks/${id}`, { method: "PATCH", body: { done: next } })
    this.state.tasks = this.state.tasks.map(t => t.id === id ? task : t)
    this.emit("tasks:changed", { tasks: this.state.tasks })
  },

  async remove(e) {
    const id = Number(e.currentTarget.dataset.id)
    await this.fetch(`/tasks/${id}`, { method: "DELETE" })
    this.state.tasks = this.state.tasks.filter(t => t.id !== id)
    this.emit("tasks:changed", { tasks: this.state.tasks })
  },
})

Micra.define("pending-count", {
  state: { count: 0 },

  onCreate() {
    this.state.count = this.prop("initial", 0)        // primitive prop — auto-cast to number
    this.on("tasks:changed", ({ tasks }) => {
      this.state.count = tasks.filter(t => !t.done).length
    })
  },
})
```

Subscriptions made with `this.on` are auto-removed on `destroy()` — you
don't need an explicit `onDestroy`.

### d. Seeding non-primitive state from server-rendered props

Primitives (`number`, `boolean`, `string`) round-trip cleanly: `data-count="3"`
→ `this.prop('count')` returns `3` as a number. But for arrays and
objects, Micra deliberately does not assume JSON — the prop comes back as
the literal string from the attribute. The pattern is "parse in `onCreate`",
which the component above already follows.

A no-flicker alternative for SSR-heavy pages: instead of seeding in
`onCreate` (which runs in a microtask, after the initial render — see the
[hydration contract](../ssr.md#hydration-contract)), inline the state
into the definition so the very first render already matches the server's
HTML:

```erb
<%# When you want truly zero flicker — define inline next to the view %>
<section data-component="tasks-board">
  …
</section>

<script type="module">
  import * as Micra from "micra"
  Micra.define("tasks-board", {
    state: {
      tasks: <%= raw @tasks.as_json(only: %i[id title done]).to_json %>,
      draft: "",
    },
    // …same methods as above, minus the onCreate seed
  })
</script>
```

Trade-off: this couples one definition to one view, so reuse is harder.
Use it where flicker matters (above-the-fold lists, dashboards); use the
`data-*` + `onCreate` pattern everywhere else.

## 4. CSRF — already handled

Rails' default layout ships `<%= csrf_meta_tags %>`, which emits:

```html
<meta name="csrf-param" content="authenticity_token">
<meta name="csrf-token" content="…">
```

[`src/utils/fetch.ts`](../../src/utils/fetch.ts) reads that token and
sends `X-CSRF-Token` on every non-GET request:

```ts
const csrf = getCSRF()
if (csrf) headers['X-CSRF-Token'] = csrf
```

So `this.fetch('/tasks', { method: 'POST', body: {...} })` works against
a stock Rails controller — no `protect_from_forgery with: :null_session`
hack, no manual header juggling. Just keep `<%= csrf_meta_tags %>` in
your layout (it's there by default).

If you're inside an API-only controller hierarchy
(`ActionController::API`) that doesn't have CSRF protection, the header
is ignored harmlessly.

## 5. Turbo Drive, Turbo Streams, and Turbo Frames

The integration story changes by Turbo feature.

### Turbo Drive — works with the `turbo:load` listener

Drive replaces `<body>` on click-through navigations without a full
reload. The fix in section 1b's layout (`turbo:load` listener) is all
that's needed. After every soft navigation, `Micra.start()` rescans the
new DOM and mounts any new `[data-component]` elements; already-mounted
ones are skipped (`start()` is idempotent).

Turbo Drive does NOT unmount instances on navigation — the `<body>` is
swapped, the old DOM nodes are gone, but their JS-side `__micraScan` and
event-bus subscriptions linger. For most apps this is fine (the GC
catches them within a tick). If you have long-lived dashboards that
navigate frequently and accumulate bus subscriptions, hook
`turbo:before-visit` to destroy them first:

```js
document.addEventListener("turbo:before-visit", () => {
  Micra.instances().forEach(inst => inst.destroy())
})
```

### Turbo Streams — server-driven swaps

Stream actions (`<turbo-stream action="append" target="tasks">…</turbo-stream>`)
replace fragments of the DOM. New fragments from the server can contain
`[data-component]` elements that need mounting. Listen to
`turbo:before-stream-render` for cleanup and `turbo:render` /
`turbo:frame-render` (depending on what's swapping) for re-mount:

```js
document.addEventListener("turbo:before-stream-render", (e) => {
  const target = document.getElementById(e.target.target)
  if (!target) return
  Micra.instances().forEach((inst, root) => {
    if (target.contains(root)) inst.destroy()
  })
})

document.addEventListener("turbo:render", () => Micra.start())
```

It's the same shape as the [htmx bridge](./htmx.md): destroy before swap,
mount after settle. If you're using Turbo Streams via WebSocket (the
default for `broadcast_*` ActionCable hooks), the same listeners fire.

### Turbo Frames — avoid co-locating with `data-component`

A `<turbo-frame>` with `src="..."` replaces its own `innerHTML` on
navigation. If a `[data-component]` element is inside the frame, the
swap leaves its cached `__micraScan` pointing at gone DOM — exactly the
htmx footgun.

Two ways out:

1. Put `data-component` on a wrapper *outside* the `<turbo-frame>`, so
   the swap target is purely inside Micra-managed DOM.
2. Listen to `turbo:frame-render` and re-mount the frame's contents:

   ```js
   document.addEventListener("turbo:frame-render", (e) => {
     Micra.instances().forEach((inst, root) => {
       if (e.target.contains(root) && root !== e.target) inst.destroy()
     })
     Micra.start(e.target)
   })
   ```

## 6. Things to avoid

- **Don't put `[data-component]` directly on a `<turbo-frame src=…>` if
  the frame swaps its own innerHTML.** Same root cause as putting
  `hx-swap` on a `data-component`. Wrap or use a separate frame target.
- **Don't forget the `turbo:load` listener** if you use Turbo Drive. The
  symptom: components on the landing page mount, components on every
  subsequent page do nothing. Easy to miss because the landing case
  works.
- **Don't return HTML from a JSON endpoint.** Micra's `this.fetch()`
  reads the response `Content-Type`: if it includes
  `application/json`, you get parsed JSON; otherwise you get a string.
  Forgetting `respond_to do |fmt| fmt.json` will dump ERB into a string
  variable, then `JSON.parse` somewhere downstream throws.
- **Don't return an empty body for non-2xx responses.** Micra throws
  `FetchError(message, status, response)` on non-2xx — if your endpoint
  returns `422 { errors: {...} }` for a validation failure, parse the
  body server-side: `catch (e) { if (e instanceof FetchError) {
  const errs = await e.response.json(); ... } }`.
- **Don't put `Micra.start()` in a `<script defer>` if your layout also
  has `turbo:load`.** Duplicate calls are safe but make initialization
  order harder to reason about. One source of truth: the module script
  in section 1b.
- **Don't JSON-stringify primitives into `data-*` attributes.** Numbers
  and booleans are already strings on the wire; let Micra's auto-cast
  pick them up (`data-count="3"` → `this.prop('count') === 3`). Only
  arrays / hashes need the `JSON.parse` round-trip.

## 7. Pairing with Stimulus

You can run Stimulus and Micra side-by-side on the same page — they
don't fight. Different DOM trees, different identifiers
(`data-controller` vs `data-component`). The clean split:

- **Stimulus** for stateless DOM behaviors — clipboard copy, scroll
  detection, table-row hover, dropdown open/close *without* needing
  reactive state.
- **Micra** for pages where state drives the UI — search-with-results,
  multi-step forms, dashboards, anything where a button click should
  ripple through three other elements.

If a controller is just `state + N event handlers + a template that
re-renders`, that's Micra. If it's "find this child, animate it,
forget", that's Stimulus.

## 8. Skeleton (one-shot copy-paste)

For a fresh Rails 8 app with Micra wired in:

```bash
rails new tasks-demo
cd tasks-demo

# 1. Pin Micra
cat >> config/importmap.rb <<'EOF'
pin "micra",
    to: "https://cdn.jsdelivr.net/npm/micra.js@2.4.0/dist/micra.esm.js",
    preload: true
EOF

# 2. Boot block — copy into <head> of app/views/layouts/application.html.erb:
#
#   <script type="module">
#     import * as Micra from "micra"
#     window.Micra = Micra
#     document.addEventListener("DOMContentLoaded", () => Micra.start())
#     document.addEventListener("turbo:load",        () => Micra.start())
#   </script>

# 3. Scaffold a resource
rails g scaffold Task title:string done:boolean
rails db:migrate
```

Then convert the generated `index.html.erb` to a `data-component` wrapper
following section 3b, add the component to `app/javascript/application.js`
following section 3c, and the board is live.

## See also

- [Concepts](../concepts.md) — reactive proxy, batch scheduler, expression
  evaluator
- [SSR + hydration contract](../ssr.md) — what's guaranteed on the first
  render, no-flicker pattern
- [htmx bridge](./htmx.md) — sibling recipe; Turbo Streams use the same
  cleanup/mount pattern
- [API reference: `MicraEvents`](../api-reference.md#micraevents) — type
  the events you emit and listen for
- [`micra-rails` gem](https://github.com/denisfl/micra-rails) — the
  optional ERB helpers
