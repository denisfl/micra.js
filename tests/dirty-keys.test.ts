/**
 * tests/dirty-keys.test.ts — coarse dependency (dirty-key) filtering.
 *
 * On a partial render Micra skips directives whose state deps didn't change.
 * These tests guard CORRECTNESS: a skipped directive must never leave stale
 * DOM, and a directive that DOES depend on the changed key must update.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('dirty-key filtering', () => {
  it('changing a shared key updates only dependent directives, leaves others intact', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="rows" data-key="id">' +
        '<li data-class="sel:item.id === selected"><span data-text="item.label"></span></li>' +
        '</template></ul>',
      { state: { rows: [{ id: 1, label: 'a' }, { id: 2, label: 'b' }, { id: 3, label: 'c' }], selected: 0 } },
    )
    await tick()

    // Flip the shared `selected` key — only the data-class depends on it.
    inst.state.selected = 2
    await tick()
    const lis = [...root.querySelectorAll('li')]
    expect(lis[1]!.classList.contains('sel')).toBe(true)
    expect(lis[0]!.classList.contains('sel')).toBe(false)
    // The item.label texts were dep-skipped — they must NOT have gone stale/blank.
    expect(lis.map((li) => li.textContent)).toEqual(['a', 'b', 'c'])

    // Moving the selection clears the old row and sets the new one.
    inst.state.selected = 1
    await tick()
    expect(lis[0]!.classList.contains('sel')).toBe(true)
    expect(lis[1]!.classList.contains('sel')).toBe(false)
  })

  it('a top-level directive updates only when its own key changes', async () => {
    const { root, inst } = mountForTest(
      '<div><span class="a" data-text="a"></span><span class="b" data-text="b"></span></div>',
      { state: { a: 'x', b: 'y' } },
    )
    await tick()
    inst.state.a = 'X' // only `a` changed
    await tick()
    expect(root.querySelector('.a')!.textContent).toBe('X')
    expect(root.querySelector('.b')!.textContent).toBe('y') // unchanged, still correct
  })

  it('replacing the list array still re-renders changed rows', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="rows" data-key="id"><li data-text="item.label"></li></template></ul>',
      { state: { rows: [{ id: 1, label: 'a' }, { id: 2, label: 'b' }] } },
    )
    await tick()
    inst.state.rows = [{ id: 1, label: 'A' }, { id: 2, label: 'b' }]
    await tick()
    expect([...root.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['A', 'b'])
  })

  it('method-call expressions are never skipped (deps unknown)', async () => {
    const { root, inst } = mountForTest(
      '<div><span data-text="label()"></span></div>',
      {
        state: { n: 1 },
        label() {
          return 'n=' + (this as { state: { n: number } }).state.n
        },
      },
    )
    await tick()
    inst.state.n = 2 // label() reads n via a method — must re-evaluate despite the key
    await tick()
    expect(root.querySelector('span')!.textContent).toBe('n=2')
  })
})
