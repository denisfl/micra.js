/**
 * tests/element.test.ts — <micra-NAME> custom elements registered by define().
 *
 * The element mounts on connect and destroys on a real removal, but survives a
 * move (keyed reorder) and a data-if detach. Custom element registrations are
 * global and can't be undone, so each test uses its own component name.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { define, registry, instances } from '../src/core/registry'

beforeEach(() => {
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const flush = () => new Promise<void>((r) => setTimeout(r))
const inst = (el: Element) =>
  instances().get(el as HTMLElement) as unknown as { state: Record<string, unknown> } | undefined

let n = 0
const name = (base: string) => `${base}${++n}`

describe('<micra-NAME>', () => {
  it('mounts an element already in the DOM when the component is defined', async () => {
    const c = name('count')
    document.body.innerHTML = `<micra-${c}><span data-text="count"></span></micra-${c}>`
    define(c, { state: { count: 3 } })
    await flush()
    const el = document.querySelector(`micra-${c}`)!
    expect(el.getAttribute('data-component')).toBe(c)
    expect(el.querySelector('span')!.textContent).toBe('3')
  })

  it('mounts markup inserted later, without start()', async () => {
    const c = name('late')
    define(c, { state: { label: 'hi' } })
    document.body.innerHTML = `<micra-${c}><b data-text="label"></b></micra-${c}>`
    await flush()
    expect(document.querySelector('b')!.textContent).toBe('hi')
  })

  it('reads data-* props', async () => {
    const c = name('props')
    define(c, {
      state: { n: 0 },
      onCreate() { this.state.n = this.prop('start', 0) },
    })
    document.body.innerHTML = `<micra-${c} data-start="7"><i data-text="n"></i></micra-${c}>`
    await flush()
    expect(document.querySelector('i')!.textContent).toBe('7')
  })

  it('destroys on removal and runs onDestroy', async () => {
    const c = name('gone')
    let destroyed = 0
    define(c, { state: {}, onDestroy() { destroyed++ } })
    document.body.innerHTML = `<micra-${c}></micra-${c}>`
    await flush()
    const el = document.querySelector(`micra-${c}`)!
    expect(inst(el)).toBeTruthy()
    el.remove()
    await flush()
    expect(destroyed).toBe(1)
    expect(inst(el)).toBeUndefined()
  })

  it('survives a move within the same task (state kept)', async () => {
    const c = name('move')
    define(c, { state: { v: 0 } })
    document.body.innerHTML = `<div id="a"><micra-${c}></micra-${c}></div><div id="b"></div>`
    await flush()
    const el = document.querySelector(`micra-${c}`)!
    inst(el)!.state.v = 42
    document.getElementById('b')!.append(el) // remove + insert in one task
    await flush()
    expect(inst(el)?.state.v).toBe(42)
  })

  it('survives a data-if detach and re-insert', async () => {
    const c = name('inner')
    define(c, { state: { v: 0 } })
    define(name('outer'), { state: {} }) // keep counter moving; not used
    const outer = name('host')
    define(outer, { state: { show: true } })
    document.body.innerHTML =
      `<micra-${outer}><div data-if="show"><micra-${c}></micra-${c}></div></micra-${outer}>`
    await flush()
    const child = document.querySelector(`micra-${c}`)!
    inst(child)!.state.v = 5
    const host = inst(document.querySelector(`micra-${outer}`)!)!
    host.state.show = false
    await flush()
    expect(child.isConnected).toBe(false)
    expect(inst(child)?.state.v).toBe(5)
    host.state.show = true
    await flush()
    expect(child.isConnected).toBe(true)
    expect(inst(child)?.state.v).toBe(5)
  })

  it('keeps a nested element out of the parent scope', async () => {
    const parent = name('parent')
    const child = name('child')
    define(child, { state: { who: 'child' } })
    define(parent, { state: { who: 'parent' } })
    document.body.innerHTML =
      `<micra-${parent}><p id="p" data-text="who"></p>` +
      `<micra-${child}><p id="c" data-text="who"></p></micra-${child}></micra-${parent}>`
    await flush()
    expect(document.getElementById('p')!.textContent).toBe('parent')
    expect(document.getElementById('c')!.textContent).toBe('child')
  })

  it('inside a data-each row, the parent leaves the child element alone', async () => {
    const child = name('rowchild')
    const list = name('rowlist')
    define(child, { state: { n: 0 }, inc() { this.state.n++ } })
    define(list, { state: { items: [{ id: 'a' }, { id: 'b' }] } })
    document.body.innerHTML =
      `<micra-${list}><template data-each="items" data-key="id">` +
      `<div class="row"><b data-text="item.id"></b>` +
      `<micra-${child}><button @click="inc"><i data-text="n"></i></button></micra-${child}>` +
      `</div></template></micra-${list}>`
    await flush()
    const rows = [...document.querySelectorAll('.row')]
    expect(rows.map((r) => r.querySelector('b')!.textContent)).toEqual(['a', 'b'])
    ;(rows[0]!.querySelector('button') as HTMLButtonElement).click()
    await flush()
    expect(rows[0]!.querySelector('i')!.textContent).toBe('1')
    expect(rows[1]!.querySelector('i')!.textContent).toBe('0')
  })

  it('a repeated define() applies to elements mounted afterwards', async () => {
    const c = name('redefine')
    define(c, { state: { v: 'old' } })
    define(c, { state: { v: 'new' } })
    document.body.innerHTML = `<micra-${c}><u data-text="v"></u></micra-${c}>`
    await flush()
    expect(document.querySelector('u')!.textContent).toBe('new')
  })

  it('skips names that cannot be tags', () => {
    define('camelCase', { state: {} })
    expect(customElements.get('micra-camelCase'.toLowerCase())).toBeUndefined()
    expect(registry().has('camelCase')).toBe(true)
  })
})
