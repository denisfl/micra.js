/**
 * src/core/destroy.ts — explicit teardown + automatic cleanup.
 *
 * start() mounts (and re-mounts swapped-in HTML). The mirror operation is
 * teardown: when an element is removed from the DOM — by htmx, Turbo, Unpoly,
 * Astro view transitions, or a plain innerHTML swap — its component must run
 * onDestroy and leave the registry, or document-level listeners (outside-click,
 * global keydown) and timers from onCreate leak. Per-element @event listeners die
 * with their nodes; document/window ones do not.
 *
 *   destroy(el)    — tear down el's component + any nested ones. Idempotent.
 *   autoCleanup()  — observe the DOM and destroy() automatically whenever a
 *                    mounted root leaves the document. Backend-agnostic; works
 *                    with any swap mechanism. Opt-in, call once.
 */

import { _instances } from './registry'

/**
 * Tear down the Micra component on `root` and every nested component inside it:
 * runs each onDestroy, removes their DOM listeners, and drops them from the live
 * registry. No-op on elements without a component, and safe to call twice.
 *
 * @example Micra.destroy(document.getElementById('panel'))
 */
export function destroy(root: Document | HTMLElement = document): void {
  root.querySelectorAll<HTMLElement>('[data-component]').forEach((el) =>
    _instances.get(el)?.destroy(),
  )
  if (root instanceof HTMLElement) _instances.get(root)?.destroy()
}

let _observer: MutationObserver | null = null

/**
 * Automatically destroy() components whose element is removed from the DOM by
 * ANY means — htmx, Turbo, Unpoly, Astro, or a raw innerHTML swap. The
 * backend-agnostic way to keep server-driven pages leak-free; call it once,
 * typically right after start(). Nodes that are merely moved/reordered (still
 * connected after the mutation) are left alone, so it never fights Micra's own
 * rendering. Idempotent; returns a function that stops observing.
 *
 * @example
 * Micra.start()
 * Micra.autoCleanup() // components now self-destroy when their DOM is swapped out
 */
export function autoCleanup(): () => void {
  if (_observer) return stopAutoCleanup
  _observer = new MutationObserver((records) => {
    for (const rec of records)
      rec.removedNodes.forEach((n) => {
        if (n instanceof HTMLElement && !n.isConnected) destroy(n)
      })
  })
  _observer.observe(document.documentElement, { childList: true, subtree: true })
  return stopAutoCleanup
}

function stopAutoCleanup(): void {
  _observer?.disconnect()
  _observer = null
}
