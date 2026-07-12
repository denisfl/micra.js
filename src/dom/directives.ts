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

import type { CachedIfBinding, MicraElement, ScanIndex, StateRecord } from "../types";
import { evalExpr, warn } from "../utils/expr";
import { _config } from "../core/config";

// ── Directive appliers ────────────────────────────────────────────────────────
// Each function is PURE relative to state — reads state, writes DOM.

function applyText(el: Element, expr: string, state: StateRecord): void {
  const text = String(evalExpr(expr, state) ?? "");
  if (el.textContent !== text) el.textContent = text;
}

/**
 * data-html — writes the expression value as innerHTML.
 *
 * ⚠️ XSS WARNING: the value is rendered as raw HTML. For untrusted input,
 * either use `data-text` (textContent) instead, or register a sanitizer once
 * with `Micra.config({ sanitize: DOMPurify.sanitize })` — it runs on every
 * value here. See docs/directives.md for the full security model.
 */
function applyHtml(el: Element, expr: string, state: StateRecord): void {
  const raw = String(evalExpr(expr, state) ?? "");
  const html = _config.sanitize ? _config.sanitize(raw) : raw;
  // Compare against the last WRITTEN string, not el.innerHTML — the browser
  // normalizes markup on read, so reading back can be permanently unequal and
  // would reset the subtree (and any user selection) on every render.
  const m = el as MicraElement;
  if (m.__micraHtml === html) return;
  m.__micraHtml = html;
  el.innerHTML = html;
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
  const el = binding.el as HTMLElement;
  const truthy = !!evalExpr(binding.expr, state);
  if (truthy) {
    // If a placeholder is currently in the DOM in the element's slot, swap back.
    const ph = binding.placeholder;
    if (ph && ph.parentNode) ph.parentNode.replaceChild(el, ph);
    delete (el as MicraElement).__micraIfDetached;
  } else {
    // Only detach if currently attached somewhere. Standalone elements
    // (no parent — common in unit tests) are a no-op.
    const parent = el.parentNode;
    if (parent) {
      if (!binding.placeholder)
        binding.placeholder = document.createComment("if");
      // Mark the detach as Micra's own so autoCleanup() doesn't destroy
      // components inside a temporarily-hidden subtree.
      (el as MicraElement).__micraIfDetached = true;
      parent.replaceChild(binding.placeholder, el);
    }
  }
}

/**
 * data-show — visibility toggle via `style.display`. Element stays in the DOM.
 */
function applyShow(el: Element, expr: string, state: StateRecord): void {
  const desired = evalExpr(expr, state) ? "" : "none";
  const htmlEl = el as HTMLElement;
  if (htmlEl.style.display !== desired) htmlEl.style.display = desired;
}

function applyBind(
  el: Element,
  pairs: ReadonlyArray<readonly [string, string]>,
  state: StateRecord,
): void {
  for (const [attr, valExpr] of pairs) {
    const val = evalExpr(valExpr, state);

    // Security: a binding must never install an inline event handler — that's
    // a direct XSS sink. Use @event for handlers.
    if (/^on[a-z]+$/.test(attr)) {
      warn(`data-bind refused event-handler attribute "${attr}" — use @${attr.slice(2)}`);
      continue;
    }

    if (attr === "class") {
      (el as HTMLElement).className = String(val ?? "");
    } else if (attr === "checked") {
      // Property, not attribute: the checked ATTRIBUTE is only the default and
      // stops reflecting once the user has interacted with the control.
      (el as HTMLInputElement).checked = Boolean(val) && val !== "false";
    } else if (attr === "value") {
      if (document.activeElement !== el)
        (el as HTMLInputElement).value = String(val ?? "");
    } else if (attr === "style") {
      if (typeof val === "object" && val !== null) {
        Object.assign((el as HTMLElement).style, val);
      } else {
        el.setAttribute("style", String(val ?? ""));
      }
    } else if (typeof val === "boolean") {
      val ? el.setAttribute(attr, "") : el.removeAttribute(attr);
    } else if (val == null) {
      el.removeAttribute(attr);
    } else if (/^javascript:/i.test(String(val).replace(/[\u0000-\u0020]/g, ""))) {
      // Security: drop javascript: URLs (XSS via href/src/…)
      warn(`data-bind dropped unsafe javascript: URL from "${attr}"`);
      el.removeAttribute(attr);
    } else {
      el.setAttribute(attr, String(val));
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
    el.classList.toggle(cls, Boolean(evalExpr(valExpr, state)));
  }
}

function applyModel(el: Element, key: string, rawState: StateRecord): void {
  const html = el as HTMLInputElement;
  // evalExpr resolves both flat keys ("search") and dot-paths ("filters.query")
  const stateVal = evalExpr(key, rawState);
  // Checkboxes and radios sync the `checked` PROPERTY, never `value`: writing
  // value would corrupt a radio group's option values and can't uncheck a
  // checkbox (the checked attribute is only a default).
  if (html.type === "checkbox" || html.type === "radio") {
    const want =
      html.type === "checkbox"
        ? Boolean(stateVal)
        : html.value === (stateVal == null ? "" : String(stateVal));
    if (html.checked !== want) html.checked = want;
    return;
  }
  const desired = stateVal == null ? "" : String(stateVal);
  // Only write when out of sync. This is a no-op during live typing (the input
  // event already drove state to match el.value) but still propagates
  // programmatic resets such as `this.state.q = ''` on focused inputs.
  if (html.value !== desired) html.value = desired;
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
 * @param dirty    - State keys changed this cycle, or null for a full apply.
 *                   A binding whose deps don't intersect `dirty` is skipped —
 *                   its value provably didn't change, so the DOM is current.
 */
export function applyDirectives(
  scan: ScanIndex,
  state: StateRecord,
  rawState: StateRecord,
  dirty: Set<string> | null = null,
): void {
  // data-if runs first so subsequent directives don't write into a tree that's
  // about to be detached this tick.
  for (const b of scan.if) if (fresh(b.deps, dirty)) applyIf(b, state);
  for (const b of scan.text) if (fresh(b.deps, dirty)) applyText(b.el, b.expr, state);
  for (const b of scan.html) if (fresh(b.deps, dirty)) applyHtml(b.el, b.expr, state);
  for (const b of scan.show) if (fresh(b.deps, dirty)) applyShow(b.el, b.expr, state);
  for (const b of scan.bind) if (fresh(b.deps, dirty)) applyBind(b.el, b.pairs, state);
  for (const b of scan.model) if (fresh(b.deps, dirty)) applyModel(b.el, b.expr.trim(), rawState);
  for (const b of scan.class) if (fresh(b.deps, dirty)) applyClass(b.el, b.pairs, state);
}

/**
 * A binding must re-run when: a full render is requested (`dirty === null`),
 * its deps are unknown (`null` — contains a call), or any changed key is in
 * its dep set. Otherwise its value is unchanged and we skip it.
 */
function fresh(deps: Set<string> | null | undefined, dirty: Set<string> | null): boolean {
  if (dirty === null || deps == null) return true;
  for (const k of dirty) if (deps.has(k)) return true;
  return false;
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
    const tmpl = el as HTMLTemplateElement & { __micraNoKeyWarned?: true };
    if (!el.hasAttribute("data-key") && !tmpl.__micraNoKeyWarned) {
      tmpl.__micraNoKeyWarned = true;
      warn(
        `data-each="${el.getAttribute("data-each")}" has no data-key — ` +
          `keyed diff disabled. Add data-key="id" for better performance.`,
      );
    }
    // data-if on the template itself is inert — rows are managed by the each renderer.
    if (el.hasAttribute("data-if")) {
      warn(`data-if on a data-each template is ignored — put it on a wrapper element`);
    }
  }

  // data-bind="class:..." replaces className wholesale, which fights with
  // data-class on the same element. Warn so the developer picks one.
  for (const b of scan.bind) {
    const hasClassBind = b.pairs.some((p) => p[0] === "class");
    if (hasClassBind && b.el.hasAttribute("data-class")) {
      warn(
        `element has both data-bind="class:..." and data-class — they fight ` +
          `on every render. Use one.`,
      );
    }
  }
}

// Re-export warn for use in other modules
export { warn };
