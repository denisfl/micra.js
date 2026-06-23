/**
 * tests/destroy.test.ts — explicit teardown (destroy) and automatic cleanup
 * (autoCleanup) for swap-driven environments (htmx, Turbo, Astro, innerHTML).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { define, instances, registry } from '../src/core/registry'
import { start } from '../src/core/start'
import { destroy, autoCleanup } from '../src/core/destroy'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const macrotask = () => new Promise((r) => setTimeout(r, 0))

describe('destroy(el)', () => {
  it('runs onDestroy and removes the instance', () => {
    document.body.innerHTML = `<div id="host" data-component="d1"></div>`
    const onDestroy = vi.fn()
    define('d1', { state: {}, onDestroy })
    start()
    const el = document.getElementById('host')!

    expect(instances().has(el)).toBe(true)
    destroy(el)
    expect(onDestroy).toHaveBeenCalledTimes(1)
    expect(instances().has(el)).toBe(false)
  })

  it('tears down nested components too', () => {
    document.body.innerHTML =
      `<div id="p" data-component="p1"><div id="c" data-component="c1"></div></div>`
    define('p1', { state: {} })
    define('c1', { state: {} })
    start()
    const p = document.getElementById('p')!
    const c = document.getElementById('c')!

    destroy(p)
    expect(instances().has(p)).toBe(false)
    expect(instances().has(c)).toBe(false)
  })

  it('is idempotent and a no-op on plain elements', () => {
    document.body.innerHTML = `<div id="host" data-component="d2"></div><div id="plain"></div>`
    const onDestroy = vi.fn()
    define('d2', { state: {}, onDestroy })
    start()
    const el = document.getElementById('host')!

    destroy(el)
    destroy(el) // second call must not throw or re-fire
    destroy(document.getElementById('plain')!) // no component → no-op
    expect(onDestroy).toHaveBeenCalledTimes(1)
  })
})

describe('autoCleanup()', () => {
  it('destroys a component when its DOM is removed by any swap', async () => {
    document.body.innerHTML = `<div id="wrap"><div id="x" data-component="a1"></div></div>`
    const onDestroy = vi.fn()
    define('a1', { state: {}, onDestroy })
    start()
    const stop = autoCleanup()
    const x = document.getElementById('x')!
    expect(instances().has(x)).toBe(true)

    document.getElementById('wrap')!.remove() // simulates an htmx/Turbo swap-out
    await macrotask()

    expect(onDestroy).toHaveBeenCalledTimes(1)
    expect(instances().has(x)).toBe(false)
    stop()
  })

  it('leaves moved (still-connected) nodes alone', async () => {
    document.body.innerHTML =
      `<div id="from"><div id="m" data-component="b1"></div></div><div id="to"></div>`
    const onDestroy = vi.fn()
    define('b1', { state: {}, onDestroy })
    start()
    const stop = autoCleanup()
    const m = document.getElementById('m')!

    document.getElementById('to')!.appendChild(m) // remove + reinsert (a move)
    await macrotask()

    expect(onDestroy).not.toHaveBeenCalled()
    expect(instances().has(m)).toBe(true)
    stop()
  })
})
