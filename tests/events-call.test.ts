/**
 * tests/events-call.test.ts — call expressions in @event (2.4).
 *
 * `@click="select(item.id)"`, `@click="add('x')"`, `@input="set($event…)"` —
 * the handler value may be a call expression, evaluated against an event scope
 * (row `item`, `$event`/`event`, component methods).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => Promise.resolve()

describe('@event call expressions', () => {
  it('bare method still works (no parens)', () => {
    const { root } = mountForTest('<div><button @click="inc">+</button></div>', {
      state: { n: 0 },
      inc() { this.state.n++ },
    })
    root.querySelector('button')!.click()
    expect((instances().get(root) as { state: { n: number } }).state.n).toBe(1)
  })

  it('call with no args: @click="inc()"', () => {
    const { inst } = mountForTest('<div><button @click="inc()">+</button></div>', {
      state: { n: 0 },
      inc() { this.state.n++ },
    }) as { inst: { state: { n: number } } }
    document.querySelector('button')!.click()
    expect(inst.state.n).toBe(5 - 4)
  })

  it('call with string literal arg: @click="pick(\'b\')"', () => {
    const { inst } = mountForTest(
      `<div><button @click="pick('b')">b</button></div>`,
      {
        state: { chosen: '' },
        pick(v: string) { this.state.chosen = v },
      },
    ) as { inst: { state: { chosen: string } } }
    document.querySelector('button')!.click()
    expect(inst.state.chosen).toBe('b')
  })

  it('row item arg: @click="select(item.id)" inside data-each', () => {
    const { root, inst } = mountForTest(
      `<div>
        <template data-each="items" data-key="id">
          <button @click="select(item.id)" data-text="item.label"></button>
        </template>
      </div>`,
      {
        state: { items: [{ id: 10, label: 'A' }, { id: 20, label: 'B' }], picked: 0 },
        select(id: number) { this.state.picked = id },
      },
    ) as { root: HTMLElement; inst: { state: { picked: number } } }
    const buttons = root.querySelectorAll('button')
    expect(buttons.length).toBe(2)
    buttons[1]!.click()
    expect(inst.state.picked).toBe(20)
    buttons[0]!.click()
    expect(inst.state.picked).toBe(10)
  })

  it('$event access: @input="store($event.target.value)"', () => {
    const { inst } = mountForTest(
      `<div><input @input="store($event.target.value)"></div>`,
      {
        state: { v: '' },
        store(v: string) { this.state.v = v },
      },
    ) as { inst: { state: { v: string } } }
    const input = document.querySelector('input')!
    input.value = 'hello'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(inst.state.v).toBe('hello')
  })

  it('row mutation through call arg re-renders the list', async () => {
    const { root, inst } = mountForTest(
      `<div>
        <template data-each="items" data-key="id">
          <span data-text="item.label"></span>
          <button @click="bump(item.id)">+</button>
        </template>
      </div>`,
      {
        state: { items: [{ id: 1, label: 'x' }] },
        bump(id: number) {
          this.state.items = this.state.items.map(i =>
            i.id === id ? { ...i, label: i.label + '!' } : i,
          )
        },
      },
    ) as { root: HTMLElement; inst: { state: { items: { label: string }[] } } }
    root.querySelector('button')!.click()
    await tick()
    expect(root.querySelector('span')!.textContent).toBe('x!')
  })

  it('unknown method in call expr does not throw', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root } = mountForTest('<div><button @click="nope()">x</button></div>', {
      state: {},
    })
    expect(() => document.querySelector('button')!.click()).not.toThrow()
    warnSpy.mockRestore()
    void root
  })
})

describe('@event key modifiers', () => {
  function keydown(el: Element, key: string, mods: Partial<Record<'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey', boolean>> = {}) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...mods }))
  }

  it('@keydown.enter fires only on Enter', () => {
    const { inst } = mountForTest(
      `<div><input @keydown.enter="go"></div>`,
      { state: { n: 0 }, go() { this.state.n++ } },
    ) as { inst: { state: { n: number } } }
    const input = document.querySelector('input')!
    keydown(input, 'a')
    expect(inst.state.n).toBe(0)
    keydown(input, 'Enter')
    expect(inst.state.n).toBe(1)
  })

  it('@keydown.escape fires only on Escape', () => {
    const { inst } = mountForTest(
      `<div><input @keydown.escape="close"></div>`,
      { state: { open: true }, close() { this.state.open = false } },
    ) as { inst: { state: { open: boolean } } }
    const input = document.querySelector('input')!
    keydown(input, 'Enter')
    expect(inst.state.open).toBe(true)
    keydown(input, 'Escape')
    expect(inst.state.open).toBe(false)
  })

  it('system modifier @keydown.ctrl gates on ctrlKey', () => {
    const { inst } = mountForTest(
      `<div><input @keydown.ctrl="hit"></div>`,
      { state: { n: 0 }, hit() { this.state.n++ } },
    ) as { inst: { state: { n: number } } }
    const input = document.querySelector('input')!
    keydown(input, 's')
    expect(inst.state.n).toBe(0)
    keydown(input, 's', { ctrlKey: true })
    expect(inst.state.n).toBe(1)
  })

  it('key modifier composes with .prevent', () => {
    const { inst } = mountForTest(
      `<div><input @keydown.enter.prevent="go"></div>`,
      { state: { n: 0 }, go() { this.state.n++ } },
    ) as { inst: { state: { n: number } } }
    const input = document.querySelector('input')!
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(e)
    expect(inst.state.n).toBe(1)
    expect(e.defaultPrevented).toBe(true)
  })
})

describe('this.set + nested data-model', () => {
  it('this.set writes a flat key', () => {
    const { inst } = mountForTest('<div></div>', { state: { count: 0 } }) as {
      inst: { set(p: string, v: unknown): void; state: { count: number } }
    }
    inst.set('count', 5)
    expect(inst.state.count).toBe(5)
  })

  it('this.set reconstructs a nested path immutably and triggers render', async () => {
    const { root, inst } = mountForTest(
      `<div><span data-text="user.name"></span></div>`,
      { state: { user: { name: 'A', age: 1 } } },
    ) as { root: HTMLElement; inst: { set(p: string, v: unknown): void; state: { user: { name: string; age: number } } } }
    const before = inst.state.user
    inst.set('user.name', 'B')
    expect(inst.state.user.name).toBe('B')
    expect(inst.state.user.age).toBe(1)        // sibling preserved
    expect(inst.state.user).not.toBe(before)   // new object (immutable reconstruct)
    await Promise.resolve()
    expect(root.querySelector('span')!.textContent).toBe('B')
  })

  it('data-model="filters.query" reads and writes the nested path', async () => {
    const { root, inst } = mountForTest(
      `<div><input data-model="filters.query"><span data-text="filters.query"></span></div>`,
      { state: { filters: { query: 'hi', sort: 'asc' } } },
    ) as { root: HTMLElement; inst: { state: { filters: { query: string; sort: string } } } }
    const input = root.querySelector('input')!
    expect(input.value).toBe('hi')             // initial read through path
    input.value = 'world'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(inst.state.filters.query).toBe('world')
    expect(inst.state.filters.sort).toBe('asc') // sibling preserved
    await Promise.resolve()
    expect(root.querySelector('span')!.textContent).toBe('world')
  })
})
