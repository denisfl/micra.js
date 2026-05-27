/**
 * src/dom/scan.ts — Single-pass directive/event/ref scanner.
 *
 * Replaces 10+ querySelectorAll calls per render with ONE TreeWalker
 * traversal that classifies every directive attribute in a single visit.
 *
 * Boundaries:
 *   - REJECT (skip subtree) on nested [data-component] — same semantics as
 *     the old `filterOwn` helper, but applied during the walk so we don't
 *     even *visit* those nodes.
 *   - <template> contents are not visited (browser TreeWalker default).
 *     `<template data-each>` itself IS visited and classified into scan.each;
 *     its children are processed by each.ts on every render via scanFragment.
 *
 * Hot-path notes:
 *   - We read `el.attributes` once and switch by suffix. No allocations per
 *     non-matching attr.
 *   - Pair-parsing (`data-bind`, `data-class`) happens here, once, at scan
 *     time. Reused on every render.
 */
import type { ScanIndex } from "../types";
/**
 * Scan an Element subtree owned by one component. Skips nested
 * [data-component] subtrees entirely. Visits the root itself.
 *
 * Cached on `el.__micraScan` after the first call — subsequent renders
 * are free.
 */
export declare function scanComponent(root: Element): ScanIndex;
/**
 * Scan a DocumentFragment (no-key each clone). Not cached — these fragments
 * are temporary and re-cloned every render.
 */
export declare function scanFragment(frag: DocumentFragment): ScanIndex;
