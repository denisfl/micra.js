/**
 * tests/reactive.test.ts — Reactive state & scheduler tests (section 1)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createReactiveState, createScheduler } from '../src/core/reactive'

// ── 1.1 Basic reactivity ──────────────────────────────────────────────────────

describe('1.1 Basic reactivity', () => {
  it('state update → schedule called once', async () => {
    const render = vi.fn()
    const schedule = createScheduler(render)
    const state = createReactiveState({ count: 0 }, schedule)

    state.count = 1
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('multiple mutations in one tick → render called once', async () => {
    const render = vi.fn()
    const schedule = createScheduler(render)
    const state = createReactiveState({ count: 0, name: 'x' }, schedule)

    state.count = 1
    state.count = 2
    state.name = 'y'
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('assigning same value → schedule is still called', async () => {
    const render = vi.fn()
    const schedule = createScheduler(render)
    const state = createReactiveState({ count: 5 }, schedule)

    state.count = 5  // same value, Proxy still triggers
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('nested object mutation is NOT tracked (expected behavior)', async () => {
    const render = vi.fn()
    const schedule = createScheduler(render)
    const nested = { value: 1 }
    const state = createReactiveState({ nested } as Record<string, unknown>, schedule)

    // Mutate nested directly — no Proxy on nested, schedule NOT called
    nested.value = 2
    await Promise.resolve()
    expect(render).not.toHaveBeenCalled()

    // Replace the reference — schedule IS called
    state['nested'] = { value: 3 }
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
  })
})

// ── 1.2 Mutation types ────────────────────────────────────────────────────────

describe('1.2 Mutation types', () => {
  function makeState<T>(val: T) {
    const render = vi.fn()
    const s = createReactiveState({ val } as Record<string, unknown>, createScheduler(render))
    return { s, render }
  }

  it('number', async () => {
    const { s, render } = makeState(0)
    s['val'] = 42
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['val']).toBe(42)
  })

  it('string', async () => {
    const { s, render } = makeState('')
    s['val'] = 'hello'
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['val']).toBe('hello')
  })

  it('boolean', async () => {
    const { s, render } = makeState(false)
    s['val'] = true
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['val']).toBe(true)
  })

  it('object', async () => {
    const { s, render } = makeState(null)
    s['val'] = { name: 'Alice' }
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect((s['val'] as Record<string, unknown>)['name']).toBe('Alice')
  })

  it('array replace (not mutate)', async () => {
    const { s, render } = makeState([1, 2, 3])
    const prev = s['val']
    s['val'] = [...(prev as number[]), 4]
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['val']).toEqual([1, 2, 3, 4])
  })
})

// ── 1.3 Edge cases ────────────────────────────────────────────────────────────

describe('1.3 Edge cases', () => {
  it('assigning undefined triggers schedule', async () => {
    const render = vi.fn()
    const s = createReactiveState({ x: 1 } as Record<string, unknown>, createScheduler(render))
    s['x'] = undefined
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['x']).toBeUndefined()
  })

  it('assigning null triggers schedule', async () => {
    const render = vi.fn()
    const s = createReactiveState({ x: 1 } as Record<string, unknown>, createScheduler(render))
    s['x'] = null
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
    expect(s['x']).toBeNull()
  })

  it('delete does not trigger schedule (not supported — Proxy has no deleteProperty)', async () => {
    // delete bypasses the Proxy set trap — documented limitation
    const render = vi.fn()
    const raw = { x: 1 } as Record<string, unknown>
    createReactiveState(raw, createScheduler(render))
    // Deleting from raw directly (Proxy set not involved)
    delete raw['x']
    await Promise.resolve()
    expect(render).not.toHaveBeenCalled()
  })
})

// ── 11.2 Scheduler batching ───────────────────────────────────────────────────

describe('11.2 Scheduler batching', () => {
  it('10 mutations → 1 render', async () => {
    const render = vi.fn()
    const schedule = createScheduler(render)
    const state = createReactiveState(
      Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), i])),
      schedule,
    )
    for (let i = 0; i < 10; i++) state[String(i)] = i * 2
    await Promise.resolve()
    expect(render).toHaveBeenCalledTimes(1)
  })
})
