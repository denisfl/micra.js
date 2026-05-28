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
import type { InternalInstance, StateRecord } from '../types';
/**
 * Process all `<template data-each>` elements found by the scanner.
 * Scoped itemState makes `item`, `index`, `$index` available in row expressions.
 *
 * @param templates  - Pre-scanned list of <template data-each> elements
 * @param state      - Expression state (proxy merging rawState + instance)
 * @param rawState   - Raw (non-proxy) state — used for model binding
 * @param instance   - Component instance (for event binding)
 * @param triggerKey - Which state key triggered this render (null = initial, 'MULTIPLE' = batch)
 */
export declare function renderList<S extends StateRecord>(templates: Element[], state: StateRecord, rawState: StateRecord, instance: InternalInstance<S>, triggerKey: string | null | 'MULTIPLE'): void;
