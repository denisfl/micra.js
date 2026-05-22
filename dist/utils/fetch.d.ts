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
import type { FetchOptions } from '../types';
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
export declare class FetchError extends Error {
    readonly status: number;
    readonly response: Response;
    constructor(message: string, status: number, response: Response);
}
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
export declare function micraFetch(url: string, options?: FetchOptions): Promise<unknown>;
