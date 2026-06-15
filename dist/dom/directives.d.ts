/**
 * src/dom/directives.ts — Apply DOM directives to a component subtree.
 *
 * Responsibilities:
 *   - data-text, data-html, data-if, data-show, data-bind, data-model
 *   - data-class (additive class toggling)
 *
 * LLM NOTE: applyDirectives() is called on every render. It consumes a
 * pre-computed ScanIndex (built once by scan.ts and cached on the element).
 * The scan replaced 10+ querySelectorAll calls with a single TreeWalker pass.
 *
 * Important: this module does NOT handle data-each — see dom/each.ts.
 */
import type { ScanIndex, StateRecord } from "../types";
import { warn } from "../utils/expr";
/**
 * Apply all non-each directives to a component subtree.
 *
 * Consumes a pre-computed ScanIndex. data-if runs first so subsequent
 * directives don't write into a tree that's about to be detached this tick.
 *
 * @param scan     - Pre-computed scan from scan.ts (cached per element)
 * @param state    - Expression state (may include item/index for each rows)
 * @param rawState - Raw (non-proxy) state for model sync
 */
export declare function applyDirectives(scan: ScanIndex, state: StateRecord, rawState: StateRecord): void;
/**
 * Validate directive usage and emit dev warnings.
 * Called once after the initial render of a component, with the already-built
 * scan so we don't walk the DOM again.
 *
 * @internal
 */
export declare function validateDirectives(scan: ScanIndex): void;
export { warn };
