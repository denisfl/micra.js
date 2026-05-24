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
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // null.foo throws at runtime
    expect(() => evalExpr('null.foo', {})).not.toThrow()
    expect(evalExpr('null.foo', {})).toBeUndefined()
    warnSpy.mockRestore()
  })

  it('runtime error warns once per expression — repeated calls are silent', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Expression goes through Function path (has parens) so a runtime throw
    // is observable. Identifier 'uniqueBoomM2' is undefined → undefined.bar() throws.
    const expr = 'uniqueBoomM2.bar()'
    evalExpr(expr, {})
    evalExpr(expr, {})
    evalExpr(expr, {})
    const matching = warnSpy.mock.calls.filter(c =>
      String(c[0]).includes('uniqueBoomM2'),
    )
    expect(matching.length).toBe(1)
    warnSpy.mockRestore()
  })

  it('undefined variable → returns undefined', () => {
    expect(evalExpr('nonExistent', {})).toBeUndefined()
  })
})

// ── 2.5 Security — global / prototype shadowing ───────────────────────────────

describe('2.5 Security', () => {
  it('bare "constructor" does not leak Object', () => {
    expect(evalExpr('constructor', { count: 1 })).toBeUndefined()
  })

  it('constructor.constructor chain returns undefined (cannot reach Function)', () => {
    expect(evalExpr('constructor.constructor', { count: 1 })).toBeUndefined()
  })

  it('"toString" identifier returns undefined unless state-defined', () => {
    expect(evalExpr('toString', { count: 1 })).toBeUndefined()
    expect(evalExpr('toString', { toString: () => 'x' })).toBeTypeOf('function')
  })

  it('"window" / "globalThis" / "document" / "fetch" are not reachable', () => {
    expect(evalExpr('window', {})).toBeUndefined()
    expect(evalExpr('globalThis', {})).toBeUndefined()
    expect(evalExpr('document', {})).toBeUndefined()
    expect(evalExpr('fetch', {})).toBeUndefined()
    expect(evalExpr('setTimeout', {})).toBeUndefined()
    expect(evalExpr('eval', {})).toBeUndefined()
  })

  it('whitelisted globals still work — Math, JSON, Date, Array, Object', () => {
    expect(evalExpr('Math.round(price)', { price: 1.7 })).toBe(2)
    expect(evalExpr('JSON.stringify(obj)', { obj: { a: 1 } })).toBe('{"a":1}')
    expect(evalExpr('Number(x)', { x: '42' })).toBe(42)
    expect(evalExpr('Array.isArray(items)', { items: [] })).toBe(true)
  })

  it('user can shadow a whitelisted global with a state key', () => {
    expect(evalExpr('Math', { Math: 'mine' })).toBe('mine')
  })

  it('method calls via state still work (instance fallthrough)', () => {
    const state = { count: 7, format: (n: number) => `#${n}` } as Record<string, unknown>
    expect(evalExpr('format(count)', state)).toBe('#7')
  })

  it('fast-path also blocks Object.prototype names', () => {
    expect(evalExpr('constructor', {})).toBeUndefined()
    expect(evalExpr('hasOwnProperty', {})).toBeUndefined()
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
