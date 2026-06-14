/**
 * src/core/config.ts — global Micra configuration.
 *
 * Currently one option: an optional HTML sanitizer applied to every
 * `data-html` value before it's written to the DOM. Micra does not bundle a
 * sanitizer (size), but lets you opt into one in a single line:
 *
 *   import DOMPurify from 'dompurify'
 *   Micra.config({ sanitize: DOMPurify.sanitize })
 *
 * After that, `data-html` is XSS-safe for untrusted values. Without it,
 * `data-html` writes raw HTML — same as before, and still documented as
 * XSS-prone.
 */

/** Global Micra configuration. */
export interface MicraConfig {
  /**
   * Run on every `data-html` value before it is written. Return the cleaned
   * HTML string. Typically `DOMPurify.sanitize`.
   */
  sanitize?: (html: string) => string
}

/** @internal Live config object — read by directives, written by `config()`. */
export const _config: MicraConfig = {}

/**
 * Set global Micra options. Merges into the existing config (call as many
 * times as you like).
 *
 * @example Micra.config({ sanitize: DOMPurify.sanitize })
 */
export function config(opts: MicraConfig): void {
  Object.assign(_config, opts)
}
