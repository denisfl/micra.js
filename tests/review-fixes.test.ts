/**
 * tests/review-fixes.test.ts — regressions from the 2026-07 deep review.
 *
 * Each block pins a fixed bug:
 *   1. State write from a directive-expression method must not loop the scheduler.
 *   2. data-model on checkbox/radio syncs the `checked` property (state → DOM).
 *   3. data-bind="checked:…" writes the property, not the attribute.
 *   4. Whole-row each skip is disabled for rows with method-call bindings.
 *   5. Removed keyed rows release their tracked listener records.
 *   6. javascript: URL guard catches control-character obfuscation.
 *   7. setPath through an array index keeps the array an array.
 *   8. autoCleanup does not destroy components hidden by a data-if ancestor.
 *   9. destroy() returns the DOM to its pre-mount shape (data-if back, rows gone).
 *  10. delete state.key triggers a render.
 *  11. data-on handler expressions may contain ':' and ',' inside string args.
 *  12. prop() with a string default returns the raw attribute string.
 *  13. non-data-* attributes (dark-text) are not treated as directives.
 *  14. data-model/data-ref inside rows warn (not silently break).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { setPath } from '../src/core/reactive'
import { autoCleanup } from '../src/core/destroy'
import { mountForTest } from './helpers/mount'
import type { InternalInstance, StateRecord } from '../src/types'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('write-during-render guard', () => {
  it('a directive-expression method that writes state does not re-render forever', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let calls = 0
    const { root } = mountForTest(
      '<div><span data-text="poison()"></span></div>',
      {
        state: { n: 0 },
        poison() {
          calls++
          this.state.n++
          return String(this.state.n)
        },
      },
    )
    // Drain several microtask generations; an unguarded loop would keep
    // scheduling renders and `calls` would grow with every generation.
    for (let i = 0; i < 10; i++) await tick()
    expect(calls).toBeLessThanOrEqual(3)
    expect(root.querySelector('span')!.textContent).not.toBe('')
    warn.mockRestore()
  })
})

describe('data-model on checkbox and radio (state → DOM)', () => {
  it('unchecks a checkbox when state turns false', async () => {
    const { root, inst } = mountForTest(
      '<div><input type="checkbox" data-model="agree" /></div>',
      { state: { agree: true } },
    )
    await tick()
    const box = root.querySelector('input')!
    expect(box.checked).toBe(true)
    inst.state.agree = false
    await tick()
    expect(box.checked).toBe(false)
    // value attribute must not be corrupted to "false"
    expect(box.getAttribute('value')).not.toBe('false')
  })

  it('radio group keeps its option values and follows state', async () => {
    const { root, inst } = mountForTest(
      '<div>' +
        '<input type="radio" name="c" value="a" data-model="choice" />' +
        '<input type="radio" name="c" value="b" data-model="choice" />' +
        '</div>',
      { state: { choice: 'a' } },
    )
    await tick()
    const radios = [...root.querySelectorAll('input')]
    expect(radios.map((r) => r.value)).toEqual(['a', 'b'])
    expect(radios.map((r) => r.checked)).toEqual([true, false])
    inst.state.choice = 'b'
    await tick()
    expect(radios.map((r) => r.checked)).toEqual([false, true])
  })
})

describe('data-bind="checked:…"', () => {
  it('drives the property so state can uncheck after user interaction', async () => {
    const { root, inst } = mountForTest(
      '<div><input type="checkbox" data-bind="checked:on" /></div>',
      { state: { on: true } },
    )
    await tick()
    const box = root.querySelector('input')!
    expect(box.checked).toBe(true)
    // simulate a user toggle (property changes, attribute stays)
    box.checked = true
    inst.state.on = false
    await tick()
    expect(box.checked).toBe(false)
  })
})

describe('each row skip with method-call bindings', () => {
  it('re-evaluates method calls in rows when only the list key changes', async () => {
    const { root, inst } = mountForTest(
      '<ul><template data-each="items" data-key="id">' +
        '<li data-text="total()"></li>' +
        '</template></ul>',
      {
        state: { items: [{ id: 1 }, { id: 2 }] },
        total() {
          return String(this.state.items.length)
        },
      },
    )
    await tick()
    inst.state.items = [...inst.state.items, { id: 3 }]
    await tick()
    const texts = [...root.querySelectorAll('li')].map((li) => li.textContent)
    expect(texts).toEqual(['3', '3', '3'])
  })
})

describe('listener records for removed keyed rows', () => {
  it('does not grow __micraListeners across row churn', async () => {
    const { inst } = mountForTest(
      '<ul><template data-each="items" data-key="id">' +
        '<li><button @click="noop">x</button></li>' +
        '</template></ul>',
      { state: { items: [{ id: 1 }, { id: 2 }] }, noop() {} },
    )
    await tick()
    const internal = inst as unknown as InternalInstance<StateRecord>
    const baseline = internal.__micraListeners!.length
    // Ten generations of a fully-replaced 2-row list.
    for (let g = 0; g < 10; g++) {
      inst.state.items = [{ id: 100 + g }, { id: 200 + g }]
      await tick()
    }
    expect(internal.__micraListeners!.length).toBe(baseline)
  })
})

describe('javascript: URL guard', () => {
  it('drops javascript: obfuscated with embedded tab/newline', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root, inst } = mountForTest(
      '<div><a data-bind="href:url">x</a></div>',
      { state: { url: '#' } },
    )
    await tick()
    inst.state.url = 'java\tscript:alert(1)'
    await tick()
    expect(root.querySelector('a')!.getAttribute('href')).toBeNull()
    inst.state.url = 'java\nscript:alert(1)'
    await tick()
    expect(root.querySelector('a')!.getAttribute('href')).toBeNull()
    warn.mockRestore()
  })
})

describe('setPath through an array index', () => {
  it('keeps the array an array', () => {
    const state: StateRecord = { items: [{ done: false }, { done: false }] }
    setPath(state, 'items.0.done', true)
    expect(Array.isArray(state.items)).toBe(true)
    expect((state.items as Array<{ done: boolean }>)[0]!.done).toBe(true)
    expect((state.items as Array<{ done: boolean }>)[1]!.done).toBe(false)
  })
})

describe('autoCleanup vs data-if', () => {
  it('does not destroy a nested component hidden by a parent data-if', async () => {
    const stop = autoCleanup()
    const destroyed: string[] = []
    document.body.innerHTML =
      '<div data-component="outer"><section data-if="show">' +
      '<div data-component="inner"><em data-text="label"></em></div>' +
      '</section></div>'
    const { define } = await import('../src/core/registry')
    const { start } = await import('../src/core/start')
    define('outer', { state: { show: true } })
    define('inner', {
      state: { label: 'hi' },
      onDestroy() {
        destroyed.push('inner')
      },
    })
    start()
    await tick()

    const outer = [...(instances() as Map<HTMLElement, { state: StateRecord }>).entries()].find(
      ([el]) => el.dataset.component === 'outer',
    )![1]
    outer.state.show = false
    await tick()
    await tick() // let the MutationObserver callback run
    expect(destroyed).toEqual([])

    outer.state.show = true
    await tick()
    await tick()
    // the inner component is alive and still renders
    expect(document.querySelector('em')!.textContent).toBe('hi')
    stop()
  })
})

describe('destroy() restores the pre-mount DOM', () => {
  it('brings back a data-if-detached element and removes each rows', async () => {
    const { root, inst } = mountForTest(
      '<div><p data-if="show">hello</p>' +
        '<ul><template data-each="items" data-key="id"><li data-text="item.id"></li></template></ul></div>',
      { state: { show: false, items: [{ id: 1 }, { id: 2 }] } },
    )
    await tick()
    expect(root.querySelector('p')).toBeNull() // detached by data-if
    expect(root.querySelectorAll('li')).toHaveLength(2)

    inst.destroy()
    // data-if element restored, rendered rows removed — pre-mount shape
    expect(root.querySelector('p')).not.toBeNull()
    expect(root.querySelectorAll('li')).toHaveLength(0)

    // a fresh mount of the SAME DOM works: rows render, data-if obeys state
    const { mount } = await import('../src/core/mount')
    const inst2 = mount(root, {
      state: { show: true, items: [{ id: 7 }] },
    })!
    await tick()
    expect(root.querySelector('p')).not.toBeNull()
    const lis = [...root.querySelectorAll('li')].map((li) => li.textContent)
    expect(lis).toEqual(['7'])
    inst2.destroy()
  })
})

describe('delete on state', () => {
  it('triggers a render', async () => {
    const { root, inst } = mountForTest(
      '<div><span data-text="msg || \'gone\'"></span></div>',
      { state: { msg: 'hi' } },
    )
    await tick()
    expect(root.querySelector('span')!.textContent).toBe('hi')
    delete (inst.state as Record<string, unknown>).msg
    await tick()
    expect(root.querySelector('span')!.textContent).toBe('gone')
  })
})

describe('data-on with punctuation inside string args', () => {
  it("click:go('a:b') and go('a,b') both fire with the right argument", async () => {
    const got: string[] = []
    const { root } = mountForTest(
      '<div><button id="b1" data-on="click:go(\'a:b\')">x</button>' +
        '<button id="b2" data-on="click:go(\'a,b\'), focus:go(\'f\')">y</button></div>',
      { state: {}, go(v: string) { got.push(v) } },
    )
    await tick()
    ;(root.querySelector('#b1') as HTMLElement).click()
    ;(root.querySelector('#b2') as HTMLElement).click()
    root.querySelector('#b2')!.dispatchEvent(new FocusEvent('focus'))
    expect(got).toEqual(['a:b', 'a,b', 'f'])
  })
})

describe('prop() with a string default', () => {
  it('returns the raw string, no numeric coercion', async () => {
    const { inst } = mountForTest('<div></div>', { state: {} }, { props: { zip: '01234' } })
    expect(inst.prop('zip', '')).toBe('01234')
    // без строкового дефолта — прежний авто-каст
    expect(inst.prop('zip')).toBe(1234)
  })
})

describe('non-data attributes are not directives', () => {
  it('dark-text / drop-if are ignored', async () => {
    const { root, inst } = mountForTest(
      '<div><span dark-text="msg">keep</span><em drop-if="msg">stay</em></div>',
      { state: { msg: 'X' } },
    )
    await tick()
    inst.state.msg = 'Y'
    await tick()
    expect(root.querySelector('span')!.textContent).toBe('keep')
    expect(root.querySelector('em')).not.toBeNull()
  })
})

describe('row-scoped data-model / data-ref warnings', () => {
  it('warns once for data-model="item.x" inside a row', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mountForTest(
      '<ul><template data-each="items" data-key="id">' +
        '<li><input data-model="item.qty" /></li>' +
        '</template></ul>',
      { state: { items: [{ id: 1, qty: 1 }, { id: 2, qty: 2 }] } },
    )
    await tick()
    const rowWarns = warn.mock.calls.filter((c) => String(c[0]).includes('not row-scoped'))
    expect(rowWarns).toHaveLength(1) // once per template, not per row
    warn.mockRestore()
  })
})
