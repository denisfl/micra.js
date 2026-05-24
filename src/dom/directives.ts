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

import type {
  CachedBinding,
  CachedIfBinding,
  CachedPairBinding,
  DirectiveCache,
  InternalInstance,
  MicraElement,
  MicraTemplate,
  StateRecord,
} from '../types'
import { evalExpr, warn } from '../utils/expr'
import { queryOwn, queryAll } from './query'

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
  el.innerHTML = String(evalExpr(expr, state) ?? '')
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
  (el as HTMLElement).style.display = evalExpr(expr, state) ? '' : 'none'
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
 * Parses comma-separated `className:expression` pairs and toggles classes additively.
 * Unlike data-bind="class:expr" this does NOT replace the full className.
 *
 * Syntax mirrors data-bind — split by comma, then by first colon.
 *
 * @example
 * <div data-class="active:tab === 'home', hidden:!loaded">
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

/** @internal Parse a comma+colon spec like `href:url, disabled:loading` once. */
function parsePairs(expr: string): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = []
  for (const part of expr.split(',')) {
    const colonIdx = part.indexOf(':')
    if (colonIdx === -1) continue
    const left  = part.slice(0, colonIdx).trim()
    const right = part.slice(colonIdx + 1).trim()
    if (!left) continue
    out.push([left, right])
  }
  return out
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

// ── Directive cache ───────────────────────────────────────────────────────────

/** @internal Collect all directive bindings for a root element. Built once. */
function buildCache(root: Element): DirectiveCache {
  const pick = (attr: string): CachedBinding[] => {
    const els = queryOwn(root, attr)
    // Include root itself
    if ((root as HTMLElement).hasAttribute?.(attr)) els.unshift(root)
    return els
      .filter(el => !el.closest('template'))
      .map(el => ({ el, expr: el.getAttribute(attr)! }))
  }
  const pickPairs = (attr: string): CachedPairBinding[] =>
    pick(attr).map(b => ({ ...b, pairs: parsePairs(b.expr) }))
  return {
    text:  pick('data-text'),
    html:  pick('data-html'),
    if:    pick('data-if') as CachedIfBinding[],
    show:  pick('data-show'),
    bind:  pickPairs('data-bind'),
    model: pick('data-model'),
    class: pickPairs('data-class'),
  }
}

// ── Main entry point ──────────────────────────────────────────────────────────

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
export function applyDirectives<S extends StateRecord>(
  root: Element | DocumentFragment,
  state: StateRecord,
  rawState: StateRecord,
  _instance: InternalInstance<S>,
): void {
  // DocumentFragments are temporary clones — always scan, never cache
  if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    applyFromList(buildFragmentList(root as DocumentFragment), state, rawState)
    return
  }

  const el = root as MicraElement
  if (!el.__micraCache) el.__micraCache = buildCache(el)
  applyFromList(el.__micraCache, state, rawState)
}

/** @internal Apply a pre-built cache / binding list to current state. */
function applyFromList(
  cache: DirectiveCache,
  state: StateRecord,
  rawState: StateRecord,
): void {
  // data-if runs first so subsequent directives don't write into a tree that's
  // about to be detached this tick.
  cache.if.forEach(b => applyIf(b, state))
  cache.text.forEach(b => applyText(b.el, b.expr, state))
  cache.html.forEach(b => applyHtml(b.el, b.expr, state))
  cache.show.forEach(b => applyShow(b.el, b.expr, state))
  cache.bind.forEach(b => applyBind(b.el, b.pairs, state))
  cache.model.forEach(b => applyModel(b.el, b.expr.trim(), rawState))
  cache.class.forEach(b => applyClass(b.el, b.pairs, state))
}

/** @internal Scan a DocumentFragment (no-key each clone) — returns a DirectiveCache. */
function buildFragmentList(frag: DocumentFragment): DirectiveCache {
  const pick = (attr: string): CachedBinding[] =>
    queryAll(frag, `[${attr}]`)
      .filter(el => !el.closest('template'))
      .map(el => ({ el, expr: el.getAttribute(attr)! }))
  const pickPairs = (attr: string): CachedPairBinding[] =>
    pick(attr).map(b => ({ ...b, pairs: parsePairs(b.expr) }))
  return {
    text:  pick('data-text'),
    html:  pick('data-html'),
    if:    pick('data-if') as CachedIfBinding[],
    show:  pick('data-show'),
    bind:  pickPairs('data-bind'),
    model: pick('data-model'),
    class: pickPairs('data-class'),
  }
}

// ── Dev warning helper ────────────────────────────────────────────────────────

/**
 * Validate directive usage and emit dev warnings.
 * Called once after the initial render of a component.
 *
 * @internal
 */
export function validateDirectives(root: Element): void {
  queryOwn(root, 'data-each').forEach(el => {
    const tmpl = el as MicraTemplate
    if (!el.hasAttribute('data-key') && !tmpl.__micraNoKeyWarned) {
      tmpl.__micraNoKeyWarned = true
      warn(`data-each="${el.getAttribute('data-each')}" has no data-key — keyed diff disabled. Add data-key="id" for better performance.`)
    }
  })

  // data-bind="class:..." replaces className wholesale, which fights with
  // data-class on the same element. Warn so the developer picks one.
  const bindEls = queryOwn(root, 'data-bind')
  if ((root as HTMLElement).hasAttribute?.('data-bind') && !bindEls.includes(root)) bindEls.unshift(root)
  for (const el of bindEls) {
    const spec = el.getAttribute('data-bind') ?? ''
    const hasClassBind = spec.split(',').some(p => p.trim().split(':')[0]?.trim() === 'class')
    if (hasClassBind && el.hasAttribute('data-class')) {
      warn(`element has both data-bind="class:..." and data-class — they fight on every render. Use one.`)
    }
  }
}

// Re-export warn for use in other modules
export { warn }
