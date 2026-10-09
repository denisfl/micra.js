/**
 * src/dom/each.ts — Keyed and non-keyed list rendering (data-each).
 *
 * Responsibilities:
 *   - Process `<template data-each="items" data-key="id">` elements
 *   - Keyed diff: reuse/reorder DOM nodes by key — O(n) with a Map
 *   - Non-keyed lists: positional reuse — min(old, new) rows are kept, the
 *     tail is removed or rows are appended
 *   - Apply directives to each row with a scoped itemState
 *
 * LLM NOTE: renderList() is called on every render cycle AFTER applyDirectives().
 * The template list comes pre-scanned from scan.ts — no DOM queries here.
 * Each row node gets its own ScanIndex cached on `node.__micraScan` so
 * re-renders of that row don't re-walk the DOM.
 * Rows are created once and reused (by key, or by position without data-key);
 * a reused row gets its itemState refreshed and re-applies directives.
 */

import type {
  CachedBinding,
  InternalInstance,
  MicraElement,
  MicraTemplate,
  StateRecord,
} from '../types'
import { evalExpr, warn } from '../utils/expr'
import { applyDirectives } from './directives'
import { bindDataOn, bindAtEvents, bindModels } from './events'
import { scanComponent } from './scan'

/**
 * Drop tracked listener records belonging to removed row subtrees so a
 * long-lived list doesn't retain every row ever rendered (detached nodes +
 * handler closures) until destroy().
 */
function releaseRowListeners(instance: InternalInstance<StateRecord>, removed: readonly Element[]): void {
  const t = instance.__micraListeners
  if (!t?.length || !removed.length) return
  instance.__micraListeners = t.filter(
    (r) => !removed.some((n) => n === r.el || n.contains(r.el)),
  )
}

/**
 * Process all `<template data-each>` elements found by the scanner.
 * Scoped itemState makes `item`, `index`, `$index` available in row expressions.
 *
 * @param templates  - Pre-scanned list of <template data-each> elements
 * @param state      - Expression state (proxy merging rawState + instance)
 * @param rawState   - Raw (non-proxy) state — used for model binding
 * @param instance   - Component instance (for event binding)
 * @param dirty - State keys changed this cycle, or null for a full render.
 */
export function renderList<S extends StateRecord>(
  templates: Element[],
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
  dirty: Set<string> | null,
): void {
  // scan.ts only collects <template data-each> elements, so no tag check here.
  for (const tmplEl of templates) {
    const tmpl = tmplEl as MicraTemplate

    const itemsExpr = tmpl.getAttribute('data-each')!
    const keyAttr   = tmpl.getAttribute('data-key')
    const value     = evalExpr(itemsExpr, state)
    // Empty / non-array: an empty list — the diff below removes every row.
    const items     = Array.isArray(value) ? value : []

    // Ensure marker comment + internal state are initialized
    if (!tmpl.__micraMarker) {
      const m = document.createComment(`each:${itemsExpr}`)
      tmpl.after(m)
      tmpl.__micraMarker = m
      tmpl.__micraNodes  = new Map()
      tmpl.__micraList   = []
    }

    const marker = tmpl.__micraMarker
    const keyMap = tmpl.__micraNodes
    // The template (and its marker) is currently detached — likely a data-if
    // ancestor unmounted this subtree. Nothing to do until it returns.
    if (!marker.parentNode) continue

    // canSkipUnchanged: true when ONLY this list's own key changed — rows whose
    // item reference and index are both unchanged can skip applyDirectives.
    const canSkipUnchanged =
      dirty !== null && dirty.size === 1 && dirty.has(itemsExpr)

    if (!keyAttr) { renderNoKey(tmpl, items, marker, state, rawState, instance, canSkipUnchanged, dirty); continue }
    const nextKeys  = new Set<unknown>()
    const nextNodes: MicraElement[] = []
    let warnedNullKey = false
    let warnedDupKey  = false

    for (const [index, item] of items.entries()) {
      const key = item[keyAttr]
      if (key == null && !warnedNullKey) {
        warn(`data-key="${keyAttr}" is null/undefined on item at index ${index}`)
        warnedNullKey = true
      }
      if (nextKeys.has(key) && !warnedDupKey) {
        warn(`data-key="${keyAttr}" has duplicate value ${JSON.stringify(key)} — rows will collide`)
        warnedDupKey = true
      }
      nextKeys.add(key)

      let node = keyMap.get(key)
      if (!node) keyMap.set(key, (node = createRowNode(tmpl, state, instance)))
      patchRow(node, item, index, rawState, instance, canSkipUnchanged, dirty)
      nextNodes.push(node)
    }

    // Remove stale nodes (and release their tracked listeners — see M3)
    const removedNodes: Element[] = []
    for (const [key, node] of keyMap) {
      if (!nextKeys.has(key)) { node.remove(); keyMap.delete(key); removedNodes.push(node) }
    }
    releaseRowListeners(instance as InternalInstance<StateRecord>, removedNodes)

    const prevList = tmpl.__micraList
    if (prevList.length === 0) {
      // First render (or refill after a clear): every node is new and already in
      // order — batch into one fragment so the DOM takes a single insertion
      // instead of N anchor.after() calls. Skips LIS entirely.
      const frag = document.createDocumentFragment()
      for (const node of nextNodes) frag.append(node)
      marker.after(frag)
    } else {
      // Skip DOM reorder when list order is unchanged (pure JS array compare, no DOM reads).
      if (
        nextNodes.length !== prevList.length ||
        nextNodes.some((node, i) => node !== prevList[i])
      ) reorderKeyed(nextNodes, prevList, marker)
    }

    tmpl.__micraList = nextNodes
  }
}

// ── Row node creation ─────────────────────────────────────────────────────────

/**
 * Clone the template into a fresh row node, wrapping multi-root content in
 * `<micra-each-item style="display:contents">` so the row always corresponds
 * to a single, stable DOM element. Scans, binds listeners once, and caches
 * an empty itemState prototyped from `state` (filled in by the caller).
 */
function createRowNode<S extends StateRecord>(
  tmpl: MicraTemplate,
  state: StateRecord,
  instance: InternalInstance<S>,
): MicraElement {
  const frag = tmpl.content.cloneNode(true) as DocumentFragment
  let node: MicraElement
  // Single-root detection must ignore whitespace-only text nodes — a
  // pretty-printed `<template>\n  <tr>…</tr>\n</template>` is still one root.
  // Wrapping a lone <tr> in <micra-each-item> would put invalid content
  // inside <tbody> and break `tbody > tr` selectors. Only TOP-LEVEL child
  // nodes are scanned (O(1-ish), not O(subtree)); NBSP counts as meaningful
  // (it renders), so it keeps the wrapper. Comments beside the root are
  // dropped — they don't render and aren't worth a wrapper in <tbody>.
  const first = frag.firstElementChild as MicraElement | null
  // meaningful = any char with code > 32 (NBSP included; \t \n \f \r and
  // space excluded) in a top-level text node
  const single =
    !!first &&
    !first.nextElementSibling &&
    !Array.from(frag.childNodes).some(
      (c) => c.nodeType === 3 && /[^\x00- ]/.test(c.textContent!),
    )
  if (single) {
    node = first!
  } else {
    node = document.createElement('micra-each-item') as MicraElement
    node.style.display = 'contents'
    node.append(frag)
  }
  const rowScan = scanComponent(node)
  node.__micraScan = rowScan
  // The whole-row skip (only this list's key changed; item ref + index
  // unchanged) is sound only if no binding can read that key. A row is opaque
  // (never skipped) when a binding has unknown deps (method calls), depends on
  // the list key itself (e.g. `items.length`), or the row nests a data-each.
  const listKey = tmpl.getAttribute('data-each')!
  node.__micraOpaque =
    rowScan.each.length > 0 ||
    [rowScan.text, rowScan.html, rowScan.if, rowScan.show, rowScan.bind, rowScan.model, rowScan.class].some(
      (g) => (g as CachedBinding[]).some((b) => !b.deps || b.deps.has(listKey)),
    )
  node._itemState = Object.create(state) as StateRecord
  // Unsupported row bindings — warn once per template, not per row.
  if (!tmpl.__micraRowWarned) {
    const m = rowScan.model.find((b) => /^(item|index|\$index)\b/.test(b.expr))
    if (m || rowScan.refs.length) {
      tmpl.__micraRowWarned = true
      warn(
        m
          ? `data-model="${m.expr}" in data-each is not row-scoped — use @input + a method`
          : `data-ref in data-each rows is not collected — query the row element`,
      )
    }
  }
  bindDataOn(rowScan.on, instance)
  bindAtEvents(rowScan.atEvents, instance)
  bindModels(rowScan.model, instance)
  return node
}

// ── Row patch ─────────────────────────────────────────────────────────────────

/**
 * Bring one row node up to date with `item` at `index`. When the item ref and
 * index are unchanged we're here only because some OTHER key changed, so the
 * row is dep-filtered by `dirty` — or skipped outright when ONLY this list's
 * key changed (`canSkip`) and every binding's deps are known (rows with
 * method-call bindings never skip: a method may read anything). If the item
 * or index changed, re-apply fully.
 */
function patchRow<S extends StateRecord>(
  node: MicraElement,
  item: StateRecord,
  index: number,
  rawState: StateRecord,
  instance: InternalInstance<S>,
  canSkip: boolean,
  dirty: Set<string> | null,
): void {
  const rowScan = node.__micraScan!
  const same = node.__micraItem === item && node.__micraIndex === index
  if (same && canSkip && !node.__micraOpaque) return
  const rowDirty = same ? dirty : null
  node.__micraItem  = item
  node.__micraIndex = index
  // Reuse the cached itemState, just update the per-row values.
  const itemState = node._itemState!
  itemState.item = item
  itemState.index = itemState.$index = index
  applyDirectives(rowScan, itemState, rawState, rowDirty)
  // Nested data-each: render templates inside this row against its itemState,
  // so `<template data-each>` works inside another (boards, calendars, trees).
  if (rowScan.each.length) renderList(rowScan.each, itemState, rawState, instance, rowDirty)
}

// ── Keyed list reorder (LIS) ───────────────────────────────────────────────────

/**
 * Move DOM nodes to match `nextNodes` order using the minimum number of moves.
 *
 * Computes the Longest Increasing Subsequence of each node's position in prevList —
 * nodes in the LIS keep their place. Only the others are re-inserted via anchor.after().
 *
 * Complexity: O(n log n) for LIS, O(k) DOM operations where k = nodes that moved.
 * For a 2-node swap this means 2 DOM ops instead of n.
 */
function reorderKeyed(nextNodes: MicraElement[], prevList: MicraElement[], marker: Comment): void {
  const prevPos = new Map<MicraElement, number>()
  for (let i = 0; i < prevList.length; i++) prevPos.set(prevList[i]!, i)

  const n = nextNodes.length
  const tails: number[] = []     // patience sort: smallest tail at each LIS length
  const tailIdx: number[] = []   // index into nextNodes for each tail
  const prev: number[] = []      // LIS parent links (unset = undefined ends the chain)

  for (let i = 0; i < n; i++) {
    const p = prevPos.get(nextNodes[i]!)
    if (p === undefined) continue  // new node — always moved
    let lo = 0, hi = tails.length
    while (lo < hi) { const m = (lo + hi) >> 1; tails[m]! < p ? lo = m + 1 : hi = m }
    prev[i] = tailIdx[lo - 1]!
    tails[lo] = p
    tailIdx[lo] = i
  }

  // Reconstruct stable (non-moving) set from LIS parent chain;
  // `undefined >= 0` is false, so a missing link terminates the walk.
  const stable = new Set<number>()
  let idx: number = tailIdx[tails.length - 1]!
  while (idx >= 0) { stable.add(idx); idx = prev[idx]! }

  // Move unstable nodes into position; stable (LIS) nodes serve as anchors
  let anchor: ChildNode = marker
  nextNodes.forEach((node, i) => {
    if (!stable.has(i)) anchor.after(node)
    anchor = node
  })
}

function renderNoKey<S extends StateRecord>(
  tmpl: MicraTemplate,
  items: StateRecord[],
  marker: Comment,
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
  canSkipUnchanged: boolean,
  dirty: Set<string> | null,
): void {
  const prevList = tmpl.__micraList
  const prevLen = prevList.length
  const nextLen = items.length
  const nextList: MicraElement[] = prevList.slice(0, nextLen)
  nextList.forEach((node, i) => patchRow(node, items[i]!, i, rawState, instance, canSkipUnchanged, dirty))
  const removed = prevList.slice(nextLen)
  removed.forEach((n) => n.remove())
  releaseRowListeners(instance as InternalInstance<StateRecord>, removed)
  const frag = document.createDocumentFragment()
  for (let i = prevLen; i < nextLen; i++) {
    const node = createRowNode(tmpl, state, instance)
    patchRow(node, items[i]!, i, rawState, instance, false, null)
    frag.append((nextList[i] = node))
  }
  ;(nextList[prevLen - 1] ?? marker).after(frag)
  tmpl.__micraList = nextList
}
