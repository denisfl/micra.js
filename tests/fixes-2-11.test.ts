/**
 * tests/fixes-2-11.test.ts — regressions from the 2026-11 core review.
 *
 * Each block pins a fixed bug:
 *   1. data-if on the single root of a data-each row hides that row.
 *   2. A component destroyed in the same task never runs onCreate.
 *   3. this.refs drops an element a data-if has taken out.
 *   4. Removing many rows with listeners is linear, not rows × listeners.
 *   5. A list without data-key keeps positional reuse after the merge into the
 *      keyed diff (row nodes survive, tail rows go).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mount } from '../src/core/mount'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => new Promise((r) => setTimeout(r, 0))
const texts = (root: Element) => [...root.querySelectorAll('li')].map((l) => l.textContent)

describe('data-if on a row root', () => {
  it('hides the row on the first render and toggles it later', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="items" data-key="id"><li data-if="item.show" data-text="item.n"></li></template></ul>',
      { state: { items: [{ id: 1, show: false, n: 'a' }, { id: 2, show: true, n: 'b' }] } },
    )
    expect(texts(root)).toEqual(['b'])
    ;(inst.state as any).items = [{ id: 1, show: true, n: 'a' }, { id: 2, show: true, n: 'b' }]
    await tick()
    expect(texts(root)).toEqual(['a', 'b'])
  })

  it('keeps a hidden row hidden through a reorder', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="items" data-key="id"><li data-if="item.show" data-text="item.n"></li></template></ul>',
      { state: { items: [{ id: 1, show: false, n: 'a' }, { id: 2, show: true, n: 'b' }, { id: 3, show: true, n: 'c' }] } },
    )
    const s = (inst.state as any).items
    ;(inst.state as any).items = [s[2], s[0], s[1]]
    await tick()
    expect(texts(root)).toEqual(['c', 'b'])
  })
})

describe('onCreate after an immediate destroy', () => {
  it('does not run', async () => {
    document.body.innerHTML = '<div id="r"></div>'
    const log: string[] = []
    const inst = mount('#r', {
      state: {},
      onCreate() { log.push('create') },
      onDestroy() { log.push('destroy') },
    })!
    inst.destroy()
    await tick()
    expect(log).toEqual(['destroy'])
  })
})

describe('refs and data-if', () => {
  it('a ref inside a falsy data-if is not in this.refs, and comes back with it', async () => {
    const { inst } = mountForTest(
      '<div><input data-if="open" data-ref="field"><b data-ref="always"></b></div>',
      { state: { open: false } },
    )
    expect(inst.refs.field).toBeUndefined()
    expect(inst.refs.always).toBeDefined()
    ;(inst.state as any).open = true
    await tick()
    expect(inst.refs.field?.isConnected).toBe(true)
  })
})

describe('removing rows with listeners', () => {
  // Time to clear n rows (two @ listeners each); checks the records are dropped.
  const clear = async (n: number) => {
    document.body.innerHTML = ''
    const { root, inst } = mountForTest(
      '<div><template data-each="items" data-key="id"><p><button @click="a"></button><button @click="b"></button></p></template></div>',
      { state: { items: Array.from({ length: n }, (_, i) => ({ id: i })) }, a() {}, b() {} },
    )
    const t0 = performance.now()
    ;(inst.state as any).items = []
    await tick()
    const ms = performance.now() - t0
    expect(root.querySelectorAll('p').length).toBe(0)
    expect((inst as any).__micraListeners.length).toBe(0)
    return ms
  }

  it('scales linearly, not rows x listeners', async () => {
    await clear(200) // warm up
    const small = await clear(1000)
    const big = await clear(4000)
    // Quadratic removal made 4x the rows cost ~16x the time; linear is ~4x.
    // A ratio, not an absolute bound, so a loaded machine doesn't fail it.
    expect(big / Math.max(small, 1)).toBeLessThan(10)
  })
})

describe('data-each without data-key', () => {
  it('reuses row nodes by position and removes the tail', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="items"><li data-text="item"></li></template></ul>',
      { state: { items: ['a', 'b', 'c'] } },
    )
    const first = root.querySelector('li')
    ;(inst.state as any).items = ['x', 'y']
    await tick()
    expect(texts(root)).toEqual(['x', 'y'])
    expect(root.querySelector('li')).toBe(first)
  })

  it('renders null items without throwing', async () => {
    const { root } = mountForTest(
      '<ul><template data-each="items"><li data-text="item || \'-\'"></li></template></ul>',
      { state: { items: [null, 'b'] } },
    )
    expect(texts(root)).toEqual(['-', 'b'])
  })
})
