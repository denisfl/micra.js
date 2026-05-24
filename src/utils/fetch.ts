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

/** Read CSRF token from <meta name="csrf-token"> (Rails, Laravel, Django…). */
function getCSRF(): string | null {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null
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

  const csrf = getCSRF()
  if (csrf) headers['X-CSRF-Token'] = csrf

  let finalUrl = url
  let body: string | undefined

  if (method === 'GET' || method === 'HEAD') {
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(options)) {
      if (k !== 'method' && k !== 'headers' && v != null) params[k] = String(v)
    }
    if (Object.keys(params).length)
      finalUrl += (url.includes('?') ? '&' : '?') + new URLSearchParams(params)
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  const res = await fetch(finalUrl, {
    method,
    headers,
    ...(body !== undefined ? { body } : {}),
  })

  if (!res.ok)
    throw new FetchError(`[Micra] fetch: ${method} ${url} → ${res.status}`, res.status, res)

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : res.text()
}
