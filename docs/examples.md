# Examples

## 1. Counter

### HTML

```html
<div data-component="counter">
  <button @click="decrement">-</button>
  <strong data-text="count"></strong>
  <button @click="increment">+</button>
  <button @click="reset">Reset</button>
</div>
```

### JS

```ts
import * as Micra from 'micra.js'

Micra.define('counter', {
  state: { count: 0 },

  increment() { this.state.count++ },
  decrement() { this.state.count-- },
  reset() { this.state.count = 0 },
})

Micra.start()
```

## 2. User table with search and pagination

### HTML

```html
<div data-component="users-table">
  <input data-model="query" placeholder="Search users">

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Name</th>
        <th>Email</th>
      </tr>
    </thead>
    <tbody>
      <template data-each="pagedUsers" data-key="id">
        <tr>
          <td data-text="item.id"></td>
          <td data-text="item.name"></td>
          <td data-text="item.email"></td>
        </tr>
      </template>
    </tbody>
  </table>

  <p data-text="summary()"></p>

  <button data-bind="disabled:page <= 1" @click="prevPage">Previous</button>
  <button data-bind="disabled:endIndex() >= filteredUsers().length" @click="nextPage">Next</button>
</div>
```

### JS

```ts
import * as Micra from 'micra.js'

Micra.define('users-table', {
  state: {
    query: '',
    page: 1,
    perPage: 5,
    users: [
      { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
      { id: 2, name: 'Linus Torvalds', email: 'linus@example.com' },
      { id: 3, name: 'Grace Hopper', email: 'grace@example.com' },
      { id: 4, name: 'Margaret Hamilton', email: 'margaret@example.com' },
      { id: 5, name: 'Edsger Dijkstra', email: 'edsger@example.com' },
      { id: 6, name: 'Barbara Liskov', email: 'barbara@example.com' },
    ],
  },

  filteredUsers() {
    const q = this.state.query.toLowerCase()
    return this.state.users.filter(user =>
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q),
    )
  },

  startIndex() {
    return (this.state.page - 1) * this.state.perPage
  },

  endIndex() {
    return this.startIndex() + this.state.perPage
  },

  pagedUsers() {
    return this.filteredUsers().slice(this.startIndex(), this.endIndex())
  },

  summary() {
    return `Page ${this.state.page} · ${this.filteredUsers().length} matching users`
  },

  nextPage() {
    if (this.endIndex() < this.filteredUsers().length) this.state.page++
  },

  prevPage() {
    if (this.state.page > 1) this.state.page--
  },
})

Micra.start()
```

## 3. Async data fetch with loading state

### HTML

```html
<div data-component="user-loader">
  <button @click="load">Reload</button>
  <p data-if="loading">Loading...</p>
  <pre data-if="!loading" data-text="prettyUser()"></pre>
</div>
```

### JS

```ts
import * as Micra from 'micra.js'

Micra.define('user-loader', {
  state: {
    loading: false,
    user: null as null | { id: number; name: string; email: string },
  },

  async onCreate() {
    await this.load()
  },

  async load() {
    this.state.loading = true
    try {
      this.state.user = await this.fetch('/api/user') as { id: number; name: string; email: string }
    } finally {
      this.state.loading = false
    }
  },

  prettyUser() {
    return JSON.stringify(this.state.user, null, 2)
  },
})

Micra.start()
```

## 4. Modal with event bus

### HTML

```html
<button data-component="modal-button" @click="open">Open modal</button>

<div data-component="modal" data-if="open">
  <div class="backdrop" @click.self="close">
    <div class="dialog">
      <h2>Modal</h2>
      <p>Hello from Micra.</p>
      <button @click="close">Close</button>
    </div>
  </div>
</div>
```

### JS

```ts
import * as Micra from 'micra.js'

Micra.define('modal-button', {
  open() {
    this.emit('modal:open')
  },
})

Micra.define('modal', {
  state: { open: false },

  onCreate() {
    this.on('modal:open', () => {
      this.state.open = true
    })
  },

  close() {
    this.state.open = false
  },
})

Micra.start()
```

## 5. Multiple dropdowns (same definition, independent state)

One definition, many instances — each with its own `data-*` props.

### HTML

```html
<div id="sort-dd"   data-component="dropdown" data-label="Sort by"></div>
<div id="status-dd" data-component="dropdown" data-label="Status"></div>
<div id="per-page-dd" data-component="dropdown" data-label="Per page"></div>
```

```html
<!-- The shared dropdown template structure (inside each root) -->
<button @click="toggle" data-text="label"></button>
<ul data-if="open">
  <template data-each="options" data-key="value">
    <li @click="select" data-bind="data-value:item.value" data-text="item.label"></li>
  </template>
</ul>
```

### JS

```ts
import * as Micra from 'micra.js'

Micra.define('dropdown', {
  state: {
    open: false,
    label: 'Choose...',
    options: [] as { label: string; value: string }[],
  },

  onCreate() {
    this.state.label = this.prop('label', 'Choose...')
    // Close on outside click
    this._outside = (e: MouseEvent) => {
      if (!this.$el.contains(e.target as Node)) this.state.open = false
    }
    document.addEventListener('click', this._outside)
  },

  onDestroy() {
    document.removeEventListener('click', this._outside)
  },

  toggle() {
    this.state.open = !this.state.open
  },

  select(e: Event) {
    const value = (e.currentTarget as HTMLElement).dataset['value'] ?? ''
    this.state.label = value
    this.state.open  = false
    // Publish so other components can react
    this.emit('dropdown:change', { id: this.$el.id, value })
  },
})

Micra.start()
```

### Reacting to dropdown changes from another component

```ts
Micra.define('user-table', {
  state: { users: [], statusFilter: 'all' },

  onCreate() {
    this.on('dropdown:change', ({ id, value }: { id: string; value: string }) => {
      if (id === 'status-dd') {
        this.state.statusFilter = value
      }
    })
  },
})
```

---

## 6. Tabs

```html
<div data-component="tabs" data-default-tab="overview">
  <nav>
    <button @click="select" data-bind="data-tab:'overview'"
            data-class="active:tab === 'overview'">Overview</button>
    <button @click="select" data-bind="data-tab:'billing'"
            data-class="active:tab === 'billing'">Billing</button>
    <button @click="select" data-bind="data-tab:'security'"
            data-class="active:tab === 'security'">Security</button>
  </nav>

  <section data-if="tab === 'overview'">Overview content</section>
  <section data-if="tab === 'billing'">Billing content</section>
  <section data-if="tab === 'security'">Security content</section>
</div>
```

```ts
Micra.define('tabs', {
  state: { tab: 'overview' },

  onCreate() {
    this.state.tab = this.prop('defaultTab', 'overview')
  },

  select(e: Event) {
    this.state.tab = (e.currentTarget as HTMLElement).dataset['tab'] ?? 'overview'
  },
})
```

---

## 7. Autocomplete / search input

```html
<div data-component="autocomplete">
  <input data-model="query" @input="search" placeholder="Search users…">
  <ul data-if="suggestions.length > 0">
    <template data-each="suggestions" data-key="id">
      <li @click="pick" data-bind="data-id:item.id, data-email:item.email"
          data-text="item.name"></li>
    </template>
  </ul>
  <p data-if="selected" data-text="'Selected: ' + selected"></p>
</div>
```

```ts
Micra.define('autocomplete', {
  state: {
    query: '',
    suggestions: [] as { id: number; name: string; email: string }[],
    selected: '',
  },

  async search() {
    const q = this.state.query.trim()
    if (q.length < 2) { this.state.suggestions = []; return }
    this.state.suggestions = await this.fetch('/api/users', { q }) as typeof this.state.suggestions
  },

  pick(e: Event) {
    const el = e.currentTarget as HTMLElement
    this.state.selected  = el.dataset['email'] ?? ''
    this.state.query     = el.textContent ?? ''
    this.state.suggestions = []
    this.emit('user:selected', { id: Number(el.dataset['id']), email: this.state.selected })
  },
})
```

---

## 8. Inline edit (click to edit)

```html
<div data-component="inline-edit" data-value="Alice Liddell">
  <span data-if="!editing" data-text="value" @click="startEdit"></span>
  <input data-ref="input" data-if="editing" data-model="value" @blur="save" @keydown="onKey">
</div>
```

This example branches on `e.key` inside `onKey`, but since 2.5 you can also use the `@keydown.enter` / `@keydown.escape` modifiers directly.

```ts
Micra.define('inline-edit', {
  state: { value: '', editing: false },

  onCreate() {
    this.state.value = this.prop('value', '')
  },

  startEdit() {
    this.state.editing = true
    // focus the input after render
    setTimeout(() => this.refs['input']?.focus(), 0)
  },

  onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') this.save()
  },

  save() {
    this.state.editing = false
    this.emit('inline-edit:saved', { el: this.$el, value: this.state.value })
  },
})
```

---

## 9. Charts with data-ref

Use `data-ref` to get a direct DOM reference for imperative APIs (canvas, third-party charts).

```html
<div data-component="revenue-chart" data-endpoint="/api/revenue">
  <canvas data-ref="canvas" width="600" height="300"></canvas>
  <p data-if="loading">Loading chart…</p>
</div>
```

```ts
declare const Chart: { new(el: HTMLCanvasElement, cfg: unknown): { destroy(): void } }

Micra.define('revenue-chart', {
  state: { loading: true },
  _chart: null as unknown,

  async onCreate() {
    const endpoint = this.prop('endpoint', '/api/revenue')
    const data = await this.fetch(endpoint)
    this._chart = new Chart(this.refs['canvas'] as HTMLCanvasElement, {
      type: 'line',
      data,
    })
    this.state.loading = false
  },

  onDestroy() {
    (this._chart as { destroy(): void } | null)?.destroy()
  },
})
```
