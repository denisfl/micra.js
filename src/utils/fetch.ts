/**
 * src/utils/fetch.ts — HTTP fetch helper.
 *
 * Responsibilities:
 *   - Auto-attach CSRF token from <meta name="csrf-token">
 *   - Serialize POST/PUT/PATCH body as JSON
 *   - Serialize GET/HEAD options as query params
 *   - Throw a typed FetchError on non-2xx responses
 *   - Return parsed JSON or text
 *
 * LLM NOTE: This module is PURE (no DOM side effects beyond reading a meta tag).
 * It wraps the native fetch() API with SaaS-friendly defaults.
 */

import type { FetchOptions } from '../types'

// ── CSRF ──────────────────────────────────────────────────────────────────────


/**
 * True for relative / same-origin URLs. The CSRF token is attached only when
 * this holds, so a request to a third-party URL can't exfiltrate it.
 */
function sameOrigin(url: string): boolean {
  try { return new URL(url, location.href).origin === location.origin } catch { return true }
}

// ── Typed error ───────────────────────────────────────────────────────────────

/**
 * Thrown by `this.fetch()` when the server returns a non-2xx status.
 *
 * @example
 * try {
 *   await this.fetch('/api/data')
 * } catch (e) {
 *   if (e instanceof FetchError && e.status === 404) { ... }
 * }
 */
export class FetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response: Response,
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

/**
 * Fetch wrapper with SaaS defaults.
 *
 * - GET/HEAD: extra `options` keys become URL query params
 * - POST/PUT/PATCH/DELETE: `options.body` is JSON-serialized
 * - Attaches X-CSRF-Token header automatically
 * - Returns parsed JSON if Content-Type is application/json, else text
 *
 * @example
 * // GET with params → /api/users?page=2&status=active
 * const data = await this.fetch('/api/users', { page: 2, status: 'active' })
 *
 * // POST with JSON body
 * await this.fetch('/api/invite', { method: 'POST', body: { email, role } })
 */
export async function micraFetch(url: string, options: FetchOptions = {}): Promise<unknown> {
  const method  = ((options.method as string | undefined) ?? 'GET').toUpperCase()
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }

  // CSRF token from <meta name="csrf-token"> (Rails, Laravel, Django…)
  const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
  if (csrf && sameOrigin(url)) headers['X-CSRF-Token'] = csrf

  let finalUrl = url
  let body: string | undefined

  if (method === 'GET' || method === 'HEAD') {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(options)) {
      if (k !== 'method' && k !== 'headers' && k !== 'signal' && v != null)
        params.set(k, String(v))
    }
    const qs = String(params)
    if (qs) finalUrl += (url.includes('?') ? '&' : '?') + qs
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  // undefined signal/body are ignored by fetch() (WebIDL optional members);
  // the cast only satisfies exactOptionalPropertyTypes.
  const res = await fetch(finalUrl, {
    method,
    headers,
    signal: options.signal,
    body,
  } as RequestInit)

  if (!res.ok)
    throw new FetchError(`[Micra] fetch: ${method} ${url} → ${res.status}`, res.status, res)

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : res.text()
}
