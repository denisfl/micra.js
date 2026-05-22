/**
 * tests/expr.test.ts — Expression evaluator tests (section 2)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evalExpr } from '../src/utils/expr'

// ── 2.1 Simple expressions ────────────────────────────────────────────────────

describe('2.1 Simple expressions', () => {
  it('"count" — property lookup', () => {
    expect(evalExpr('count', { count: 42 })).toBe(42)
  })

  it('"count + 1" — arithmetic', () => {
    expect(evalExpr('count + 1', { count: 4 })).toBe(5)
  })

  it('"user.name" — dot path (fast-path)', () => {
    expect(evalExpr('user.name', { user: { name: 'Alice' } })).toBe('Alice')
  })

  it('"count > 0" — boolean expression', () => {
    expect(evalExpr('count > 0', { count: 1 })).toBe(true)
    expect(evalExpr('count > 0', { count: 0 })).toBe(false)
  })

  it('"items.length" — array length', () => {
    expect(evalExpr('items.length', { items: [1, 2, 3] })).toBe(3)
  })
})

// ── 2.2 Expressions with methods ─────────────────────────────────────────────

describe('2.2 Expressions with methods', () => {
  it('"format(count)" — calls state function', () => {
    const state = {
      count: 7,
      format: (n: number) => `#${n}`,
    } as Record<string, unknown>
    expect(evalExpr('format(count)', state)).toBe('#7')
  })

  it('"items.join(",")" — built-in method call', () => {
    expect(evalExpr('items.join(",")', { items: ['a', 'b', 'c'] })).toBe('a,b,c')
  })
})

// ── 2.3 Expression errors ─────────────────────────────────────────────────────

describe('2.3 Expression errors', () => {
  it('syntax error → does not throw, returns undefined', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => evalExpr('{{invalid', {})).not.toThrow()
    expect(evalExpr('{{invalid', {})).toBeUndefined()
    warnSpy.mockRestore()
  })

  it('syntax error → warns in console', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    evalExpr('{{invalid--syntax', {})
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('runtime error → returns undefined without throwing', () => {
    // null.foo throws at runtime
    expect(() => evalExpr('null.foo', {})).not.toThrow()
    expect(evalExpr('null.foo', {})).toBeUndefined()
  })

  it('undefined variable → returns undefined', () => {
    expect(evalExpr('nonExistent', {})).toBeUndefined()
  })
})

// ── 2.4 Caching ───────────────────────────────────────────────────────────────

describe('2.4 Caching', () => {
  it('same expression string → function not re-created', () => {
    const FunctionSpy = vi.spyOn(globalThis, 'Function')

    // First call — may compile
    evalExpr('count * 2', { count: 3 })
    const callsAfterFirst = FunctionSpy.mock.calls.length

    // Second call with same expression — should NOT call new Function again
    evalExpr('count * 2', { count: 5 })
    expect(FunctionSpy.mock.calls.length).toBe(callsAfterFirst)

    FunctionSpy.mockRestore()
  })

  it('warm cache returns correct result', () => {
    evalExpr('price * qty', { price: 10, qty: 3 })  // warm up
    expect(evalExpr('price * qty', { price: 10, qty: 3 })).toBe(30)
    expect(evalExpr('price * qty', { price: 5, qty: 4 })).toBe(20)
  })

  it('fast-path (simple dot path) does not use Function()', () => {
    const FunctionSpy = vi.spyOn(globalThis, 'Function')
    const beforeCount = FunctionSpy.mock.calls.length
    evalExpr('user.profile.name', { user: { profile: { name: 'Bob' } } })
    expect(FunctionSpy.mock.calls.length).toBe(beforeCount) // no new Function()
    FunctionSpy.mockRestore()
  })
})
