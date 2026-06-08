# Micra.js — Code Review Checklist

Load this when reviewing a PR or change to the Micra source code.

---

## Bundle size

- [ ] Check `dist/micra.js` size after build. Target: < 5 KB gzipped.
- [ ] Any new import? Does it tree-shake? Is there a lighter alternative?
- [ ] New string literals or large lookup tables added to the hot path?
- [ ] New `Function()` calls? They must be cached — never per-render.

Run: `gzip -c dist/micra.min.js | wc -c` to verify gzip size.

---

## Event listener leaks

- [ ] Any `addEventListener` added in a method or `onCreate`? → must have a matching `removeEventListener` in `onDestroy`.
- [ ] Any `document`-level listeners? Most likely need `onDestroy` cleanup.
- [ ] Any `setInterval` / `setTimeout`? → `onDestroy` must clear them.
- [ ] `this.on()` subscriptions are auto-cleaned — no manual unsub needed.
- [ ] Any DOM references stored on instance? Ensure they're released on destroy.

---

## Reactive state rules

- [ ] Any mutation of array/object in place? (`push`, `splice`, direct nested assignment) → flag as bug.
- [ ] State key used with `data-model` is top-level? `data-model="filters.search"` will silently not work.
- [ ] `state` initializer uses only serializable values? No DOM nodes, no functions in state.

---

## Public API compatibility

- [ ] Any change to `ComponentInstance` interface? → breaking change, needs major version.
- [ ] Any change to `ComponentDefinition` type? → check `ThisType` is preserved.
- [ ] Any change to directive attributes (`data-*`, `@event`)? → documented? backward compatible?
- [ ] New function added to `src/index.ts` exports? → added to API reference docs?
- [ ] Removed export? → breaking change.

---

## Internal bookkeeping fields

- [ ] New `__micra*` field on a DOM element? → typed in `MicraElement` or `MicraTemplate` in `types.ts`.
- [ ] New `__micra*` field on instance? → typed in `InternalInstance` in `types.ts`.
- [ ] Does `destroy()` clean up the new field?

---

## Directive cache integrity

- [ ] New directive added? → `DirectiveCache` type updated in `types.ts`?
- [ ] `buildCache()` updated? `buildFragmentList()` updated?
- [ ] `applyFromList()` updated?
- [ ] All three must be in sync — missing one breaks either keyed or non-keyed lists.

---

## Expression evaluator

- [ ] Any new expression compilation? → uses `exprCache` check first?
- [ ] Any `new Function()` outside of `evalExpr`? → explain why.
- [ ] New expression pattern that bypasses the fast path? → consider adding to `SIMPLE_PATH` regex if common.

---

## `queryOwn` scoping

- [ ] Any new `querySelectorAll` call in directive/event code? → should use `queryOwn` to stop at nested `[data-component]`, not raw `querySelectorAll`.

---

## SSR / idempotency

- [ ] Does the change break calling `Micra.start()` multiple times?
- [ ] Does the change break mounting on a pre-rendered element?
- [ ] Any assumption that `document` is available at module load time? (Should be deferred to call time.)

---

## Dev warnings

- [ ] New user-facing mistake possible? → `warn()` from `utils/expr.ts`.
- [ ] Warning includes the directive or element context so the user knows where to look?
- [ ] Warning is only emitted in the initial render, not on every re-render.

---

## Tests

- [ ] New behavior has a test in `tests/`?
- [ ] Edge cases covered: empty state, missing element, duplicate mount, destroy before render completes?
- [ ] `Micra.start()` idempotency tested for the change path?
