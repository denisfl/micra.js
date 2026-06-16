/**
 * src/dom/each.ts — Keyed and non-keyed list rendering (data-each).
 *
 * Responsibilities:
 *   - Process `<template data-each="items" data-key="id">` elements
 *   - Keyed diff: reuse/reorder DOM nodes by key — O(n) with a Map
 *   - Non-keyed fallback: length-based positional reuse — min(old, new) rows
 *     are kept as-is, the tail is removed or new rows are appended
 *   - Apply directives to each row with a scoped itemState
 *
 * LLM NOTE: renderList() is called on every render cycle AFTER applyDirectives().
 * The template list comes pre-scanned from scan.ts — no DOM queries here.
 * Each row node gets its own ScanIndex cached on `node.__micraScan` so
 * re-renders of that row don't re-walk the DOM.
 * Keyed mode (data-key present) mutates the DOM in-place — nodes are
 * created once and reused. Non-keyed mode also reuses existing nodes
 * positionally: only the length delta is touched, the rest gets a fresh
 * itemState and re-applies directives.
 */

import type {
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
  for (const tmplEl of templates) {
    if (tmplEl.tagName !== 'TEMPLATE') continue
    const tmpl = tmplEl as MicraTemplate

    const itemsExpr = tmpl.getAttribute('data-each')!
    const keyAttr   = tmpl.getAttribute('data-key') ?? null
    const items     = evalExpr(itemsExpr, state)

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

    // Empty / non-array: clear all rendered rows
    if (!Array.isArray(items)) {
      tmpl.__micraList.forEach(n => n.remove())
      tmpl.__micraList = []
      keyMap.clear()
      continue
    }

    // canSkipUnchanged: true when ONLY this list's own key changed — rows whose
    // item reference and index are both unchanged can skip applyDirectives.
    const canSkipUnchanged =
      dirty !== null && dirty.size === 1 && dirty.has(itemsExpr)

    if (keyAttr) {
      renderKeyed(tmpl, items as StateRecord[], keyAttr, marker, keyMap, state, rawState, instance, canSkipUnchanged, dirty)
    } else {
      renderNoKey(tmpl, items as StateRecord[], marker, state, rawState, instance, canSkipUnchanged, dirty)
    }
  }
}

// ── Row node creation (shared by both paths) ──────────────────────────────────

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
    !Array.prototype.some.call(
      frag.childNodes,
      (c: Node) => c.nodeType === 3 && /[^\x00- ]/.test(c.textContent!),
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
  node._itemState = Object.create(state) as StateRecord
  bindDataOn(rowScan.on, instance)
  bindAtEvents(rowScan.atEvents, instance)
  bindModels(rowScan.model, instance)
  return node
}

// ── Keyed diff ────────────────────────────────────────────────────────────────

function renderKeyed<S extends StateRecord>(
  tmpl: MicraTemplate,
  items: StateRecord[],
  keyAttr: string,
  marker: Comment,
  keyMap: Map<unknown, MicraElement>,
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
  canSkipUnchanged: boolean,
  dirty: Set<string> | null,
): void {
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

    let node = keyMap.get(key) as MicraElement | undefined

    if (!node) {
      node = createRowNode(tmpl, state, instance)
      keyMap.set(key, node)
    } else if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === index) {
      // Item reference and index are unchanged, and no other state key changed
      // this cycle — the DOM already reflects the latest values. Skip re-render.
      nextNodes.push(node)
      continue
    }

    // Item ref + index unchanged → we're here only because some OTHER key
    // changed, so dep-filter by `dirty`. If the item changed, re-apply fully.
    const rowDirty =
      node.__micraItem === item && node.__micraIndex === index ? dirty : null

    node.__micraItem  = item
    node.__micraIndex = index

    // Reuse the cached itemState, just update the per-row values.
    const itemState = node._itemState!
    itemState.item = item
    itemState.index = index
    itemState.$index = index

    // Use the cached scan if present (created above on first sight of this key);
    // older paths may pass a node we haven't scanned yet.
    const rowScan = node.__micraScan ?? (node.__micraScan = scanComponent(node))
    applyDirectives(rowScan, itemState, rawState, rowDirty)
    nextNodes.push(node)
  }

  // Remove stale nodes
  for (const [key, node] of keyMap) {
    if (!nextKeys.has(key)) { node.remove(); keyMap.delete(key) }
  }

  const prevList = tmpl.__micraList
  if (prevList.length === 0) {
    // First render (or refill after a clear): every node is new and already in
    // order — batch into one fragment so the DOM takes a single insertion
    // instead of N anchor.after() calls. Skips LIS entirely.
    if (nextNodes.length) {
      const frag = document.createDocumentFragment()
      for (const node of nextNodes) frag.append(node)
      marker.after(frag)
    }
  } else {
    // Skip DOM reorder when list order is unchanged (pure JS array compare, no DOM reads).
    let orderChanged = nextNodes.length !== prevList.length
    if (!orderChanged) {
      for (let i = 0; i < nextNodes.length; i++) {
        if (nextNodes[i] !== prevList[i]) { orderChanged = true; break }
      }
    }
    if (orderChanged) reorderKeyed(nextNodes, prevList, marker)
  }

  tmpl.__micraList = nextNodes
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
  const prev: number[] = new Array(n).fill(-1)

  for (let i = 0; i < n; i++) {
    const p = prevPos.get(nextNodes[i]!)
    if (p === undefined) continue  // new node — always moved
    let lo = 0, hi = tails.length
    while (lo < hi) { const m = (lo + hi) >> 1; tails[m]! < p ? lo = m + 1 : hi = m }
    if (lo > 0) prev[i] = tailIdx[lo - 1]!
    tails[lo] = p
    tailIdx[lo] = i
  }

  // Reconstruct stable (non-moving) set from LIS parent chain
  const stable = new Set<number>()
  let idx: number = tailIdx[tails.length - 1]!
  while (idx >= 0) { stable.add(idx); idx = prev[idx]! }

  // Move unstable nodes into position; stable (LIS) nodes serve as anchors
  let anchor: ChildNode = marker
  for (let i = 0; i < n; i++) {
    const node = nextNodes[i]!
    if (stable.has(i)) { anchor = node; continue }
    anchor.after(node)
    anchor = node
  }
}

// ── Non-keyed (positional reuse) ──────────────────────────────────────────────

/**
 * Diff a non-keyed list by length: reuse the first min(prev, next) DOM nodes,
 * remove the tail when the list shrinks, clone fresh rows for the growth delta.
 * Multi-root template rows are wrapped in `<micra-each-item style="display:contents">`
 * — same as keyed mode — so the reused list is one DOM node per row.
 */
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
  const reuseLen = nextLen < prevLen ? nextLen : prevLen
  const nextList: MicraElement[] = new Array(nextLen)

  // 1. Reuse [0, reuseLen): refresh itemState, re-apply directives in place.
  for (let i = 0; i < reuseLen; i++) {
    const node = prevList[i]!
    const item = items[i]!
    if (canSkipUnchanged && node.__micraItem === item && node.__micraIndex === i) {
      nextList[i] = node
      continue
    }
    const rowDirty =
      node.__micraItem === item && node.__micraIndex === i ? dirty : null
    node.__micraItem = item
    node.__micraIndex = i
    const itemState = node._itemState!
    itemState.item = item
    itemState.index = i
    itemState.$index = i
    applyDirectives(node.__micraScan!, itemState, rawState, rowDirty)
    nextList[i] = node
  }

  // 2. Shrink: remove tail nodes [nextLen, prevLen).
  for (let i = nextLen; i < prevLen; i++) {
    prevList[i]!.remove()
  }

  // 3. Grow: clone and attach fresh rows for [prevLen, nextLen).
  if (nextLen > prevLen) {
    const frag = document.createDocumentFragment()
    for (let i = prevLen; i < nextLen; i++) {
      const node = createRowNode(tmpl, state, instance)
      const item = items[i]!
      const itemState = node._itemState!
      itemState.item = item
      itemState.index = i
      itemState.$index = i
      node.__micraItem = item
      node.__micraIndex = i
      applyDirectives(node.__micraScan!, itemState, rawState)
      nextList[i] = node
      frag.append(node)
    }
    // Insert after the last reused node, or the marker if the list was empty.
    const anchor: ChildNode = prevLen > 0 ? nextList[prevLen - 1]! : marker
    anchor.after(frag)
  }

  tmpl.__micraList = nextList
}
