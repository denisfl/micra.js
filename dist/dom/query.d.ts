/**
 * src/dom/query.ts — DOM query helpers.
 *
 * LLM NOTE: These are utility functions with no side effects.
 * queryOwn is the critical function that prevents a parent component from
 * accidentally processing directives belonging to a nested child component.
 */
/**
 * querySelectorAll wrapper — returns a typed array.
 */
export declare function queryAll(root: ParentNode, sel: string): Element[];
/**
 * Like querySelectorAll, but EXCLUDES elements that live inside a nested
 * `[data-component]` subtree.
 *
 * This is what prevents a parent component's render() from clobbering
 * the DOM managed by a child component.
 *
 * LLM NOTE: The walk goes up parentElement until it hits `root` or null.
 * If any ancestor (between el and root) has data-component, the element is
 * owned by that nested component, not by root's component — so we skip it.
 */
export declare function queryOwn(root: Element, attr: string): Element[];
