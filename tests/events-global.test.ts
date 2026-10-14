/**
 * tests/events-global.test.ts — `.window` / `.outside` modifiers and tick().
 *
 * Both modifiers attach the listener outside the element (window / document),
 * so they must be removed explicitly on destroy() and when a data-each row
 * goes away — the element dying no longer takes the listener with it.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const flush = () => new Promise<void>((r) => setTimeout(r))
const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k }))
const click = (el: Element) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))

type Inst = { state: { open: boolean; n: number; items: { id: number }[] }; destroy(): void }

describe('.window', () => {
  it('listens on window, key guards still apply', () => {
    const { inst } = mountForTest('<div @keydown.escape.window="close"></div>', {
      state: { open: true },
      close() { this.state.open = false },
    }) as { inst: Inst }
    key('a')
    expect(inst.state.open).toBe(true)
    key('Escape')
    expect(inst.state.open).toBe(false)
  })

  it('is removed on destroy()', () => {
    const { inst } = mountForTest('<div @keydown.window="inc"></div>', {
      state: { n: 0 },
      inc() { this.state.n++ },
    }) as { inst: Inst }
    key('x')
    inst.destroy()
    key('x')
    expect(inst.state.n).toBe(1)
  })
})

describe('.outside', () => {
  const def = {
    state: { open: false, n: 0 },
    toggle() { this.state.open = !this.state.open },
    close() { this.state.n++; this.state.open = false },
  }

  it('fires for clicks outside the element only', () => {
    const { root, inst } = mountForTest(
      '<div @click.outside="close"><button>in</button></div>',
      def,
    ) as { root: HTMLElement; inst: Inst }
    const out = document.body.appendChild(document.createElement('p'))
    click(root.querySelector('button')!)
    expect(inst.state.n).toBe(0)
    click(root)
    expect(inst.state.n).toBe(0)
    click(out)
    expect(inst.state.n).toBe(1)
  })

  it('the click that opens a data-if panel does not close it', async () => {
    const { root, inst } = mountForTest(
      `<div>
        <button id="t" @click="toggle">menu</button>
        <div id="p" data-if="open" @click.outside="close">panel</div>
      </div>`,
      def,
    ) as { root: HTMLElement; inst: Inst }
    click(root.querySelector('#t')!)
    await flush()
    expect(inst.state.open).toBe(true)
    expect(document.getElementById('p')).not.toBeNull()
    expect(inst.state.n).toBe(0)
    // a later click elsewhere closes it
    click(document.body)
    await flush()
    expect(inst.state.open).toBe(false)
  })

  it('stays silent while its element is detached by data-if', () => {
    const { inst } = mountForTest(
      '<div><div data-if="open" @click.outside="close">panel</div></div>',
      def,
    ) as { inst: Inst }
    click(document.body)
    expect(inst.state.n).toBe(0)
  })

  it('is removed on destroy()', () => {
    const spy = vi.spyOn(document, 'removeEventListener')
    const { inst } = mountForTest('<div @click.outside="close"></div>', def) as { inst: Inst }
    inst.destroy()
    expect(spy).toHaveBeenCalledWith('click', expect.any(Function), true)
    click(document.body)
    expect(inst.state.n).toBe(0)
    spy.mockRestore()
  })

  it('is removed when its data-each row is removed', async () => {
    const calls: number[] = []
    const { inst } = mountForTest(
      `<div>
        <template data-each="items" data-key="id">
          <span @click.outside="hit(item.id)" data-text="item.id"></span>
        </template>
      </div>`,
      {
        state: { items: [{ id: 1 }, { id: 2 }] },
        hit(id: number) { calls.push(id) },
      },
    ) as { inst: Inst }
    await flush()
    click(document.body)
    expect(calls.sort()).toEqual([1, 2])
    inst.state.items = [{ id: 2 }]
    await flush()
    calls.length = 0
    click(document.body)
    expect(calls).toEqual([2])
  })
})

describe('tick()', () => {
  it('resolves after the pending render', async () => {
    const seen: (string | null)[] = []
    const { inst } = mountForTest(
      '<div><input data-if="open" data-ref="field"></div>',
      {
        state: { open: false },
        async show() {
          this.state.open = true
          await this.tick()
          seen.push(this.$el.querySelector('input') ? 'input' : null)
        },
      },
    ) as { inst: Inst & { show(): Promise<void> } }
    await inst.show()
    expect(seen).toEqual(['input'])
  })
})
