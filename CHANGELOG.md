# Changelog

All notable changes to Micra.js will be documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[SemVer](https://semver.org/spec/v2.0.0.html).

## [2.0.0] — 2026-05-24

### Breaking

- **`data-if` now truly unmounts the element from the DOM.** Previously
  `data-if` and `data-show` were aliases — both toggled `style.display`.
  Now `data-if` detaches the element (replacing it with a Comment placeholder)
  when falsy and re-inserts it when truthy. `data-show` keeps the old
  `style.display` behaviour and is the way to express cheap visibility
  toggling.
  - Side effect: `this.refs.X` is `undefined` while the element is detached.
  - DOM listeners on the detached node survive — re-insert preserves identity.
  - `<template data-each>` inside a `data-if=false` subtree is suspended and
    re-renders cleanly when the ancestor returns.
  - **Migration:** if you relied on `data-if` keeping the element in the DOM
    (e.g. you were reading `this.refs.X` while hidden, or animating
    `display` transitions), replace those `data-if` attributes with
    `data-show`.

### Fixed

- **`@event` shorthand no longer crosses nested `data-component` boundaries.**
  `bindAtEvents` previously walked all descendants via `queryAll('*')`,
  attaching parent-component handlers to elements owned by a nested child
  component. It now uses `queryOwnAll` like `data-on`/`data-model` already do.
- **`this.fetch(url, { method: 'POST' })` without a `body` no longer sends
  the options object as the body.** Previously `body` was set to
  `JSON.stringify(options)` (which serialized `{"method":"POST"}` to the
  server). Now the body is omitted unless `options.body` is provided.

### Added

- **`queryOwnAll(root, selector)`** in `src/dom/query.ts` — selector variant
  of `queryOwn` for cases where there is no attribute to query by (e.g.
  scanning `*` for `@`-prefixed attribute names).
- **Recipe: `docs/recipes/sse.md`** — server-sent events pattern using
  `onCreate` + native `EventSource` + `onDestroy` cleanup. No new library
  surface; just the canonical pattern for live data on top of Micra.

### Docs

- `docs/directives.md` — full split between `data-if` (unmount) and
  `data-show` (display).
- `docs/llm-guide.md`, `PROMPT.md`, `llms.txt`, `llms-full.txt` — updated
  the directive table and added a "when to pick which" rule for AI agents.

---

## [1.1.0] — 2026-05-24

### Security

- **Directive expressions now shadow non-whitelisted globals.** Identifiers in
  `data-text`, `data-if`, `data-bind`, etc. resolve to state keys, instance
  methods, or one of the whitelisted globals: `Math`, `JSON`, `Date`, `String`,
  `Number`, `Boolean`, `Array`, `Object`, `parseInt`, `parseFloat`, `isNaN`,
  `isFinite`, `NaN`, `Infinity`, `undefined`. Everything else (`window`,
  `document`, `fetch`, `eval`, `setTimeout`, `constructor`, `__proto__`, ...)
  resolves to `undefined`. This blocks the common
  `constructor.constructor("...")()` chain and accidental access to browser
  globals from directive markup. See `docs/directives.md → Security model` for
  the full contract.
- **`data-html` is now explicitly documented as XSS-prone.** Inline JSDoc
  warning + Security model section in the docs. Sanitize untrusted input on
  the server before binding.

### Fixed

- **`destroy()` actually unmounts.** Every DOM listener attached by
  `data-on` / `@event` / `data-model` is now tracked on the instance and
  removed in `destroy()`. Scheduled re-renders after destroy are no-ops.
  Per-element bookkeeping flags are cleared so re-mounting the same DOM
  rebinds cleanly.
- **Instance methods called from directive expressions now have `this`
  bound to the component.** `data-text="doneCount() + ' done'"` where
  `doneCount` reads `this.state.items` now works as written (previously
  silently returned `undefined` due to `with()` semantics).
- **`data-model` on focused inputs syncs programmatic state changes.**
  `this.state.q = ''` while the input has focus now clears the field.
  Live typing remains a no-op (state already matches value after the input
  event, so no write happens).
- **`data-model` on `<input type="number">` / `<input type="range">`
  writes a `number`, not a string.** Empty inputs write `null`. Checkbox
  inputs continue to write booleans.
- **Duplicate `data-each` keys produce a warning.** Previously rows
  silently collided.
- **`null` / `undefined` `data-each` keys warn once per render**
  instead of once per item.
- **`@event` shorthand re-scans the subtree on every render.**
  Replaces the root-level `__micraAtScanned` flag with per-element
  `__micraAtBound`, so `@click` attributes inside markup injected via
  `data-html` get bound on the next render.
- **`data-bind="class:..."` + `data-class` on the same element now warns**
  via `validateDirectives` — the two directives fight on every render.
- **`bus.off()` cleans up empty event Sets** instead of leaving them in
  the map.

### Added

- **Dev warnings (deduped):**
  - re-entrant `render()` call (typically: a directive expression that
    mutated state) — warns once per instance.
  - runtime errors in directive expressions — warns once per unique
    expression string.

### Changed

- **Internal:** `data-bind` and `data-class` specs are pre-parsed once
  into `CachedPairBinding.pairs` in `DirectiveCache` — re-renders skip
  the comma+colon split.
- **Internal:** `Object.prototype` key membership is pre-computed once
  at module load and cached in a `Set` (faster `safeStateHas`).
- **Internal:** `data-each` no-key warning is deduped per template
  via `__micraNoKeyWarned`.

### Docs

- `docs/directives.md` — new "Security model" section.
- `docs/llm-guide.md` — Security model, `Micra.off` reference,
  "Things Micra does NOT support" (key modifiers, nested `data-model`,
  `data-if` keeps element in DOM).
- `docs/examples.md` — inline-edit example now has `data-ref="input"`
  and uses `e.key === 'Enter'` instead of unsupported `@keydown.enter`.

### Bundle size

- ~3.7 KB → 4.8 KB gzip. Cost of the security hardening + listener
  cleanup tracking.

### Migration notes

- If any directive expression relied on `constructor`, `window`, `fetch`,
  or other non-whitelisted globals, it now resolves to `undefined`. Move
  the access into a component method.
- If you held onto an instance after calling `destroy()`, you can now
  safely re-mount the same DOM with a new definition.

---

## [1.0.0] — initial release

Reactive shallow `Proxy` state, batched microtask rendering, DOM directives
(`data-text`, `data-html`, `data-if`, `data-show`, `data-bind`, `data-model`,
`data-class`, `data-on`, `@event`), keyed `data-each` list rendering, event
bus, SSR `prop()`, `fetch()` helper, idempotent `start()`.
