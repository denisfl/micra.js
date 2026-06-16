/**
 * tests/internals.test.ts — Internal invariants (section 10)
 * Tests for __micraEvents, __micraModel, __micraNodes deduplication.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bindDataOn as _bindDataOn, bindModels as _bindModels, bindAtEvents as _bindAtEventsRaw } from '../src/dom/events'
import { renderList as _renderList } from '../src/dom/each'
import { scanComponent } from '../src/dom/scan'
import type { InternalInstance, MicraElement, StateRecord } from '../src/types'

// ── Test shims ────────────────────────────────────────────────────────────────
// In src/, these now accept pre-scanned arrays from scan.ts. These tests
// were written against the older (root, instance) signature — the shims
// scan-on-call so existing tests keep their old shape.

function bindDataOn(root: Element, inst: InternalInstance): void {
  _bindDataOn(scanComponent(root).on, inst)
}
function bindModels(root: Element, inst: InternalInstance): void {
  _bindModels(scanComponent(root).model, inst)
}
function bindAtEvents(root: Element, inst: InternalInstance): void {
  _bindAtEventsRaw(scanComponent(root).atEvents, inst)
}
function renderList(root: Element, state: StateRecord, rawState: StateRecord, inst: InternalInstance): void {
  _renderList(scanComponent(root).each, state, rawState, inst, null)
}

function makeInstance(extra: Record<string, unknown> = {}): InternalInstance {
  return {
    $el: document.createElement('div'),
    state: {} as StateRecord,
    refs: {},
    render: vi.fn(),
    destroy: vi.fn(),
    prop: vi.fn(),
    fetch: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    ...extra,
  } as unknown as InternalInstance
}

// ── 10.1 __micraEvents ────────────────────────────────────────────────────────

describe('10.1 __micraEvents — no duplicate listeners', () => {
  it('calling bindDataOn twice does not duplicate listeners', () => {
    const clicked = vi.fn()
    const inst = makeInstance({ clicked })
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.setAttribute('data-on', 'click:clicked')
    root.appendChild(btn)

    bindDataOn(root, inst)
    bindDataOn(root, inst)  // second call — should be no-op for already-bound elements

    btn.click()
    expect(clicked).toHaveBeenCalledTimes(1) // not 2
  })

  it('__micraEvents flag is set after first bind', () => {
    const inst = makeInstance({ noop: vi.fn() })
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.setAttribute('data-on', 'click:noop')
    root.appendChild(btn)

    bindDataOn(root, inst)
    expect((btn as MicraElement).__micraEvents).toBe(true)
  })
})

// ── 10.1.bis data-model coercion ──────────────────────────────────────────────

describe('10.1.bis data-model — type coercion', () => {
  it('input[type=number] writes a number to state, not a string', () => {
    const inst = makeInstance()
    inst.state = { age: 0 } as StateRecord
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'number'
    input.setAttribute('data-model', 'age')
    root.appendChild(input)

    bindModels(root, inst)
    input.value = '42'
    input.dispatchEvent(new Event('input'))

    expect((inst.state as StateRecord)['age']).toBe(42)
    expect(typeof (inst.state as StateRecord)['age']).toBe('number')
  })

  it('input[type=number] with empty value writes null', () => {
    const inst = makeInstance()
    inst.state = { age: 1 } as StateRecord
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'number'
    input.setAttribute('data-model', 'age')
    root.appendChild(input)

    bindModels(root, inst)
    input.value = ''
    input.dispatchEvent(new Event('input'))

    expect((inst.state as StateRecord)['age']).toBeNull()
  })

  it('input[type=checkbox] writes a boolean', () => {
    const inst = makeInstance()
    inst.state = { agree: false } as StateRecord
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('data-model', 'agree')
    root.appendChild(input)

    bindModels(root, inst)
    input.checked = true
    input.dispatchEvent(new Event('input'))

    expect((inst.state as StateRecord)['agree']).toBe(true)
  })

  it('input[type=text] (default) writes a string', () => {
    const inst = makeInstance()
    inst.state = { q: '' } as StateRecord
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-model', 'q')
    root.appendChild(input)

    bindModels(root, inst)
    input.value = '42'
    input.dispatchEvent(new Event('input'))

    expect((inst.state as StateRecord)['q']).toBe('42')
    expect(typeof (inst.state as StateRecord)['q']).toBe('string')
  })
})

// ── 10.2 __micraModel ─────────────────────────────────────────────────────────

describe('10.2 __micraModel — no duplicate listeners', () => {
  it('bindModels twice does not duplicate input listeners', () => {
    const inst = makeInstance()
    inst.state = { text: '' } as StateRecord
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-model', 'text')
    root.appendChild(input)

    bindModels(root, inst)
    bindModels(root, inst)

    input.value = 'hello'
    input.dispatchEvent(new Event('input'))

    // Despite two bindModels calls, state should only have 'hello' once
    expect((inst.state as StateRecord)['text']).toBe('hello')
  })
})

// ── 10.1.ter @event per-element binding ───────────────────────────────────────

describe('10.1.ter @event — per-element rebind on new DOM', () => {
  it('binds @click on root element itself', async () => {
    const handler = vi.fn()
    const inst = makeInstance({ handle: handler })
    const root = document.createElement('button')
    root.setAttribute('@click', 'handle')

    bindAtEvents(root, inst)
    root.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('second bindAtEvents on same root does not duplicate bindings', async () => {
    const handler = vi.fn()
    const inst = makeInstance({ handle: handler })
    const root = document.createElement('div')
    const btn = document.createElement('button')
    btn.setAttribute('@click', 'handle')
    root.appendChild(btn)

    bindAtEvents(root, inst)
    bindAtEvents(root, inst)
    btn.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('new element added after first bind gets bound on next call', async () => {
    const handler = vi.fn()
    const inst = makeInstance({ handle: handler })
    const root = document.createElement('div')

    bindAtEvents(root, inst) // no children yet

    const btn = document.createElement('button')
    btn.setAttribute('@click', 'handle')
    root.appendChild(btn)

    bindAtEvents(root, inst) // pick up the new element
    btn.click()
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does NOT bind @event inside nested data-component subtree', async () => {
    const parentHandler = vi.fn()
    const parentInst = makeInstance({ handle: parentHandler })

    const root = document.createElement('div')
    // Nested child component — parent must NOT bind its @click
    const child = document.createElement('div')
    child.setAttribute('data-component', 'child')
    const btn = document.createElement('button')
    btn.setAttribute('@click', 'handle')
    child.appendChild(btn)
    root.appendChild(child)

    bindAtEvents(root, parentInst)
    btn.click()
    // Parent must not have been notified — that button belongs to the child component.
    expect(parentHandler).not.toHaveBeenCalled()
  })
})

// ── 10.3 __micraNodes ─────────────────────────────────────────────────────────

describe('10.3 __micraNodes map correctness', () => {
  it('keyMap correctly tracks nodes by key', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.setAttribute('data-key', 'id')
    tmpl.innerHTML = '<div data-text="item.name"></div>'
    root.appendChild(tmpl)

    const inst = makeInstance()
    const state: StateRecord = { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] }
    renderList(root, state, state, inst)

    const micraTemplate = tmpl as unknown as { __micraNodes: Map<unknown, unknown> }
    expect(micraTemplate.__micraNodes.size).toBe(2)
    expect(micraTemplate.__micraNodes.has(1)).toBe(true)
    expect(micraTemplate.__micraNodes.has(2)).toBe(true)
  })

  it('keyMap removes stale keys on render', () => {
    const root = document.createElement('div')
    const tmpl = document.createElement('template')
    tmpl.setAttribute('data-each', 'items')
    tmpl.setAttribute('data-key', 'id')
    tmpl.innerHTML = '<div></div>'
    root.appendChild(tmpl)

    const inst = makeInstance()
    const state: StateRecord = { items: [{ id: 1 }, { id: 2 }, { id: 3 }] }
    renderList(root, state, state, inst)

    state.items = [{ id: 1 }, { id: 3 }]
    renderList(root, state, state, inst)

    const micraTemplate = tmpl as unknown as { __micraNodes: Map<unknown, unknown> }
    expect(micraTemplate.__micraNodes.size).toBe(2)
    expect(micraTemplate.__micraNodes.has(2)).toBe(false) // removed
  })
})
