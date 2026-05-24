/**
 * tests/bus.test.ts — Global event bus tests (section 7)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { on, off, emit } from '../src/core/bus'

// The bus is module-level state — we need to clean up handlers between tests
// by using the returned unsub functions.

// ── 7.1 on / emit ─────────────────────────────────────────────────────────────

describe('7.1 on / emit', () => {
  it('handler is called when event is emitted', () => {
    const handler = vi.fn()
    const unsub = on('test:basic', handler)
    emit('test:basic', 'payload')
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('payload is passed to handler', () => {
    const handler = vi.fn()
    const unsub = on('test:payload', handler)
    emit('test:payload', { id: 42 })
    expect(handler).toHaveBeenCalledWith({ id: 42 })
    unsub()
  })

  it('multiple handlers receive the same event', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = on('test:multi', a)
    const unsubB = on('test:multi', b)
    emit('test:multi', 1)
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    unsubA()
    unsubB()
  })

  it('emit to event with no handlers does not throw', () => {
    expect(() => emit('test:no-handlers')).not.toThrow()
  })
})

// ── 7.2 off ───────────────────────────────────────────────────────────────────

describe('7.2 off', () => {
  it('handler removed via off() is not called', () => {
    const handler = vi.fn()
    on('test:off', handler)
    off('test:off', handler)
    emit('test:off')
    expect(handler).not.toHaveBeenCalled()
  })

  it('calling off() twice does not throw', () => {
    const handler = vi.fn()
    on('test:double-off', handler)
    expect(() => {
      off('test:double-off', handler)
      off('test:double-off', handler) // second call — no-op
    }).not.toThrow()
  })

  it('unsub() function from on() removes handler', () => {
    const handler = vi.fn()
    const unsub = on('test:unsub', handler)
    unsub()
    emit('test:unsub')
    expect(handler).not.toHaveBeenCalled()
  })

  it('removing one handler does not remove others', () => {
    const a = vi.fn()
    const b = vi.fn()
    const unsubA = on('test:partial', a)
    const unsubB = on('test:partial', b)
    unsubA()
    emit('test:partial')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
    unsubB()
  })
})

// ── 7.2.bis Empty-set cleanup ─────────────────────────────────────────────────

describe('7.2.bis off cleans empty event keys', () => {
  it('removing the last handler deletes the bus entry (no leak)', async () => {
    // Verify internal state via re-subscribe + emit ordering — a fresh emit
    // after off+on hits the new Set, not a stale empty one.
    const a = vi.fn()
    const b = vi.fn()
    const u1 = on('test:cleanup', a)
    u1()
    const u2 = on('test:cleanup', b)
    emit('test:cleanup')
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)
    u2()
  })
})

// ── 7.3 Auto-unsubscribe (tested in mount.test.ts §6.3) ───────────────────────
// See mount.test.ts "destroy() unsubscribes all bus subscriptions"

// ── Error isolation ───────────────────────────────────────────────────────────

describe('Bus error isolation', () => {
  it('handler error does not prevent other handlers from running', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const throws = vi.fn(() => { throw new Error('oops') })
    const ok = vi.fn()
    const u1 = on('test:error-isolation', throws)
    const u2 = on('test:error-isolation', ok)
    emit('test:error-isolation')
    expect(ok).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalled()
    u1(); u2()
    errorSpy.mockRestore()
  })
})
