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
  return queryAll(root, `[${attr}]`).filter(el => {
    let node: Element | null = el.parentElement
    while (node && node !== root) {
      if (node.hasAttribute('data-component')) return false
      node = node.parentElement
    }
    return true
  })
}
