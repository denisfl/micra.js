/**
 * tests/element.test.ts — <micra-NAME> custom elements registered by define().
 *
 * The element mounts on connect and destroys on a real removal, but survives a
 * move (keyed reorder) and a data-if detach. Custom element registrations are
 * global and can't be undone, so each test uses its own component name.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { define, registry, instances } from '../src/core/registry'
import { destroy } from '../src/core/destroy'

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

  it('reserves each-item: the name gets no tag and row wrappers stay plain', async () => {
    define('each-item', { state: {} })
    expect(customElements.get('micra-each-item')).toBeUndefined()
    const list = name('wraplist')
    define(list, { state: { items: [{ id: 'a' }] } })
    document.body.innerHTML =
      `<micra-${list}><template data-each="items" data-key="id">` +
      `<u data-text="item.id"></u><s data-text="item.id"></s></template></micra-${list}>`
    await flush()
    expect(document.querySelector('micra-each-item')!.hasAttribute('data-component')).toBe(false)
    expect(document.querySelector('u')!.textContent).toBe('a')
  })
})

describe('<micra-NAME> as the root of a data-each row', () => {
  const setup = (rootAttrs = '') => {
    const child = name('cardrow')
    const list = name('cardlist')
    const made: Array<string | undefined> = []
    define(child, {
      state: { n: 0, who: 'child' },
      inc() { this.state.n++ },
      add(by: number) { this.state.n += by },
      onCreate() { made.push(this.prop('id', '')) },
    })
    define(list, { state: { who: 'parent', items: [{ id: 'a' }, { id: 'b' }] } })
    document.body.innerHTML =
      `<micra-${list}><template data-each="items" data-key="id">` +
      `<micra-${child} ${rootAttrs}><button @click="inc"><i data-text="n"></i></button>` +
      `<em @click="add(5)"></em><b data-text="who"></b></micra-${child}>` +
      `</template></micra-${list}>`
    return { child, list, made }
  }

  it('the child owns the directives and events inside it', async () => {
    setup()
    await flush()
    expect(document.querySelector('b')!.textContent).toBe('child')
    document.querySelector('button')!.click()
    await flush()
    const counts = () => [...document.querySelectorAll('i')].map((i) => i.textContent)
    expect(counts()).toEqual(['1', '0'])
    document.querySelector<HTMLElement>('em')!.click()
    await flush()
    expect(counts()).toEqual(['6', '0'])
  })

  it('the parent still owns the attributes on the root', async () => {
    const { made } = setup('data-bind="data-id:item.id"')
    await flush()
    expect(made).toEqual(['a', 'b'])
    const root = document.querySelector('b')!.parentElement!
    expect(root.getAttribute('data-id')).toBe('a')
  })

  it('a reorder keeps child state, a removal destroys the child', async () => {
    const { child, list } = setup()
    await flush()
    const host = inst(document.querySelector(`micra-${list}`)!)!
    const [a, b] = [...document.querySelectorAll(`micra-${child}`)]
    inst(a!)!.state.n = 7
    host.state.items = [{ id: 'b' }, { id: 'a' }]
    await flush()
    expect(a!.previousElementSibling).toBe(b)
    expect(inst(a!)?.state.n).toBe(7)
    host.state.items = [{ id: 'b' }]
    await flush()
    expect(inst(a!)).toBeUndefined()
    expect(inst(b!)).toBeTruthy()
  })
})

describe('call handlers inside a nested component', () => {
  it('run against the child, not the row the child sits in', async () => {
    const child = name('rowcall')
    const list = name('rowcalllist')
    define(child, { state: { n: 0 }, inc(by: number) { this.state.n += by } })
    define(list, { state: { items: [{ id: 'a' }] } })
    document.body.innerHTML =
      `<micra-${list}><template data-each="items" data-key="id"><div>` +
      `<micra-${child}><button @click="inc(2)"><i data-text="n"></i></button></micra-${child}>` +
      `</div></template></micra-${list}>`
    await flush()
    document.querySelector('button')!.click()
    await flush()
    expect(document.querySelector('i')!.textContent).toBe('2')
  })
})

describe('destroying a parent', () => {
  const nested = () => {
    const child = name('kid')
    const host = name('kidhost')
    define(child, {
      state: { items: [{ id: 'a' }], open: false, n: 0 },
      inc() { this.state.n++ },
    })
    define(host, { state: {} })
    document.body.innerHTML =
      `<micra-${host}><micra-${child}><p data-if="open">x</p>` +
      `<button @click="inc"></button>` +
      `<template data-each="items" data-key="id"><u data-text="item.id"></u></template>` +
      `</micra-${child}></micra-${host}>`
    return { child, host }
  }

  it('a nested tree can be removed and re-inserted later', async () => {
    const { child, host } = nested()
    await flush()
    const h = document.querySelector(`micra-${host}`)!
    const k = document.querySelector(`micra-${child}`)!
    h.remove()
    await flush()
    expect(k.querySelectorAll('u').length).toBe(0)
    expect(k.querySelector('p')).toBeTruthy()
    document.body.append(h)
    await flush()
    expect([...k.querySelectorAll('u')].map((u) => u.textContent)).toEqual(['a'])
    inst(k)!.state.open = true
    await flush()
    expect(k.querySelector('p')).toBeTruthy()
  })

  it('instance.destroy() leaves a live child bound exactly once', async () => {
    const { child, host } = nested()
    await flush()
    const k = document.querySelector(`micra-${child}`)!
    const hostInst = instances().get(document.querySelector<HTMLElement>(`micra-${host}`)!)!
    hostInst.destroy()
    inst(k)!.state.open = true // re-render: must not rebind the child's listeners
    await flush()
    k.querySelector('button')!.click()
    await flush()
    expect(inst(k)!.state.n).toBe(1)
  })

  const hidden = () => {
    const child = name('hiddenkid')
    const host = name('hiddenhost')
    let destroyed = 0
    define(child, { state: {}, onDestroy() { destroyed++ } })
    define(host, { state: { show: true, items: [{ id: 'a', show: true }] } })
    return { child, host, destroyed: () => destroyed }
  }

  it('destroys a child held out of the DOM by data-if', async () => {
    const { child, host, destroyed } = hidden()
    document.body.innerHTML =
      `<micra-${host}><div data-if="show"><micra-${child}></micra-${child}></div></micra-${host}>`
    await flush()
    const h = document.querySelector(`micra-${host}`)!
    const k = document.querySelector(`micra-${child}`)!
    inst(h)!.state.show = false
    await flush()
    expect(destroyed()).toBe(0)
    h.remove()
    await flush()
    expect(destroyed()).toBe(1)
    expect(inst(k)).toBeUndefined()
  })

  it('Micra.destroy() reaches a child held out of the DOM by data-if', async () => {
    const { child, host, destroyed } = hidden()
    document.body.innerHTML =
      `<micra-${host}><div data-if="show"><micra-${child}></micra-${child}></div></micra-${host}>`
    await flush()
    const h = document.querySelector<HTMLElement>(`micra-${host}`)!
    inst(h)!.state.show = false
    await flush()
    destroy(h)
    expect(destroyed()).toBe(1)
  })

  it('removing a row destroys a child its data-if holds out of the DOM', async () => {
    const { child, host, destroyed } = hidden()
    document.body.innerHTML =
      `<micra-${host}><template data-each="items" data-key="id"><div>` +
      `<section data-if="item.show"><micra-${child}></micra-${child}></section>` +
      `</div></template></micra-${host}>`
    await flush()
    const h = inst(document.querySelector(`micra-${host}`)!)!
    h.state.items = [{ id: 'a', show: false }]
    await flush()
    expect(destroyed()).toBe(0)
    h.state.items = []
    await flush()
    expect(destroyed()).toBe(1)
  })
})

describe('unregistered <micra-*> tags', () => {
  it('warns once: the parent skips the tag and nothing else will render it', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = name('warnhost')
    const tag = `micra-${name('missing')}`
    define(p, { state: { t: 'hi' } })
    document.body.innerHTML = `<micra-${p}><${tag}><i data-text="t"></i></${tag}><${tag}></${tag}></micra-${p}>`
    await flush()
    const hits = spy.mock.calls.filter(([m]) => String(m).includes(`<${tag}>`))
    spy.mockRestore()
    expect(hits.length).toBe(1)
    expect(document.querySelector('i')!.textContent).toBe('')
  })

  it('does not warn for a registered tag', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = name('quiethost')
    const c = name('quietkid')
    define(c, { state: {} })
    define(p, { state: {} })
    document.body.innerHTML = `<micra-${p}><micra-${c}></micra-${c}></micra-${p}>`
    await flush()
    const hits = spy.mock.calls.filter(([m]) => String(m).includes('not defined'))
    spy.mockRestore()
    expect(hits.length).toBe(0)
  })
})

describe('snapshots (Turbo cache, htmx history)', () => {
  it('Micra.destroy() before cloning gives a clone that mounts cleanly', async () => {
    const c = name('snap')
    define(c, { state: { items: [{ id: 'a' }, { id: 'b' }], open: false } })
    document.body.innerHTML =
      `<micra-${c}><p data-if="open">x</p>` +
      `<template data-each="items" data-key="id"><u data-text="item.id"></u></template></micra-${c}>`
    await flush()
    destroy()
    const clone = document.body.firstElementChild!.cloneNode(true) as HTMLElement
    document.body.innerHTML = ''
    await flush()
    document.body.append(clone)
    await flush()
    expect(clone.querySelectorAll('u').length).toBe(2)
    inst(clone)!.state.open = true
    await flush()
    expect(clone.querySelector('p')).toBeTruthy()
  })
})
