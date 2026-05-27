/**
 * src/dom/each.ts — Keyed and non-keyed list rendering (data-each).
 *
 * Responsibilities:
 *   - Process `<template data-each="items" data-key="id">` elements
 *   - Keyed diff: reuse/reorder DOM nodes by key — O(n) with a Map
 *   - Non-keyed fallback: full replace (no key → warn in dev, full re-render)
 *   - Apply directives to each row with a scoped itemState
 *
 * LLM NOTE: renderList() is called on every render cycle AFTER applyDirectives().
 * The template list comes pre-scanned from scan.ts — no DOM queries here.
 * Each row node gets its own ScanIndex cached on `node.__micraScan` so
 * re-renders of that row don't re-walk the DOM.
 * Keyed mode (data-key present) mutates the DOM in-place — nodes are
 * created once and reused. Non-keyed mode removes all nodes and re-clones.
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
import { scanComponent, scanFragment } from './scan'

/**
 * Process all `<template data-each>` elements found by the scanner.
 * Scoped itemState makes `item`, `index`, `$index` available in row expressions.
 *
 * @param templates - Pre-scanned list of <template data-each> elements
 * @param state     - Expression state (proxy merging rawState + instance)
 * @param rawState  - Raw (non-proxy) state — used for model binding
 * @param instance  - Component instance (for event binding)
 */
export function renderList<S extends StateRecord>(
  templates: Element[],
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
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
    const parent = marker.parentNode
    // The template (and its marker) is currently detached — likely a data-if
    // ancestor unmounted this subtree. Nothing to do until it returns.
    if (!parent) continue

    // Empty / non-array: clear all rendered rows
    if (!Array.isArray(items)) {
      tmpl.__micraList.forEach(n => n.remove())
      tmpl.__micraList = []
      keyMap.clear()
      continue
    }

    if (keyAttr) {
      renderKeyed(tmpl, items as StateRecord[], keyAttr, marker, keyMap, parent, state, rawState, instance)
    } else {
      renderNoKey(tmpl, items as StateRecord[], marker, parent, state, rawState, instance)
    }
  }
}

// ── Keyed diff ────────────────────────────────────────────────────────────────

function renderKeyed<S extends StateRecord>(
  tmpl: MicraTemplate,
  items: StateRecord[],
  keyAttr: string,
  marker: Comment,
  keyMap: Map<unknown, MicraElement>,
  parent: Node,
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
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
      // Clone template and wrap multi-root fragments in a display:contents element
      const frag = tmpl.content.cloneNode(true) as DocumentFragment
      if (frag.childNodes.length === 1) {
        node = frag.firstElementChild as MicraElement
      } else {
        node = document.createElement('micra-each-item') as MicraElement
        node.style.display = 'contents'
        node.append(frag)
      }
      node.__micraKey = key
      keyMap.set(key, node)
      // Bind data-on / @event / data-model listeners once per row node.
      // Scan the row, cache the scan on the node for future re-renders.
      const rowScan = scanComponent(node)
      node.__micraScan = rowScan
      bindDataOn(rowScan.on, instance)
      bindAtEvents(rowScan.atEvents, instance)
      bindModels(rowScan.model, instance)
    }

    const itemState = Object.assign(
      Object.create(state) as StateRecord,
      { item, index, $index: index },
    )
    // Use the cached scan if present (created above on first sight of this key);
    // older paths may pass a node we haven't scanned yet.
    const rowScan = node.__micraScan ?? (node.__micraScan = scanComponent(node))
    applyDirectives(rowScan, itemState, rawState, instance)
    nextNodes.push(node)
  }

  // Remove stale nodes
  for (const [key, node] of keyMap) {
    if (!nextKeys.has(key)) { node.remove(); keyMap.delete(key) }
  }

  // Insert / reorder nodes after marker (insertBefore is no-op if already in place)
  let cursor: Node = marker
  for (const node of nextNodes) {
    if (cursor.nextSibling !== node) parent.insertBefore(node, cursor.nextSibling)
    cursor = node
  }

  tmpl.__micraList = nextNodes
}

// ── Non-keyed (full re-render) ─────────────────────────────────────────────────

function renderNoKey<S extends StateRecord>(
  tmpl: MicraTemplate,
  items: StateRecord[],
  marker: Comment,
  parent: Node,
  state: StateRecord,
  rawState: StateRecord,
  instance: InternalInstance<S>,
): void {
  tmpl.__micraList.forEach(n => n.remove())
  tmpl.__micraList = []

  const frag = document.createDocumentFragment()
  for (const [index, item] of items.entries()) {
    const clone = tmpl.content.cloneNode(true) as DocumentFragment
    const itemState = Object.assign(
      Object.create(state) as StateRecord,
      { item, index, $index: index },
    )
    // Fresh clone each render → fresh scan each render (uncached).
    const fragScan = scanFragment(clone)
    applyDirectives(fragScan, itemState, rawState, instance)
    bindDataOn(fragScan.on, instance)
    bindAtEvents(fragScan.atEvents, instance)
    bindModels(fragScan.model, instance)

    const nodes = Array.from(clone.childNodes) as MicraElement[]
    nodes.forEach(n => { n.__micraEach = true; frag.append(n) })
    tmpl.__micraList.push(...nodes)
  }
  parent.insertBefore(frag, marker.nextSibling)
}
