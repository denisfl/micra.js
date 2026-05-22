/**
 * tests/each.test.ts — Keyed diff and non-keyed list tests (sections 4 & 5)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderList } from '../src/dom/each'
import type { InternalInstance, MicraTemplate, StateRecord } from '../src/types'

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
})

// ── 5. Non-keyed list ─────────────────────────────────────────────────────────

describe('5.1 Non-keyed — full re-render', () => {
  it('creates new DOM nodes on every render', () => {
    const { root, state } = makeNoKeyRoot([{ id: 1, name: 'A' }])
    render(root, state)
    const firstRows = getRows(root)

    state.items = [{ id: 1, name: 'A' }]
    render(root, state)
    const secondRows = getRows(root)

    // Non-keyed: nodes are always re-created
    expect(secondRows[0]).not.toBe(firstRows[0])
  })

  it('removes old nodes before inserting new ones', () => {
    const { root, state } = makeNoKeyRoot([{ id: 1, name: 'A' }, { id: 2, name: 'B' }])
    render(root, state)
    expect(getTexts(root)).toHaveLength(2)

    state.items = [{ id: 3, name: 'C' }]
    render(root, state)
    expect(getTexts(root)).toHaveLength(1)
    expect(getTexts(root)[0]).toBe('C')
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

    const icons = root.querySelectorAll('i')
    expect((icons[0] as HTMLElement).style.display).toBe('')
    expect((icons[1] as HTMLElement).style.display).toBe('none')
  })
})
