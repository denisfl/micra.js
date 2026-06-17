# Changelog

All notable changes to Micra.js will be documented in this file. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows
[SemVer](https://semver.org/spec/v2.0.0.html).

## [2.6.0] — 2026-06-17

### Added — nested `data-each`

- **`<template data-each>` now renders when nested inside another `data-each`
  row.** Previously a nested template was scanned but never rendered — its list
  silently stayed empty, because the per-row directive pass (`applyDirectives`)
  did not recurse into the row's own nested templates. Each row now renders its
  nested `data-each` against its own row scope (`itemState`), so the inner
  list's source expression sees the outer `item`:

  ```html
  <template data-each="columns" data-key="id">
    <section>
      <h3 data-text="item.name"></h3>
      <template data-each="cardsIn(item.id)" data-key="id">
        <article data-text="item.title"></article>
      </template>
    </section>
  </template>
  ```

  Inside the inner template `item` is the inner row; the outer `item` is in
  scope where the inner `data-each` expression itself is evaluated — the same
  shadowing rule a top-level `data-each` already follows. This unlocks kanban
  boards (columns → cards), calendars (cells → events), grouped tables, and
  trees without flattening or master/detail workarounds.

### Changed

- Bundle: **~7.2 → ~7.3 KB gzip** (the recursion adds a few lines; the size
  guard stays at 7.5 KB).

### Migration

- No breaking changes. Single-level `data-each` is unaffected, and any
  flatten / master-detail workaround you used to avoid nesting keeps working —
  you can now nest `<template data-each>` directly instead.

## [2.5.2] — 2026-06-15

Security hardening. No API changes; behaviour changes only for clearly-unsafe
inputs, so upgrading from 2.5.2 is recommended and should be transparent.

### Security

- **CSRF token is now same-origin only.** `this.fetch()` attaches the
  `X-CSRF-Token` (read from `<meta name="csrf-token">`) only when the request
  URL resolves to the page origin. Previously it was attached to every
  request, so a `fetch` to an attacker-influenced cross-origin URL could leak
  the token.
- **`data-bind` refuses XSS sinks.** A binding can no longer install an inline
  event handler — `data-bind="onclick: …"` is dropped (use `@click`) — and a
  `javascript:` URL bound to any attribute (`href`, `src`, …) is stripped.
  Both emit a dev-console warning.
- **Expression fast-path closed.** Simple dot-paths such as `o.constructor` /
  `o.__proto__` took a fast path that skipped the
  `__proto__`/`constructor`/`prototype` block applied on the AST path, leaving
  those names _readable_ (never callable — RCE was already blocked). They now
  route through the interpreter and resolve to `undefined`, matching the
  documented model.

### Changed

- Size budget raised from 7 KB to 7.5 KB gzip to absorb the hardening above.
  Real size is ~7.2 KB.

### Note — the expression sandbox is defense-in-depth, not a boundary

The CSP-safe evaluator stops a directive _expression_ from reaching
`window`/`eval`/`Function`, and CSP blocks injected inline scripts — but
neither protects against **template/markup injection** (client-side template
injection). Never interpolate untrusted input into directive attributes or
expressions; render user data via `data-text` / state only. Treat directive
markup as trusted code.

## [2.5.1] — 2026-06-14

Ergonomics & safety release — three things the audience kept reaching for.

### Added — key & system modifiers on events

- `@event` / `data-on` now accept key and system-key guards in addition to
  `.prevent` / `.stop` / `.self`:

  ```html
  <input @keydown.enter="submit" @keydown.escape="cancel" />
  <button @click.ctrl="openInNewTab">…</button>
  <textarea @keydown.ctrl.enter="send"></textarea>
  ```

  Key guards: `.enter` `.escape` `.tab` `.space` `.up` `.down` `.left`
  `.right` `.delete`. System guards: `.ctrl` `.shift` `.alt` `.meta`. An
  unrecognized modifier matches `event.key` case-insensitively. The handler
  runs only when the guard matches. (Previously you had to branch on
  `e.key` by hand — the docs even told you to.)

### Added — dot-paths for nested state

- **`this.set('user.name', 'Ada')`** — a path setter that reconstructs each
  nested level immutably and reassigns the top-level key, so the shallow
  proxy fires a render. No more hand-spreading nested objects.
- **`data-model="filters.search"`** — `data-model` now reads and writes
  dot-paths (same mechanism). Flat keys behave exactly as before.
- The shallow-proxy model is unchanged; this is ergonomic sugar over it, not
  deep reactivity. Bracket/computed paths (`filters[0]`) are still literal
  keys — use dot notation.
- `set` joins the reserved instance names (`prop`, `fetch`, `emit`, `on`,
  `render`, `destroy`) — a component method named `set` is shadowed by the
  builtin.

### Added — `data-html` sanitizer hook

- **`Micra.config({ sanitize })`** registers a function run on every
  `data-html` value before it's written. Micra does not bundle a sanitizer
  (size); opt into one in a line:

  ```js
  import DOMPurify from "dompurify";
  Micra.config({ sanitize: DOMPurify.sanitize });
  ```

  Without it, `data-html` writes raw HTML as before (still XSS-prone — use
  `data-text` for untrusted input if you don't register a sanitizer).

- New exports: `config`, `MicraConfig`.

### Changed

- Bundle: **~6.6 → ~6.9 KB gzip** (size guard unchanged at 7 KB). Event
  modifiers, the path setter/`data-model`, and the sanitizer hook share the
  budget; the `.prevent`/`.stop`/`.self` logic was de-duplicated into one
  `applyModifiers` helper in the process.

### Migration

- No breaking changes. Existing `@keydown="onKey"` + `e.key` branching keeps
  working; the new modifiers are optional sugar. Existing flat `data-model`
  keys are unaffected. Only watch the new reserved name `set`.

## [2.4.0] — 2026-06-14

### Added — CSP-safe expression evaluator (works under strict CSP)

- **Directive expressions are now parsed and interpreted by a built-in
  evaluator — no `new Function`, no `eval`.** Micra runs under a strict
  Content-Security-Policy (`default-src 'self'`, no `unsafe-eval`): the
  exact policy used by security-sensitive server-rendered apps (banking,
  gov, healthcare). Previously any expression beyond a bare property path
  (`count > 0`, ternaries, comparisons, method calls) compiled via
  `new Function` and was blocked under such a CSP.
- The build now fails if `eval` / `new Function` ever reappears in the
  bundle (`🔒 CSP guard`).
- **Stronger security model, by construction.** Globals like `window`,
  `fetch`, `constructor` are unreachable because no scope contains them —
  not because they're shadowed. Member access additionally blocks
  `__proto__` / `constructor` / `prototype`, closing the
  `item.constructor.constructor("…")()` escape the old `with()`-based
  evaluator left open.

### Added — call expressions in `@event`

- `@event` handlers accept call expressions with arguments, evaluated
  against an event scope (the row `item` inside `data-each`, `$event` /
  `event`, and component methods):

  ```html
  <button @click="select(item.id)">pick</button>
  <input @input="set($event.target.value)" />
  ```

  Bare method names (`@click="save"`) work as before. `data-on` keeps
  bare method names only (its handler separator is `,`).

### Changed

- **Bundle: ~5.5 KB → ~6.6 KB gzip** (size guard raised to 7 KB). The
  eval-based path was _removed_, not kept as a fallback, so this is the
  whole cost of the parser/interpreter. Micra is no longer the very
  smallest in its class (petite-vue ~6 KB) — the trade is CSP-safety,
  a stronger security model, and call-args in events.

### Fixed

- `data-each` row root detection counted whitespace text nodes around a
  single element, wrapping pretty-printed `<tr>` rows in
  `<micra-each-item>` (invalid inside `<tbody>`). Carried over from 2.3.2;
  now also covered by the new evaluator's tests.

### Migration

- No API changes. Existing expressions evaluate identically (full parity
  suite). If you relied on an expression feature outside the documented
  grammar (assignments, `new`, computed `[]` indexing, arrow functions —
  none of which were ever recommended in directives), it no longer works;
  move that logic into a component method.

## [2.3.2] — 2026-06-10

### Fixed — `data-each` row root detection

- **A pretty-printed template with one root element is no longer wrapped
  in `<micra-each-item>`.** Single-root detection used
  `frag.childNodes.length === 1`, which counts whitespace text nodes — so
  `<template data-each>\n  <tr>…</tr>\n</template>` (three child nodes:
  text, element, text) took the multi-root path and wrapped every row.
  For table rows this put invalid content inside `<tbody>` and broke
  `tbody > tr` child selectors.
- Exact semantics of the new check (top-level child nodes only, O(1)-ish
  per row): plain whitespace (space, `\t`, `\n`, `\f`, `\r`) beside the
  single element is ignored; **NBSP and any other visible character keep
  the wrapper** (they render, so they must survive); **comment nodes
  beside the root are dropped** — they don't render and aren't worth
  invalid wrapper content inside `<tbody>`.
- Found by the official `isKeyed` compliance check while preparing the
  [js-framework-benchmark](https://github.com/krausest/js-framework-benchmark)
  submission — Micra now passes it for run / remove / swap.
- Affects both keyed and non-keyed paths (shared `createRowNode`).
- Internal: `ALLOWED_GLOBALS` in the expression evaluator is now built
  from a split string (identical semantics, smaller minified output).
  Bundle: **5.5 KB gzip** (5632 bytes — exactly at the size guard; the
  next feature pays for itself or raises the limit consciously).

### Internal — LLM-benchmark harness hardening (no library impact)

Post-review fixes to `bench-llm/` so published numbers are trustworthy:
windows now close even when an assertion fails (stray timers no longer
misattribute errors to the next generation); errors aggregate across all
pages of multi-scenario tasks; quoted `>` inside template attributes no
longer mangles pages; ESM micra imports are rewritten to UMD bindings
instead of being dropped; the injected bundle is marked with
`data-harness-bundle` (single source of truth for loader and lint);
`Object.groupBy` replaced for Node 20 compatibility; `--only` no longer
overwrites aggregate results; the `@next` publish guard distinguishes
"version not published" from registry/network failures.

## [2.3.1] — 2026-05-30

### Performance

- **Batch scheduler now uses `queueMicrotask` instead of
  `Promise.resolve().then(...)`.** Each render batch enqueues a single
  microtask instead of allocating a Promise plus a reaction job, and the
  flush callback is hoisted out of the hot path so it isn't re-created on
  every `schedule()` call. Behaviour is identical — same microtask timing,
  same write-collapsing. No public-API change.

### Internal — dead-code removal

- Removed the `src/dom/query.ts` module (`queryAll` / `queryOwn` /
  `queryOwnAll` / `filterOwn`). It had no importers since the 2.2.0
  single-pass scan replaced per-render `querySelectorAll` calls with one
  `TreeWalker` traversal — esbuild already tree-shook it out of the
  bundle, so this is a source-only cleanup.
- Removed two dead bookkeeping writes: `node.__micraEach` and
  `node.__micraKey` were assigned during list rendering but never read
  (keys live in the keyed-diff `Map`; the no-key path doesn't tag rows).
  Dropped the matching fields from `MicraElement`.
- Dropped the unused `instance` parameter from `applyDirectives` — it was
  never referenced in the body.

### Docs

- New [Rails + Micra recipe](https://micrajs.dev/docs/recipes/rails): manual importmap integration,
  the `micra-rails` gem with its caveats, a Tasks board demonstrating SSR
  props / CSRF-attached `this.fetch` / cross-component bus, and the Turbo
  Drive / Streams / Frames mount-and-cleanup story.
- README gains a **TypeScript** section spelling out what's checked
  end-to-end (state, methods, event payloads) versus what isn't (the
  expression strings inside `data-*` attributes).
- Landing page gains **Speed** (cross-library benchmark cards) and **AI
  sandboxes** (copy-the-LLM-prompt) sections.

### Bundle

- **5.5 KB gzip** (5582 bytes) — a few bytes lighter than 2.3.0 after the
  dead-code removal.

## [2.3.0] — 2026-05-30

### TypeScript — type-safe event bus

- **New augmentable `MicraEvents` interface.** Declare your app's events
  once and `Micra.emit` / `Micra.on` / `this.emit` / `this.on` enforce
  payload types and arity at the call site:

  ```ts
  declare module "micra.js" {
    interface MicraEvents {
      "cart:updated": { count: number };
      "modal:close": void;
    }
  }

  Micra.emit("cart:updated", { count: 3 }); // ✓
  Micra.emit("cart:updated", { count: "3" }); // ✗ type error
  Micra.emit("modal:close"); // ✓ void → no args
  ```

- Events that are NOT declared in `MicraEvents` keep the previous
  behaviour — payload typed as `unknown`, optional argument. Untyped
  code keeps compiling unchanged.
- New exported types: `MicraEvents`, `EventPayload<K>`, `EmitArgs<K>`.
- Bundle stays at **5.4 KB gzip** — types only, no runtime change.

### Breaking — types only

- The legacy `on<T>(event, handler)` generic now infers `T` as the
  event _key_, not the handler payload. Code that explicitly passed a
  payload type via the generic (`Micra.on<User>('user:updated', h)`)
  still compiles, but `h`'s parameter falls back to `unknown` unless
  the event is declared in `MicraEvents`. Migration: register the
  event via `declare module 'micra.js'` and drop the explicit generic.
  No runtime impact.

### Performance — non-keyed `data-each` now reuses DOM nodes

- **Non-keyed `<template data-each>` no longer re-renders the whole list
  on every update.** The new path keeps the first `min(prev, next)` row
  nodes in place — only the length delta is touched (tail removed when
  the list shrinks, new rows cloned when it grows). Each retained row
  gets a fresh `itemState` and a re-applied directive pass through its
  cached `__micraScan`, so content updates correctly without the
  remove/re-clone overhead.
- Row identity is now stable across renders for the no-key path: event
  listeners bound via `data-on` / `@event` / `data-model` survive
  re-renders without re-binding, and DOM-level state (focus, scroll,
  CSS transitions) is preserved on retained rows.
- Items that didn't change (same reference + same index) skip
  `applyDirectives` entirely when only the `data-each` source array is
  the trigger for this render cycle — same `canSkipUnchanged`
  optimisation the keyed path already had.
- Bundle: **5.5 KB gzip** (raised guard from 5.4 → 5.5 to give the
  shared row-creation helper room; net code is slightly smaller after
  factoring `createRowNode` out of both keyed and non-keyed paths).

### Breaking — non-keyed multi-root rows now wrap in `<micra-each-item>`

- Templates whose `data-each` content has more than one top-level node
  now render each row inside a `<micra-each-item style="display:contents">`
  wrapper, mirroring the keyed path's existing behaviour. The wrapper is
  visually inert (CSS `display:contents` opts out of the box model) but
  it does add one node to the parse tree.
- Impact:
  - **CSS:** child selectors that targeted `parent > .row` will now
    match `parent > micra-each-item` instead. Use descendant selectors
    (`parent .row`) or update the rules.
  - **Invalid HTML contexts:** templates whose rows are `<tr>` / `<td>` /
    `<li>` inside `<tbody>` / `<tr>` / `<ul>` cannot legally have a
    wrapper between the parent and the row. Hoist the wrapper into the
    template (so the row is single-rooted) or use a `data-key`.
- Single-root templates are unchanged — by far the common case.

## [2.2.1] — 2026-05-28

### Performance — batched first list render

- **First render of a keyed `data-each` list now inserts in a single DOM
  operation.** `renderKeyed` previously appended each new row with an
  individual `anchor.after(node)` call — N insertions for an N-row list. On the
  initial render (no previous rows to diff against), all freshly-cloned rows are
  now collected into one `DocumentFragment` and inserted with a single
  `marker.after()`, skipping the LIS reorder pass entirely. The update, swap, and
  reorder paths are unchanged.
- No public-API change. Bundle stays at **5.4 KB gzip**.

## [2.2.0] — 2026-05-27

### Performance — single-pass DOM scan

- **Mount cost cut roughly in half.** Internal `applyDirectives`,
  `bindDataOn`, `bindAtEvents`, `bindModels`, `collectRefs`, and
  `renderList` used to walk the DOM 10+ times per render via separate
  `querySelectorAll` calls. They now consume a single pre-computed
  `ScanIndex` built by one `TreeWalker` traversal. The walker
  `FILTER_REJECT`s subtrees rooted at nested `[data-component]` — those
  subtrees aren't even visited.
- Cross-library benchmark numbers on Firefox 150 / Mac (median of 7 runs):

  | Scenario                  |   Before |       After | Vs Alpine.js | Vs petite-vue |
  | ------------------------- | -------: | ----------: | -----------: | ------------: |
  | Mount 100 components      |  10.8 ms |  **5.6 ms** | × 4.9 faster |  × 3.6 faster |
  | Mount 1000 components     | 128.3 ms | **65.4 ms** | × 7.0 faster |  × 2.4 faster |
  | Update 5 of 1000 rows     |        — |    **1 ms** | × 886 faster | × 1002 faster |
  | 10,000 state writes       |        — |    **1 ms** | × 980 faster |  × 983 faster |
  | First render 1000 keyed   |        — |   **12 ms** |  × 79 faster |   × 82 faster |
  | Swap first ↔ last of 1000 |        — |    **7 ms** | × 131 faster |  × 143 faster |

  Bundle stays at **5.0 KB gzip** — the rewrite removed code, not added it.

### TypeScript — full inference from your component literal

- **Method-level type inference.** Both `S` (state shape) and `M`
  (method set) are now inferred from the object literal passed to
  `Micra.define` / `Micra.mount`. Inside method bodies and lifecycle
  hooks **both** `this.state.X` and `this.someMethod()` are fully typed:

  ```ts
  Micra.define("counter", {
    state: { count: 0 },
    inc() {
      this.state.count++; // ✓ number
      this.dec(); // ✓ inferred sibling method
      // this.foo()        // ❌ Property 'foo' does not exist
    },
    dec() {
      this.state.count--;
    },
  });
  ```

- Public `ComponentInstance<S, M>` and `ComponentDefinition<S, M>` now
  take a second generic parameter for methods. `mount()` returns a fully
  typed instance — `inst.inc()` and `inst.state.count` are both checked
  at the call site.
- New `ComponentMethods` and `ComponentBuiltins` types exported for
  advanced typing.

### Breaking — internal only

- The internal directive scan format changed (`DirectiveCache` →
  `ScanIndex`). Internal-only — no public-API change. If you reached
  into internals via deep imports, switch to consuming
  `el.__micraScan` instead of `el.__micraCache`.

## [2.1.0] — 2026-05-25

### Added

- **`this.fetch(url, { signal })` now forwards `AbortSignal` to the native
  `fetch()`.** Previously the `signal` option was treated as any other
  GET-option and serialized into the URL as `&signal=[object AbortSignal]`,
  while never reaching the underlying request — so abort silently did
  nothing. After this release:
  - `signal` passes through verbatim to native `fetch()`.
  - `signal` is excluded from the GET-querystring serialization loop.
  - `AbortController#abort()` rejects the in-flight request with an
    `AbortError`, matching native semantics.
  - Enables the canonical search-debounce pattern (drop a stale request when
    a fresher query arrives) without dropping to native `fetch` manually.
  - Migration: none — purely additive, the previous URL-serialization
    behaviour was a bug.

### Tests

- 76 new tests for the components and recipes shipped on the docs site
  (14 components + 6 recipes). Total suite: 235 tests across 13 files.

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
