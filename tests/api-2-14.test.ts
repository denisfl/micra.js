/**
 * tests/api-2-14.test.ts — JSON props, this.listen(), onUpdate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('prop() with an array or object default parses JSON', () => {
  it('array and object defaults', () => {
    const { inst } = mountForTest('<div></div>', { state: {} }, {
      props: { items: '[{"id":1},{"id":2}]', opts: '{"a":1}' },
    })
    expect(inst.prop('items', [])).toEqual([{ id: 1 }, { id: 2 }])
    expect(inst.prop('opts', {})).toEqual({ a: 1 })
  })

  it('invalid JSON falls back to the default and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fallback = [0]
    const { inst } = mountForTest('<div></div>', { state: {} }, { props: { items: '[oops' } })
    expect(inst.prop('items', fallback)).toBe(fallback)
    expect(warn.mock.calls[0]![0]).toMatch(/data-items is not valid JSON/)
    warn.mockRestore()
  })

  it('leaves other defaults as before', () => {
    const { inst } = mountForTest('<div></div>', { state: {} }, {
      props: { n: '20', zip: '01234', list: '[1]' },
    })
    expect(inst.prop('n', 10)).toBe(20)
    expect(inst.prop('zip', '')).toBe('01234')
    expect(inst.prop('list')).toBe('[1]') // no default: no JSON parsing
    expect(inst.prop('missing', [])).toEqual([])
  })
})

describe('this.listen()', () => {
  it('calls the handler with the instance as this, and destroy() removes it', () => {
    const calls: unknown[] = []
    const { inst } = mountForTest('<div></div>', {
      state: { n: 0 },
      onResize(this: any) { calls.push(this.state.n) },
    })
    inst.listen(window, 'resize', (inst as any).onResize)
    window.dispatchEvent(new Event('resize'))
    expect(calls).toEqual([0])
    inst.destroy()
    window.dispatchEvent(new Event('resize'))
    expect(calls).toEqual([0])
  })

  it('returns a function that removes the listener and its record', () => {
    let n = 0
    const { inst } = mountForTest('<div></div>', { state: {} })
    const before = (inst as any).__micraListeners?.length ?? 0
    const off = inst.listen(document, 'pointermove', () => n++)
    document.dispatchEvent(new Event('pointermove'))
    off()
    document.dispatchEvent(new Event('pointermove'))
    expect(n).toBe(1)
    expect((inst as any).__micraListeners.length).toBe(before)
  })
})

describe('onUpdate', () => {
  it('runs after renders, not on mount, with the written keys and the DOM up to date', async () => {
    const seen: Array<string[] | null> = []
    const texts: string[] = []
    const { root, inst } = mountForTest('<div><b data-text="a"></b></div>', {
      state: { a: 1, b: 2 },
      onUpdate(keys) {
        seen.push(keys && [...keys].sort())
        texts.push(root.querySelector('b')!.textContent!)
      },
    })
    expect(seen).toEqual([])
    ;(inst.state as any).a = 5
    ;(inst.state as any).b = 6
    await tick()
    expect(seen).toEqual([['a', 'b']])
    expect(texts).toEqual(['5'])
    inst.render()
    expect(seen[1]).toBeNull()
  })

  it('may write state; the write renders', async () => {
    const { root, inst } = mountForTest('<div><b data-text="label"></b></div>', {
      state: { n: 0, label: '' },
      onUpdate(keys) {
        if (keys?.has('n')) this.state.label = 'n=' + this.state.n
      },
    })
    ;(inst.state as any).n = 3
    await tick()
    await tick()
    expect(root.querySelector('b')!.textContent).toBe('n=3')
  })
})
