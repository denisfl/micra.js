/**
 * src/core/element.ts — <micra-NAME> custom elements.
 *
 * define('dropdown', def) also registers <micra-dropdown>. The element mounts
 * itself when it connects and tears itself down when it leaves the document,
 * so markup inserted by any means — htmx, Turbo, innerHTML, a CMS block —
 * works without start() or autoCleanup().
 *
 * The element sets data-component on itself, so everything keyed on that
 * attribute (nested-component boundaries in scan, start(), destroy(), debug())
 * treats it exactly like <div data-component="dropdown">.
 */

import type { MicraElement } from '../types'
import { _instances, _registry } from './registry'
import { mount } from './mount'

export function registerElement(name: string): void {
  const tag = 'micra-' + name
  const ce = globalThis.customElements
  // Custom element names must be lowercase; skip names that can't be tags.
  // <micra-each-item> is the wrapper data-each puts around multi-root rows.
  if (!ce || ce.get(tag) || !/^(?!each-item$)[a-z][a-z0-9-]*$/.test(name)) return
  ce.define(
    tag,
    class extends HTMLElement {
      connectedCallback() {
        this.setAttribute('data-component', name)
        // Children may not exist yet: the parser is still running, or the
        // element was connected empty and is filled right after. Mount once
        // the document is parsed, and never before the current task's DOM work.
        const go = () => this.isConnected && mount(this, _registry.get(name)!)
        document.readyState === 'loading'
          ? document.addEventListener('DOMContentLoaded', go, { once: true })
          : queueMicrotask(go)
      }
      disconnectedCallback() {
        // A move (keyed list reorder) reconnects in the same task, and a
        // data-if detach keeps the instance for re-insertion: neither is a
        // removal. Check once the current task's DOM work is done.
        queueMicrotask(() => {
          if (this.isConnected) return
          for (let n: Node | null = this; n; n = n.parentNode)
            if ((n as MicraElement).__micraIfDetached) return
          _instances.get(this)?.destroy()
        })
      }
    },
  )
}
