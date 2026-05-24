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
export function queryAll(root: ParentNode, sel: string): Element[] {
  return Array.from(root.querySelectorAll(sel))
}

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
export function queryOwn(root: Element, attr: string): Element[] {
  return filterOwn(root, queryAll(root, `[${attr}]`))
}

/**
 * Like queryOwn but accepts an arbitrary CSS selector. Used by bindAtEvents
 * which scans `*` for `@`-prefixed attribute names (no attribute selector exists
 * for those).
 */
export function queryOwnAll(root: Element, sel: string): Element[] {
  return filterOwn(root, queryAll(root, sel))
}

/** @internal Shared subtree-ownership filter. */
function filterOwn(root: Element, els: Element[]): Element[] {
  return els.filter(el => {
    let node: Element | null = el.parentElement
    while (node && node !== root) {
      if (node.hasAttribute('data-component')) return false
      node = node.parentElement
    }
    return true
  })
}
