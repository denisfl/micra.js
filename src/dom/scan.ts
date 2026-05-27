/**
 * src/dom/scan.ts — Single-pass directive/event/ref scanner.
 *
 * Replaces 10+ querySelectorAll calls per render with ONE TreeWalker
 * traversal that classifies every directive attribute in a single visit.
 *
 * Boundaries:
 *   - REJECT (skip subtree) on nested [data-component] — same semantics as
 *     the old `filterOwn` helper, but applied during the walk so we don't
 *     even *visit* those nodes.
 *   - <template> contents are not visited (browser TreeWalker default).
 *     `<template data-each>` itself IS visited and classified into scan.each;
 *     its children are processed by each.ts on every render via scanFragment.
 *
 * Hot-path notes:
 *   - We read `el.attributes` once and switch by suffix. No allocations per
 *     non-matching attr.
 *   - Pair-parsing (`data-bind`, `data-class`) happens here, once, at scan
 *     time. Reused on every render.
 */

import type { CachedIfBinding, CachedPairBinding, ScanIndex } from "../types";

function emptyScan(): ScanIndex {
  return {
    text: [],
    html: [],
    if: [],
    show: [],
    bind: [],
    model: [],
    class: [],
    each: [],
    on: [],
    atEvents: [],
    refs: [],
  };
}

/** @internal Parse `name:expr, name2:expr2` once at scan time. */
function parsePairs(expr: string): Array<readonly [string, string]> {
  const out: Array<readonly [string, string]> = [];
  for (const part of expr.split(",")) {
    const colon = part.indexOf(":");
    if (colon === -1) continue;
    const left = part.slice(0, colon).trim();
    const right = part.slice(colon + 1).trim();
    if (!left) continue;
    out.push([left, right]);
  }
  return out;
}

/** @internal Classify every relevant attribute on one element. */
function classify(el: Element, scan: ScanIndex): void {
  // <template data-each> is the only directive we permit on a <template>.
  // Other directives on a <template> would be meaningless (the content lives
  // in template.content, not template.children).
  if (el.tagName === "TEMPLATE") {
    if (el.hasAttribute("data-each")) scan.each.push(el);
    return;
  }

  const attrs = el.attributes;
  let atEventSeen = false;

  for (let i = 0; i < attrs.length; i++) {
    const a = attrs[i]!;
    const name = a.name;

    // Fast path: most attribute names aren't ours. First-char check rejects
    // the common case (id, class, style, href, …) without a string compare.
    const first = name.charCodeAt(0);

    if (first === 64 /* '@' */) {
      // @event="method" or @event.modifier="method"
      if (!atEventSeen) {
        scan.atEvents.push(el);
        atEventSeen = true;
      }
      continue;
    }

    // data-X attributes
    if (
      first === 100 /* d */ &&
      name.length >= 6 &&
      name.charCodeAt(4) === 45 /* '-' */
    ) {
      // 'data-' prefix
      const rest = name.slice(5);
      switch (rest) {
        case "text":
          scan.text.push({ el, expr: a.value });
          break;
        case "html":
          scan.html.push({ el, expr: a.value });
          break;
        case "if":
          scan.if.push({ el, expr: a.value } as CachedIfBinding);
          break;
        case "show":
          scan.show.push({ el, expr: a.value });
          break;
        case "bind": {
          const pairs = parsePairs(a.value);
          scan.bind.push({ el, expr: a.value, pairs } as CachedPairBinding);
          break;
        }
        case "model":
          scan.model.push({ el, expr: a.value });
          break;
        case "class": {
          const pairs = parsePairs(a.value);
          scan.class.push({ el, expr: a.value, pairs } as CachedPairBinding);
          break;
        }
        case "on":
          scan.on.push(el);
          break;
        case "ref":
          scan.refs.push(el);
          break;
        // data-key, data-each, data-component, data-* user attrs — ignored here
      }
    }
  }
}

/** @internal Shared filter: stop descending into nested components. */
const NESTED_COMPONENT_FILTER: NodeFilter = {
  acceptNode(node: Node): number {
    if ((node as Element).hasAttribute("data-component"))
      return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  },
};

/**
 * Scan an Element subtree owned by one component. Skips nested
 * [data-component] subtrees entirely. Visits the root itself.
 *
 * Cached on `el.__micraScan` after the first call — subsequent renders
 * are free.
 */
export function scanComponent(root: Element): ScanIndex {
  const scan = emptyScan();

  // Always classify root itself first — the TreeWalker's filter would
  // REJECT it if it had `data-component` (which it normally does for a
  // mounted component). The filter is for *descendants*.
  classify(root, scan);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    NESTED_COMPONENT_FILTER,
  );

  let node: Element | null = walker.nextNode() as Element | null;
  while (node) {
    classify(node, scan);
    node = walker.nextNode() as Element | null;
  }

  return scan;
}

/**
 * Scan a DocumentFragment (no-key each clone). Not cached — these fragments
 * are temporary and re-cloned every render.
 */
export function scanFragment(frag: DocumentFragment): ScanIndex {
  const scan = emptyScan();

  const walker = document.createTreeWalker(
    frag,
    NodeFilter.SHOW_ELEMENT,
    NESTED_COMPONENT_FILTER,
  );

  let node: Element | null = walker.nextNode() as Element | null;
  while (node) {
    classify(node, scan);
    node = walker.nextNode() as Element | null;
  }

  return scan;
}
