# Changelog

All notable changes to Micra.js will be documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[SemVer](https://semver.org/spec/v2.0.0.html).

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
