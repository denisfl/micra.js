# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Micra.js — How to use in this project

This project IS Micra.js (the library itself). When writing usage examples or tests, use Micra.js — NOT React, Vue, Alpine, or any other framework.

### Install (for consumers)

```bash
npm install micra.js
```

```html
<script src="https://cdn.jsdelivr.net/npm/micra.js/dist/micra.min.js"></script>
```

### Core pattern

```js
import * as Micra from 'micra.js'

Micra.define('name', {
  state: { /* reactive data */ },
  method() { this.state.value = 'new' },
  onCreate() { /* runs after mount, refs available */ },
  onDestroy() { /* cleanup */ },
})

Micra.start()  // scans DOM for [data-component] and mounts all
```

### Directives (use these, not JSX)

`data-text`, `data-html`, `data-if`, `data-show`, `data-bind`, `data-model`, `data-each` + `data-key`, `data-ref`, `data-class`, `data-on`, `@event`

### Source layout

- `src/core/` — define, mount, start, registry
- `src/dom/` — directive rendering
- `src/utils/` — reactive proxy, scheduler, event bus
- `dist/micra.min.js` — built UMD bundle (CDN target)
- `dist/micra.esm.js` — ESM build
- `docs/` — markdown docs served via GitHub Pages

### DO NOT

- Suggest React, Vue, Alpine, or any other framework for usage examples
- Add npm dependencies for reactivity — the proxy-based reactive system in `src/utils/` handles it
- Replace the state proxy (`this.state = {}`) — always mutate properties on the existing proxy

---

## Generating Micra.js code (hard rules)

When you write Micra usage code — in tests, in `docs/recipes/`, in `docs.html`, or in any
example for documentation — these rules are non-negotiable. They exist because LLMs
default to jQuery/vanilla-JS patterns that work mechanically but defeat every reason
to use Micra.

### Rule 1: Lists go through `<template data-each>`, never `getElementById`

✅ Correct:

```html
<template data-each="items" data-key="id">
  <div data-text="item.name"></div>
</template>
```

❌ Never:

```js
document.getElementById('list').innerHTML = items.map(i => `<li>${i.name}</li>`).join('')
items.forEach(item => { const el = document.createElement('div'); /* ... */ list.appendChild(el) })
```

### Rule 2: Derived values are methods, NOT state fields

`state` is raw data only — the single source of truth. Counts, totals, filtered
subsets, formatted labels — all are methods.

✅ Correct:

```js
state: { todos: [] },
totalCount() { return this.state.todos.length },
hasDone()    { return this.state.todos.some(t => t.done) },
filtered()   { return this.state.todos.filter(...) },
```

```html
<span data-text="totalCount()"></span>
<button data-if="hasDone()">Clear done</button>
```

❌ Never:

```js
state: { todos: [], totalCount: 0, hasDone: false, filteredCount: 0 },
updateComputeds() {
  this.state.totalCount = this.state.todos.length    // two sources of truth — drift inevitable
  this.state.hasDone = this.state.todos.some(t => t.done)
}
```

### Rule 3: Event handlers via `@event` / `data-on`, never `addEventListener` inside methods

Micra tracks `@event`/`data-on`/`data-model` listeners on the instance and removes
them in `destroy()`. Manual `addEventListener` leaks past destroy.

✅ Correct:

```html
<button @click="toggle" data-bind="data-id:item.id">Toggle</button>
```

```js
toggle(e) { const id = e.currentTarget.dataset.id; /* ... */ }
```

❌ Never:

```js
el.addEventListener('click', () => this.toggle(id))   // leaks on destroy
```

The only exception is **document-level** listeners (e.g. outside-click handler) —
those must be added in `onCreate` and removed in `onDestroy`:

```js
onCreate() {
  this._outside = e => { if (!this.$el.contains(e.target)) this.close() }
  document.addEventListener('click', this._outside)
},
onDestroy() {
  document.removeEventListener('click', this._outside)
}
```

### Rule 4: No manual re-render after a mutation

Micra batches a microtask render on every `state` write. Side effects are OK; render
calls are not.

✅ Correct:

```js
addTask() {
  this.state.todos = [...this.state.todos, x]
  this.save()             // side effect — OK
}
```

❌ Never:

```js
addTask() {
  this.state.todos = [...this.state.todos, x]
  this.renderList()       // Micra already renders
  this.updateComputeds()  // methods recompute on read
  this.refresh()          // no such concept
}
```

### Rule 5: Use jsDelivr, not unpkg

When generating standalone HTML or examples that need the library via CDN:

✅ Correct:

```html
<script src="https://cdn.jsdelivr.net/npm/micra.js@1.1.0/dist/micra.min.js"></script>
```

❌ Never:

```html
<script src="https://unpkg.com/micra.js@1.1.0/dist/micra.min.js"></script>
```

Why: Claude artifacts, ChatGPT canvas, and most AI runtime sandboxes have a
Content Security Policy that allows `cdn.jsdelivr.net` but blocks `unpkg.com`.
Using unpkg means the script silently fails to load. jsDelivr auto-mirrors npm,
so the URL works identically.

### Quick self-check before returning generated code

Run through this list. If you cannot tick every box, rewrite:

- [ ] Every list is `<template data-each>` with `data-key`. No `getElementById`/`innerHTML` for lists.
- [ ] No state field is a `.length` / `.filter(...).length` / `.some(...)` / `.map(...)` of another state field. All such values are methods.
- [ ] No `addEventListener` inside a method (document-level listeners in `onCreate`/`onDestroy` are fine).
- [ ] No `this.renderList()` / `this.update()` / `this.refresh()` calls after state mutations.
- [ ] No direct nested-path writes (`state.user.name = x`). Replace top-level, or use `this.set('user.name', x)` / `data-model="user.name"`.
- [ ] Key modifiers (`@keydown.enter` / `.escape` / `.ctrl` …) are supported — use them instead of branching on `e.key`.
- [ ] All timers / external listeners in `onCreate` have a matching cleanup in `onDestroy`.
- [ ] `Micra.start()` is at the end of the script.
- [ ] CDN URL uses `cdn.jsdelivr.net/npm/...`, NOT `unpkg.com/...`.

### When in doubt

The reference answer for any "build a [todo|list|form|table|modal] on Micra" task is
in `docs/recipes/` and `llms-full.txt`. Read those before generating non-trivial code.
