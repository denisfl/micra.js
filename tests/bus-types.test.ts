/**
 * tests/bus-types.test.ts — Type-safe event bus (section 7.4)
 *
 * These tests exercise both runtime behavior AND TypeScript types.
 * Negative type-cases are expressed via `// @ts-expect-error` — they
 * fail the typecheck if the line stops being an error. Type-only
 * positive cases are placed in unreachable branches so they
 * compile-check but never run.
 *
 * Run typecheck via:   npm run typecheck
 * Run runtime via:     npm test
 */
import { describe, it, expect, vi } from 'vitest'
import * as Micra from '../src/index'
import type { MicraEvents } from '../src/index'

// ── Augment MicraEvents for the duration of this test file ────────────────────
// Declaration merging — adds three typed events the rest of the suite uses.
declare module '../src/index' {
  interface MicraEvents {
    'cart:updated': { count: number }
    'user:login':   { id: number; name: string }
    'modal:close':  void
    'maybe:later':  { reason?: string } | undefined
  }
}

// ── 7.4 Typed payloads via MicraEvents ────────────────────────────────────────

describe('7.4 typed event bus — known events', () => {
  it('emit + on agree on payload type and value at runtime', () => {
    const handler = vi.fn<(p: { count: number }) => void>()
    const unsub = Micra.on('cart:updated', p => {
      // Inside the handler `p` is { count: number }. The runtime
      // assertion below also pins it.
      expect(typeof p.count).toBe('number')
      handler(p)
    })
    Micra.emit('cart:updated', { count: 3 })
    expect(handler).toHaveBeenCalledWith({ count: 3 })
    unsub()
  })

  it('handler param type is inferred from the event name', () => {
    const unsub = Micra.on('user:login', user => {
      // Compile-time: user is { id: number; name: string }
      // Runtime: just confirm shape
      expect(user.id).toBe(7)
      expect(user.name).toBe('Ada')
    })
    Micra.emit('user:login', { id: 7, name: 'Ada' })
    unsub()
  })

  it('events with `void` payload accept emit() without arguments', () => {
    const handler = vi.fn()
    const unsub = Micra.on('modal:close', handler)
    Micra.emit('modal:close')
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })

  it('events whose payload includes undefined make the arg optional', () => {
    const handler = vi.fn()
    const unsub = Micra.on('maybe:later', handler)
    Micra.emit('maybe:later')
    Micra.emit('maybe:later', { reason: 'cooldown' })
    expect(handler).toHaveBeenCalledTimes(2)
    unsub()
  })
})

describe('7.4 typed event bus — unknown events (backward compat)', () => {
  it('events absent from MicraEvents accept any payload (unknown)', () => {
    const handler = vi.fn()
    const unsub = Micra.on('legacy:thing', handler)
    Micra.emit('legacy:thing', { anything: true, goes: 'here' })
    expect(handler).toHaveBeenCalledWith({ anything: true, goes: 'here' })
    unsub()
  })

  it('events absent from MicraEvents allow emit without payload', () => {
    const handler = vi.fn()
    const unsub = Micra.on('legacy:ping', handler)
    Micra.emit('legacy:ping')
    expect(handler).toHaveBeenCalledTimes(1)
    unsub()
  })
})

describe('7.4 typed event bus — instance.emit / instance.on', () => {
  it('component instance methods inherit the same typing', async () => {
    document.body.innerHTML = `<div id="x" data-component="x"></div>`
    const inst = Micra.mount('#x', {
      state: { hits: 0 },
      onCreate() {
        this.on('cart:updated', p => {
          // Compile-time: p is { count: number }
          this.state.hits = p.count
        })
      },
    })!
    // onCreate runs in a microtask — flush before emitting.
    await Promise.resolve()
    Micra.emit('cart:updated', { count: 42 })
    expect(inst.state.hits).toBe(42)
    inst.destroy()
  })
})

// ── Negative type cases ───────────────────────────────────────────────────────
// These lines must remain type errors. The `@ts-expect-error` directive
// fails the build if the error disappears.
//
// We wrap in a never-called function so the runtime stays unaffected — only
// the typechecker visits the bodies.

function _typeAssertions() {
  // Wrong payload shape for a known event
  // @ts-expect-error — count must be number, not string
  Micra.emit('cart:updated', { count: '3' })

  // Missing required payload for a known event
  // @ts-expect-error — payload required for cart:updated
  Micra.emit('cart:updated')

  // Extra arg for void-payload event
  // @ts-expect-error — modal:close takes no payload
  Micra.emit('modal:close', { anything: true })

  // Handler signature mismatch
  // @ts-expect-error — handler receives { count: number }, not string
  Micra.on('cart:updated', (p: string) => p.length)

  // Test that MicraEvents type is exported (compile check only)
  const _e: keyof MicraEvents = 'cart:updated'
  void _e
}
void _typeAssertions
