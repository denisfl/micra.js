/**
 * tests/helpers/mount.ts — Test-only mount helpers.
 *
 * Internal to the test suite. Not part of the published API and not
 * exported from `src/`. Use it to deduplicate the common
 * `<div>html</div> → appendChild → mount(root, def)` boilerplate that
 * showed up as a near-identical `mountIn` in four test files.
 *
 * @example
 *   const { root, inst } = mountForTest(
 *     '<div><span data-text="count"></span></div>',
 *     { state: { count: 1 } },
 *   )
 *   expect(root.firstElementChild!.textContent).toBe('1')
 *
 *   // with SSR props
 *   const { inst } = mountForTest('<div></div>', def, { props: { perPage: '25' } })
 */

import { mount } from '../../src/core/mount'
import type {
  ComponentDefinition,
  ComponentInstance,
  StateRecord,
} from '../../src/types'

export interface MountForTestOptions {
  /**
   * Extra `data-*` attributes set on the mounted root before mount.
   * Keys use the camelCased `dataset` form: `{ perPage: '25' }` becomes
   * `data-per-page="25"`, readable inside the component as
   * `this.prop('perPage')`.
   */
  props?: Record<string, string>
}

export interface MountForTestResult<S extends StateRecord, M> {
  root: HTMLElement
  inst: ComponentInstance<S, M>
}

/**
 * Mount a definition against an inline HTML fragment, attaching the root
 * to `document.body`. Returns the root element and the (properly typed)
 * component instance.
 *
 * Throws if the HTML produces no root element or if mount() returns null
 * — both are programmer errors in a test, not runtime conditions.
 */
export function mountForTest<S extends StateRecord, M>(
  html: string,
  definition: ComponentDefinition<S, M>,
  options: MountForTestOptions = {},
): MountForTestResult<S, M> {
  const wrap = document.createElement('div')
  wrap.innerHTML = html.trim()
  const root = wrap.firstElementChild as HTMLElement | null
  if (!root) throw new Error('mountForTest: HTML produced no root element')
  for (const [k, v] of Object.entries(options.props ?? {})) {
    root.dataset[k] = v
  }
  document.body.appendChild(root)
  const inst = mount(root, definition)
  if (!inst) throw new Error('mountForTest: mount() returned null')
  return { root, inst }
}
