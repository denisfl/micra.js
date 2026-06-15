/**
 * tests/security.test.ts — regression tests for the security-hardening pass.
 *
 * Covers: data-bind XSS guards (javascript: URLs, on* handlers), the
 * expression-sandbox fast-path BLOCKED_PROPS fix, and same-origin scoping of
 * the CSRF token in this.fetch(). See docs/security.md.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
  document.head.innerHTML = ''
})

const tick = () => new Promise((r) => setTimeout(r, 0))

// ── data-bind XSS guards ────────────────────────────────────────────────────

describe('data-bind: dangerous attributes', () => {
  it('drops javascript: URLs but keeps safe ones', async () => {
    const { root } = mountForTest(
      '<div><a class="a1" data-bind="href: evil"></a><a class="a2" data-bind="href: good"></a></div>',
      { state: { evil: 'javascript:alert(1)', good: '/users/42' } },
    )
    await tick()
    expect(root.querySelector('.a1')!.hasAttribute('href')).toBe(false)
    expect(root.querySelector('.a2')!.getAttribute('href')).toBe('/users/42')
  })

  it('refuses to bind event-handler (on*) attributes', async () => {
    const { root } = mountForTest(
      '<div><button data-bind="onclick: js"></button></div>',
      { state: { js: 'alert(1)' } },
    )
    await tick()
    expect(root.querySelector('button')!.hasAttribute('onclick')).toBe(false)
  })
})

// ── expression sandbox ──────────────────────────────────────────────────────

describe('expression evaluator: prototype-escape props', () => {
  it('blocks constructor / __proto__ even on the simple-path fast path', async () => {
    const { root } = mountForTest(
      '<div><span class="c" data-text="o.constructor"></span>' +
        '<span class="p" data-text="o.__proto__"></span>' +
        '<span class="cc" data-text="o.constructor.constructor"></span></div>',
      { state: { o: { a: 1 } } },
    )
    await tick()
    expect(root.querySelector('.c')!.textContent).toBe('')
    expect(root.querySelector('.p')!.textContent).toBe('')
    expect(root.querySelector('.cc')!.textContent).toBe('')
  })

  it('still resolves normal dot-paths and allowed globals', async () => {
    const { root } = mountForTest(
      '<div><span class="n" data-text="user.name"></span>' +
        '<span class="k" data-text="Object.keys(user).length"></span></div>',
      { state: { user: { name: 'Ada' } } },
    )
    await tick()
    expect(root.querySelector('.n')!.textContent).toBe('Ada')
    expect(root.querySelector('.k')!.textContent).toBe('1')
  })
})

// ── CSRF token scoping ──────────────────────────────────────────────────────

describe('this.fetch: CSRF token is same-origin only', () => {
  it('sends X-CSRF-Token to same-origin URLs but not cross-origin', async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="TOK">'
    const calls: Array<{ url: string; headers: Record<string, string> }> = []
    const orig = globalThis.fetch
    globalThis.fetch = ((url: string, opts: { headers?: Record<string, string> }) => {
      calls.push({ url, headers: opts?.headers ?? {} })
      return Promise.resolve({
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({}),
      })
    }) as unknown as typeof fetch
    try {
      const { inst } = mountForTest('<div></div>', { state: {} })
      await inst.fetch('/api/me')
      await inst.fetch('https://evil.example/steal')
    } finally {
      globalThis.fetch = orig
    }
    const same = calls.find((c) => c.url === '/api/me')!
    const cross = calls.find((c) => String(c.url).includes('evil'))!
    expect(same.headers['X-CSRF-Token']).toBe('TOK')
    expect(cross.headers['X-CSRF-Token']).toBeUndefined()
  })
})
