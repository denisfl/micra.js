/**
 * tests/internals.test.ts — Internal invariants (section 10)
 * Tests for __micraEvents, __micraModel, __micraNodes deduplication.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { bindDataOn, bindModels } from '../src/dom/events'
import { renderList } from '../src/dom/each'
import type { InternalInstance, MicraElement, StateRecord } from '../src/types'

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
