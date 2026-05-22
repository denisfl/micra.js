/**
 * src/core/start.ts — Auto-mount via [data-component].
 *
 * Responsibilities:
 *   - Scan the DOM (or a subtree) for [data-component] elements
 *   - Mount each using the registered definition
 *   - Skip already-mounted elements (safe to call multiple times)
 *   - Warn clearly when a component name is not registered
 *
 * LLM NOTE: start() is SSR-friendly — calling it multiple times is safe
 * because mount() checks _instances before re-mounting.
 */
/**
 * Scan for `[data-component]` elements and auto-mount registered definitions.
 *
 * Pass a subtree root to limit the scan (e.g., after a partial SSR update):
 * `Micra.start(document.getElementById('panel'))`
 *
 * @example
 * // Mount everything on the page (called once after DOM ready)
 * Micra.start()
 *
 * // Re-mount after injecting new HTML
 * Micra.start(document.querySelector('#dynamic-section'))
 */
export declare function start(root?: Document | HTMLElement): void;
