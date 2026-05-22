/**
 * tests/fetch.test.ts — Fetch helper tests (section 8)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { micraFetch } from '../src/utils/fetch'
import { FetchError } from '../src/utils/fetch'

// Mock global fetch
function mockFetch(status: number, body: unknown, contentType = 'application/json') {
  const json = typeof body === 'string' ? body : JSON.stringify(body)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (h: string) => h.toLowerCase() === 'content-type' ? contentType : null,
    },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(json),
  }))
}

afterEach(() => vi.unstubAllGlobals())

// ── 8.1 GET ───────────────────────────────────────────────────────────────────

describe('8.1 GET', () => {
  it('serializes extra options as query params', async () => {
    mockFetch(200, { ok: true })
    await micraFetch('/api/users', { page: 2, status: 'active' })
    const url = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('status=active')
  })

  it('adds Accept: application/json header', async () => {
    mockFetch(200, { ok: true })
    await micraFetch('/api/data')
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['Accept']).toBe('application/json')
  })

  it('returns parsed JSON when content-type is application/json', async () => {
    mockFetch(200, { users: ['Alice'] })
    const result = await micraFetch('/api/users')
    expect(result).toEqual({ users: ['Alice'] })
  })

  it('adds CSRF token if meta tag exists', async () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'csrf-token')
    meta.setAttribute('content', 'test-token-123')
    document.head.appendChild(meta)

    mockFetch(200, {})
    await micraFetch('/api/test')
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('test-token-123')

    document.head.removeChild(meta)
  })
})

// ── 8.2 POST ──────────────────────────────────────────────────────────────────

describe('8.2 POST', () => {
  it('serializes body as JSON', async () => {
    mockFetch(200, { id: 1 })
    await micraFetch('/api/invite', { method: 'POST', body: { email: 'a@b.com' } })
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect(init.body).toBe(JSON.stringify({ email: 'a@b.com' }))
  })

  it('sets Content-Type: application/json', async () => {
    mockFetch(201, { id: 2 })
    await micraFetch('/api/create', { method: 'POST', body: {} })
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('uses the specified HTTP method', async () => {
    mockFetch(200, {})
    await micraFetch('/api/resource', { method: 'DELETE' })
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit
    expect(init.method).toBe('DELETE')
  })
})

// ── 8.3 Error handling ────────────────────────────────────────────────────────

describe('8.3 Fetch errors', () => {
  it('4xx response throws FetchError', async () => {
    mockFetch(404, { error: 'Not Found' })
    await expect(micraFetch('/api/missing')).rejects.toThrow(FetchError)
  })

  it('5xx response throws FetchError', async () => {
    mockFetch(500, { error: 'Server Error' })
    await expect(micraFetch('/api/crash')).rejects.toThrow(FetchError)
  })

  it('FetchError has correct status', async () => {
    mockFetch(403, { error: 'Forbidden' })
    try {
      await micraFetch('/api/secret')
    } catch (e) {
      expect(e).toBeInstanceOf(FetchError)
      expect((e as FetchError).status).toBe(403)
    }
  })

  it('FetchError has response object', async () => {
    mockFetch(422, { errors: [] })
    try {
      await micraFetch('/api/validate')
    } catch (e) {
      expect(e).toBeInstanceOf(FetchError)
      expect((e as FetchError).response).toBeDefined()
    }
  })

  it('FetchError name is "FetchError"', async () => {
    mockFetch(401, {})
    try {
      await micraFetch('/api/auth')
    } catch (e) {
      expect((e as FetchError).name).toBe('FetchError')
    }
  })
})
