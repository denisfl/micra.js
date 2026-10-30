/**
 * src/dom/scan.ts — Single-pass directive/event/ref scanner.
 *
 * Replaces 10+ querySelectorAll calls per render with ONE TreeWalker
 * traversal that classifies every directive attribute in a single visit.
 *
 * Boundaries:
 *   - REJECT (skip subtree) on nested [data-component] — a parent component
 *     never processes directives owned by a nested child. Applied during the
 *     walk so we don't even *visit* those nodes.
 *   - <template> contents are not visited (browser TreeWalker default).
 *     `<template data-each>` itself IS visited and classified into scan.each;
 *     its children are processed by each.ts on every render — fresh rows
 *     are wrapped in a per-row element and scanned via scanComponent.
 *
 * Hot-path notes:
 *   - We read `el.attributes` once and switch by suffix. No allocations per
 *     non-matching attr.
 *   - Pair-parsing (`data-bind`, `data-class`) happens here, once, at scan
 *     time. Reused on every render.
 */
import type { ScanIndex } from "../types";
/**
 * @internal Shared filter: stop descending into nested components. A
 * <micra-*> element is a component even before it connects and sets its own
 * data-component — e.g. inside a data-each row that is still being built.
 */
export declare const NESTED_COMPONENT_FILTER: (node: Node) => number;
/**
 * Scan an Element subtree owned by one component. Skips nested
 * [data-component] subtrees entirely. Visits the root itself.
 *
 * Pass `row` when `root` is the single root of a data-each row: if it is a
 * component, the row owns its attributes and the component owns what's inside.
 */
export declare function scanComponent(root: Element, row?: boolean): ScanIndex;
