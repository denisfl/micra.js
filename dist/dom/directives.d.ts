/**
 * src/dom/directives.ts — Apply DOM directives to a component subtree.
 *
 * Responsibilities:
 *   - data-text, data-html, data-if, data-show, data-bind, data-model
 *   - data-class (additive class toggling)
 *   - Directive result cache (built once per element, reused on re-renders)
 *
 * LLM NOTE: applyDirectives() is called on every render. The directive cache
 * (DirectiveCache on el.__micraCache) avoids repeated querySelectorAll on
 * re-renders — cache is built lazily on the first call for each root element.
 *
 * Important: this module does NOT handle data-each — see dom/each.ts.
 */
import type { InternalInstance, StateRecord } from '../types';
import { warn } from '../utils/expr';
/**
 * Apply all non-each directives to a component subtree.
 *
 * For regular Elements: directive bindings are cached in `el.__micraCache`
 * after the first call — subsequent re-renders skip querySelectorAll entirely.
 *
 * For DocumentFragments (no-key each clones): always re-scan because these
 * fragments are new clones on every render.
 *
 * @param root     - Component root Element or DocumentFragment (no-key each clone)
 * @param state    - Expression state (may include item/index for each rows)
 * @param rawState - Raw (non-proxy) state for model sync
 * @param instance - Component instance (unused here, kept for future hooks)
 */
export declare function applyDirectives<S extends StateRecord>(root: Element | DocumentFragment, state: StateRecord, rawState: StateRecord, _instance: InternalInstance<S>): void;
/**
 * Validate directive usage and emit dev warnings.
 * Called once after the initial render of a component.
 *
 * @internal
 */
export declare function validateDirectives(root: Element): void;
export { warn };
