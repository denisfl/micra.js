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

import type {
  CachedIfBinding,
  ScanIndex,
  StateRecord,
} from '../types'
import { evalExpr, warn } from '../utils/expr'

// ── Directive appliers ────────────────────────────────────────────────────────
// Each function is PURE relative to state — reads state, writes DOM.

function applyText(el: Element, expr: string, state: StateRecord): void {
  const text = String(evalExpr(expr, state) ?? '')
  if (el.textContent !== text) el.textContent = text
}

/**
 * data-html — writes the expression value as innerHTML.
 *
 * ⚠️ XSS WARNING: the value is rendered as raw HTML. Never bind untrusted
 * input here — use `data-text` (textContent) instead. See docs/directives.md
 * for the full security model.
 */
function applyHtml(el: Element, expr: string, state: StateRecord): void {
  const html = String(evalExpr(expr, state) ?? '')
  if (el.innerHTML !== html) el.innerHTML = html
}

/**
 * data-if — true mount/unmount. When the expression is falsy, the element is
 * detached from the DOM and a Comment placeholder takes its slot. When truthy,
 * the element is re-inserted where the placeholder is.
 *
 * Side effect: when an element is detached, its `data-ref` is gone from
 * `this.refs` and its `data-model` listener still exists on the (detached)
 * node — listeners survive detach.
 *
 * Use `data-show` when you want the cheap display:none toggle instead.
 */
function applyIf(binding: CachedIfBinding, state: StateRecord): void {
  const el = binding.el as HTMLElement
  const truthy = !!evalExpr(binding.expr, state)
  if (truthy) {
    // If a placeholder is currently in the DOM in the element's slot, swap back.
    const ph = binding.placeholder
    if (ph && ph.parentNode) ph.parentNode.replaceChild(el, ph)
  } else {
    // Only detach if currently attached somewhere. Standalone elements
    // (no parent — common in unit tests) are a no-op.
    const parent = el.parentNode
    if (parent) {
      if (!binding.placeholder) binding.placeholder = document.createComment('if')
      parent.replaceChild(binding.placeholder, el)
    }
  }
}

/**
 * data-show — visibility toggle via `style.display`. Element stays in the DOM.
 */
function applyShow(el: Element, expr: string, state: StateRecord): void {
  const desired = evalExpr(expr, state) ? '' : 'none'
  const htmlEl = el as HTMLElement
  if (htmlEl.style.display !== desired) htmlEl.style.display = desired
}

function applyBind(
  el: Element,
  pairs: ReadonlyArray<readonly [string, string]>,
  state: StateRecord,
): void {
  for (const [attr, valExpr] of pairs) {
    const val = evalExpr(valExpr, state)

    if (attr === 'class') {
      (el as HTMLElement).className = String(val ?? '')
    } else if (attr === 'value') {
      if (document.activeElement !== el)
        (el as HTMLInputElement).value = String(val ?? '')
    } else if (attr === 'style') {
      if (typeof val === 'object' && val !== null) {
        Object.assign((el as HTMLElement).style, val)
      } else {
        el.setAttribute('style', String(val ?? ''))
      }
    } else if (typeof val === 'boolean') {
      val ? el.setAttribute(attr, '') : el.removeAttribute(attr)
    } else {
      val == null ? el.removeAttribute(attr) : el.setAttribute(attr, String(val))
    }
  }
}

/**
 * data-class="active:isActive, disabled:count === 0"
 * Toggles classes additively (does NOT replace full className like data-bind:class).
 * Pairs are pre-parsed at scan time.
 */
function applyClass(
  el: Element,
  pairs: ReadonlyArray<readonly [string, string]>,
  state: StateRecord,
): void {
  for (const [cls, valExpr] of pairs) {
    el.classList.toggle(cls, Boolean(evalExpr(valExpr, state)))
  }
}

function applyModel(
  el: Element,
  key: string,
  rawState: StateRecord,
): void {
  const html = el as HTMLInputElement
  const stateVal = rawState[key]
  const desired = stateVal == null ? '' : String(stateVal)
  // Only write when out of sync. This is a no-op during live typing (the input
  // event already drove state to match el.value) but still propagates
  // programmatic resets such as `this.state.q = ''` on focused inputs.
  if (html.value !== desired) html.value = desired
  // listener is attached separately in events.ts — this only syncs the value
}

// ── Main entry point ──────────────────────────────────────────────────────────

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
export function applyDirectives(
  scan: ScanIndex,
  state: StateRecord,
  rawState: StateRecord,
): void {
  // data-if runs first so subsequent directives don't write into a tree that's
  // about to be detached this tick.
  for (const b of scan.if) applyIf(b, state)
  for (const b of scan.text) applyText(b.el, b.expr, state)
  for (const b of scan.html) applyHtml(b.el, b.expr, state)
  for (const b of scan.show) applyShow(b.el, b.expr, state)
  for (const b of scan.bind) applyBind(b.el, b.pairs, state)
  for (const b of scan.model) applyModel(b.el, b.expr.trim(), rawState)
  for (const b of scan.class) applyClass(b.el, b.pairs, state)
}

// ── Dev warning helper ────────────────────────────────────────────────────────

/**
 * Validate directive usage and emit dev warnings.
 * Called once after the initial render of a component, with the already-built
 * scan so we don't walk the DOM again.
 *
 * @internal
 */
export function validateDirectives(scan: ScanIndex): void {
  for (const el of scan.each) {
    const tmpl = el as HTMLTemplateElement & { __micraNoKeyWarned?: true }
    if (!el.hasAttribute('data-key') && !tmpl.__micraNoKeyWarned) {
      tmpl.__micraNoKeyWarned = true
      warn(
        `data-each="${el.getAttribute('data-each')}" has no data-key — ` +
        `keyed diff disabled. Add data-key="id" for better performance.`,
      )
    }
  }

  // data-bind="class:..." replaces className wholesale, which fights with
  // data-class on the same element. Warn so the developer picks one.
  for (const b of scan.bind) {
    const hasClassBind = b.pairs.some(p => p[0] === 'class')
    if (hasClassBind && b.el.hasAttribute('data-class')) {
      warn(
        `element has both data-bind="class:..." and data-class — they fight ` +
        `on every render. Use one.`,
      )
    }
  }
}

// Re-export warn for use in other modules
export { warn }
