/**
 * tests/each.test.ts — Keyed diff and non-keyed list tests (sections 4 & 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderList as _renderList } from '../src/dom/each'
import { scanComponent } from '../src/dom/scan'
import type { InternalInstance, MicraTemplate, StateRecord } from '../src/types'

// Shim: src/dom/each.ts now accepts a pre-scanned template list.
// Tests still pass a root element — scan on call to keep test bodies stable.
function renderList(
  root: Element,
  state: StateRecord,
  rawState: StateRecord,
  inst: InternalInstance,
): void {
  _renderList(scanComponent(root).each, state, rawState, inst, null)
}

function makeInstance(methods: Record<string, unknown> = {}): InternalInstance {
  return {
    $el: document.createElement('div'),
    state: {},
    refs: {},
    render: vi.fn(),
    destroy: vi.fn(),
    prop: vi.fn(),
    fetch: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    ...methods,
  } as unknown as InternalInstance
}

// Helper: build a root with a <template data-each="items" data-key="id">
// containing a single <div data-text="item.name"> child
function makeKeyedRoot(items: StateRecord[]): { root: HTMLDivElement; state: StateRecord } {
  const root = document.createElement('div')
  const tmpl = document.createElement('template')
  tmpl.setAttribute('data-each', 'items')
  tmpl.setAttribute('data-key', 'id')
  tmpl.innerHTML = `<div data-text="item.name"></div>`
  root.appendChild(tmpl)
  const state = { items }
  return { root, state }
}

function makeNoKeyRoot(items: StateRecord[]): { root: HTMLDivElement; state: StateRecord } {
  const root = document.createElement('div')
  const tmpl = document.createElement('template')
  tmpl.setAttribute('data-each', 'items')
  tmpl.innerHTML = `<div data-text="item.name"></div>`
  root.appendChild(tmpl)
  const state = { items }
  return { root, state }
}

function render(root: HTMLDivElement, state: StateRecord) {
  const inst = makeInstance()
  renderList(root, state, state, inst)
}

function getRows(root: HTMLDivElement): HTMLElement[] {
  return Array.from(root.querySelectorAll('[data-text]')) as HTMLElement[]
}

function getTexts(root: HTMLDivElement): string[] {
  return getRows(root).map(el => el.textContent ?? '')
}

// ── 4.1 Basic keyed operations ────────────────────────────────────────────────

describe('4.1 Keyed — basic operations', () => {
  it('append — adds new node at end', () => {
    const { root, state } = makeKeyedRoot([{ id: 1, name: 'A' }])
    render(root, state)
    state.items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
    render(root, state)
    expect(getTexts(root)).toEqual(['A', 'B'])
  })

  it('prepend — inserts before existing', () => {
    const { root, state } = makeKeyedRoot([{ id: 2, name: 'B' }])
    render(root, state)
    state.items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }]
    render(root, state)
    expect(getTexts(root)).toEqual(['A', 'B'])
  })

  it('remove — removes by key', () => {
    const { root, state } = makeKeyedRoot([
      { id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' },
    ])
    render(root, state)
    state.items = [{ id: 1, name: 'A' }, { id: 3, name: 'C' }]
    render(root, state)
    expect(getTexts(root)).toEqual(['A', 'C'])
  })

  it('reorder — moves nodes without re-creating', () => {
    const items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]
    const { root, state } = makeKeyedRoot(items)
    render(root, state)
    const rowsBefore = getRows(root)

    state.items = [{ id: 3, name: 'C' }, { id: 1, name: 'A' }, { id: 2, name: 'B' }]
    render(root, state)

    expect(getTexts(root)).toEqual(['C', 'A', 'B'])
    // Same DOM nodes — just reordered (node identity preserved)
    const rowsAfter = getRows(root)
    expect(rowsAfter[0]).toBe(rowsBefore[2])
    expect(rowsAfter[1]).toBe(rowsBefore[0])
  })

  it('reverse — reverses entire list', () => {
    const { root, state } = makeKeyedRoot([
      { id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' },
    ])
    render(root, state)
    state.items = [...(state.items as StateRecord[])].reverse()
    render(root, state)
    expect(getTexts(root)).toEqual(['C', 'B', 'A'])
  })

  it('clear list — removes all nodes', () => {
    const { root, state } = makeKeyedRoot([{ id: 1, name: 'A' }])
    render(root, state)
    state.items = []
    render(root, state)
    expect(getTexts(root)).toEqual([])
  })
})

// ── 4.2 Item updates ──────────────────────────────────────────────────────────

describe('4.2 Keyed — item updates', () => {
  it('item data changes → DOM text updates', () => {
    const { root, state } = makeKeyedRoot([{ id: 1, name: 'Old' }])
    render(root, state)
    state.items = [{ id: 1, name: 'New' }]
    render(root, state)
    expect(getTexts(root)).toEqual(['New'])
  })
})

// ── 4.3 DOM stability ─────────────────────────────────────────────────────────

describe('4.3 Keyed — DOM node identity (stability)', () => {
  it('nodes with same key preserve identity across renders', () => {
    const { root, state } = makeKeyedRoot([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    render(root, state)
    const rowsBefore = getRows(root)

    // Add an item in the middle — existing nodes should not be re-created
    state.items = [{ id: 1, name: 'A' }, { id: 3, name: 'C' }, { id: 2, name: 'B' }]
    render(root, state)

    const rowsAfter = getRows(root)
    expect(rowsAfter[0]).toBe(rowsBefore[0]) // id:1 preserved
    expect(rowsAfter[2]).toBe(rowsBefore[1]) // id:2 preserved
  })

  it('event listeners are preserved on reused nodes', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.setAttribute('data-key', 'id')
    tmpl.innerHTML = `<button data-on="click:clicked" data-text="item.name"></button>`
    root.appendChild(tmpl)

    const clicked = vi.fn()
    const inst = makeInstance({ clicked })
    const state: StateRecord = { items: [{ id: 1, name: 'A' }] }

    renderList(root, state, state, inst)
    const btn = root.querySelector('button')!
    btn.click()
    expect(clicked).toHaveBeenCalledTimes(1)

    // Re-render — node reused, listener still active
    state.items = [{ id: 1, name: 'A-updated' }]
    renderList(root, state, state, inst)
    btn.click()
    expect(clicked).toHaveBeenCalledTimes(2)
  })
})

// ── 4.4 Edge cases ────────────────────────────────────────────────────────────

describe('4.4 Keyed — edge cases', () => {
  it('key = 0 (falsy but valid)', () => {
    const { root, state } = makeKeyedRoot([{ id: 0, name: 'Zero' }])
    render(root, state)
    expect(getTexts(root)).toEqual(['Zero'])
  })

  it('key = "" (empty string — valid)', () => {
    const { root, state } = makeKeyedRoot([{ id: '', name: 'Empty' }])
    render(root, state)
    expect(getTexts(root)).toEqual(['Empty'])
  })

  it('key = undefined → warns in console', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root, state } = makeKeyedRoot([{ id: undefined, name: 'No key' }])
    render(root, state)
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('duplicate key → warns once per render', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root, state } = makeKeyedRoot([
      { id: 1, name: 'A' },
      { id: 1, name: 'B' },
      { id: 1, name: 'C' },
    ])
    render(root, state)
    const dupCalls = warnSpy.mock.calls.filter(c =>
      String(c[0]).includes('duplicate'),
    )
    expect(dupCalls.length).toBe(1) // not 2 — deduped within one render
    warnSpy.mockRestore()
  })

  it('null keys are deduped — only one warn even with many nulls', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { root, state } = makeKeyedRoot([
      { id: null, name: 'A' },
      { id: null, name: 'B' },
      { id: null, name: 'C' },
    ])
    render(root, state)
    const nullWarns = warnSpy.mock.calls.filter(c =>
      String(c[0]).includes('null/undefined'),
    )
    expect(nullWarns.length).toBe(1)
    warnSpy.mockRestore()
  })
})

// ── 5. Non-keyed list ─────────────────────────────────────────────────────────

describe('5.1 Non-keyed — positional reuse', () => {
  it('reuses existing DOM nodes positionally on re-render', () => {
    const { root, state } = makeNoKeyRoot([{ id: 1, name: 'A' }])
    render(root, state)
    const firstRows = getRows(root)

    state.items = [{ id: 1, name: 'A' }]
    render(root, state)
    const secondRows = getRows(root)

    // Non-keyed reuses by position — same DOM node for index 0
    expect(secondRows[0]).toBe(firstRows[0])
  })

  it('removes tail nodes when the list shrinks; keeps head nodes', () => {
    const { root, state } = makeNoKeyRoot([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ])
    render(root, state)
    const before = getRows(root)
    expect(getTexts(root)).toHaveLength(3)

    state.items = [{ id: 1, name: 'A' }]
    render(root, state)
    const after = getRows(root)

    expect(getTexts(root)).toEqual(['A'])
    expect(after[0]).toBe(before[0])  // head node preserved
  })

  it('appends new nodes when the list grows; keeps existing nodes', () => {
    const { root, state } = makeNoKeyRoot([{ id: 1, name: 'A' }])
    render(root, state)
    const before = getRows(root)

    state.items = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }]
    render(root, state)
    const after = getRows(root)

    expect(getTexts(root)).toEqual(['A', 'B', 'C'])
    expect(after[0]).toBe(before[0])  // head node preserved across growth
  })

  it('updates content when an item at the same index changes', () => {
    const { root, state } = makeNoKeyRoot([{ id: 1, name: 'Old' }])
    render(root, state)
    const before = getRows(root)

    state.items = [{ id: 1, name: 'New' }]
    render(root, state)
    const after = getRows(root)

    expect(getTexts(root)).toEqual(['New'])
    // Same DOM node — directives re-applied in place
    expect(after[0]).toBe(before[0])
  })

  it('event listeners survive node reuse (bound once on creation)', async () => {
    const { mount } = await import('../src/core/mount')
    const { instances } = await import('../src/core/registry')
    ;(instances() as Map<HTMLElement, unknown>).clear()

    const root = document.createElement('div')
    root.innerHTML = `
      <template data-each="items">
        <button data-on="click:hit" data-text="item.name"></button>
      </template>
    `
    document.body.appendChild(root)

    const hit = vi.fn()
    const inst = mount(root, {
      state: { items: [{ name: 'A' }] },
      hit,
    })!
    const btn = root.querySelector('button')!
    btn.click()
    expect(hit).toHaveBeenCalledTimes(1)

    inst.state.items = [{ name: 'A-updated' }]
    await Promise.resolve()
    // Same node — listener still active, no double-binding either.
    expect(root.querySelector('button')).toBe(btn)
    btn.click()
    expect(hit).toHaveBeenCalledTimes(2)

    document.body.removeChild(root)
  })

  it('multi-root template rows are wrapped in <micra-each-item>', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.innerHTML = `<span data-text="item.a"></span><span data-text="item.b"></span>`
    root.appendChild(tmpl)
    const state: StateRecord = { items: [{ a: 'A1', b: 'B1' }, { a: 'A2', b: 'B2' }] }
    render(root, state)

    const wrappers = root.querySelectorAll('micra-each-item')
    expect(wrappers.length).toBe(2)
    expect(wrappers[0]!.querySelectorAll('span').length).toBe(2)
    expect(getTexts(root)).toEqual(['A1', 'B1', 'A2', 'B2'])
  })
})

// ── 4.5 data-each inside data-if (2.0) ───────────────────────────────────────

describe('4.5 data-each inside data-if survives detach/attach', () => {
  it('list re-renders after parent toggles back from data-if=false', async () => {
    const { mount } = await import('../src/core/mount')
    const { instances } = await import('../src/core/registry')
    ;(instances() as Map<HTMLElement, unknown>).clear()

    const root = document.createElement('div')
    root.innerHTML = `
      <section data-if="show">
        <template data-each="items" data-key="id">
          <p data-text="item.name"></p>
        </template>
      </section>
    `
    document.body.appendChild(root)

    const inst = mount(root, {
      state: { show: true, items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] },
    })!
    expect(root.querySelectorAll('p').length).toBe(2)

    inst.state.show = false
    await Promise.resolve()
    expect(root.querySelectorAll('p').length).toBe(0)

    inst.state.show = true
    await Promise.resolve()
    expect(root.querySelectorAll('p').length).toBe(2)

    document.body.removeChild(root)
  })
})

describe('5.2 Non-keyed — correctness', () => {
  it('preserves item order', () => {
    const { root, state } = makeNoKeyRoot([
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
      { id: 3, name: 'C' },
    ])
    render(root, state)
    expect(getTexts(root)).toEqual(['A', 'B', 'C'])
  })

  it('applies directives to each row', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.innerHTML = `<div>
      <span data-text="item.name"></span>
      <i data-if="item.active"></i>
    </div>`
    root.appendChild(tmpl)

    const state: StateRecord = {
      items: [
        { name: 'X', active: true },
        { name: 'Y', active: false },
      ],
    }
    render(root, state)

    const spans = root.querySelectorAll('span')
    expect(spans[0]?.textContent).toBe('X')
    expect(spans[1]?.textContent).toBe('Y')

    // data-if (2.0): inactive item's <i> is detached, so only one remains in DOM
    const icons = root.querySelectorAll('i')
    expect(icons.length).toBe(1)
  })
})

// ── 5.3 Row root detection (whitespace around a single root) ─────────────────
// Regression: a pretty-printed template (`<template>\n  <tr>…</tr>\n</template>`)
// has whitespace text nodes around its one element. That must still count as a
// single root — wrapping a lone <tr> in <micra-each-item> puts invalid content
// inside <tbody> and breaks `tbody > tr` selectors (found via the krausest
// js-framework-benchmark isKeyed check).

describe('5.3 Row root detection', () => {
  // Templates are built programmatically: happy-dom's HTML parser foster-
  // parents <template> out of table markup, so innerHTML on a <table> string
  // would not survive. Programmatic DOM construction bypasses the parser.
  function makeTableRoot(keyed: boolean): { root: HTMLDivElement; tbody: HTMLElement; state: StateRecord } {
    const root = document.createElement('div')
    const table = document.createElement('table')
    const tbody = document.createElement('tbody')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    if (keyed) tmpl.setAttribute('data-key', 'id')
    tmpl.innerHTML = '\n      <tr><td data-text="item.name"></td></tr>\n    '
    tbody.appendChild(tmpl)
    table.appendChild(tbody)
    root.appendChild(table)
    const state: StateRecord = { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] }
    return { root, tbody, state }
  }

  it('keyed: whitespace-padded single <tr> root is NOT wrapped', () => {
    const { root, tbody, state } = makeTableRoot(true)
    render(root, state)
    expect(root.querySelector('micra-each-item')).toBeNull()
    const rows = [...root.querySelectorAll('tr')]
    expect(rows.length).toBe(2)
    expect(rows[0]!.parentElement).toBe(tbody)
    expect(rows.map(r => r.textContent)).toEqual(['A', 'B'])
  })

  it('non-keyed: whitespace-padded single <tr> root is NOT wrapped', () => {
    const { root, tbody, state } = makeTableRoot(false)
    render(root, state)
    expect(root.querySelector('micra-each-item')).toBeNull()
    const rows = [...root.querySelectorAll('tr')]
    expect(rows.length).toBe(2)
    expect(rows[0]!.parentElement).toBe(tbody)
  })

  it('NBSP beside the element is meaningful — wrapper preserved', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.innerHTML = ' <b data-text="item.name"></b>'
    root.appendChild(tmpl)
    render(root, { items: [{ name: 'A' }] })
    // a visible non-breaking space must survive → wrapper required
    const wrapper = root.querySelector('micra-each-item')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.textContent).toContain(' ')
  })

  it('comment beside the element does NOT force a wrapper (documented: dropped)', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.innerHTML = '<li data-text="item.name"></li><!-- marker -->'
    root.appendChild(tmpl)
    render(root, { items: [{ name: 'A' }] })
    expect(root.querySelector('micra-each-item')).toBeNull()
    expect(root.querySelector('li')!.textContent).toBe('A')
  })

  it('meaningful text beside an element still counts as multi-root', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.innerHTML = '\n  prefix <b data-text="item.name"></b>\n'
    root.appendChild(tmpl)
    render(root, { items: [{ name: 'A' }] })
    // the visible "prefix" text must survive — wrapper required
    const wrapper = root.querySelector('micra-each-item')
    expect(wrapper).not.toBeNull()
    expect(wrapper!.textContent).toContain('prefix')
    expect(wrapper!.textContent).toContain('A')
  })
})

// ── 6. Nested data-each (a list inside each row) ──────────────────────────────

describe('6. Nested data-each', () => {
  function makeNestedRoot(groups: StateRecord[]) {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'groups')
    tmpl.setAttribute('data-key', 'id')
    tmpl.innerHTML =
      `<section><h3 data-text="item.name"></h3>` +
      `<template data-each="item.children" data-key="id">` +
      `<span class="child" data-text="item.label"></span>` +
      `</template></section>`
    root.appendChild(tmpl)
    return { root, state: { groups } as StateRecord }
  }

  const childTexts = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('.child')).map(e => e.textContent)

  it('renders the inner list for every outer row', () => {
    const { root, state } = makeNestedRoot([
      { id: 1, name: 'A', children: [{ id: 11, label: 'a1' }, { id: 12, label: 'a2' }] },
      { id: 2, name: 'B', children: [{ id: 21, label: 'b1' }] },
    ])
    render(root, state)
    expect(Array.from(root.querySelectorAll('h3')).map(e => e.textContent)).toEqual(['A', 'B'])
    expect(childTexts(root)).toEqual(['a1', 'a2', 'b1'])
  })

  it('updates the inner list when an outer row gains a child', () => {
    const { root, state } = makeNestedRoot([
      { id: 1, name: 'A', children: [{ id: 11, label: 'a1' }] },
    ])
    // Scan the top-level templates ONCE and reuse across renders — this mirrors
    // production (mount caches the component scan; the nested template lives in
    // the row's own __micraScan, not the top-level list).
    const inst = makeInstance()
    const top = scanComponent(root).each
    _renderList(top, state, state, inst, null)
    expect(childTexts(root)).toEqual(['a1'])
    state.groups = [{ id: 1, name: 'A', children: [{ id: 11, label: 'a1' }, { id: 13, label: 'a3' }] }]
    _renderList(top, state, state, inst, null)
    expect(childTexts(root)).toEqual(['a1', 'a3'])
  })
})
