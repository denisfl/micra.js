/**
 * tests/directives.test.ts — DOM directive tests (section 3)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyDirectives } from '../src/dom/directives'
import type { InternalInstance, StateRecord } from '../src/types'

// Helper: create a minimal InternalInstance stub
function makeInstance(state: StateRecord = {}): InternalInstance {
  return {
    $el: document.createElement('div'),
    state,
    refs: {},
    render: vi.fn(),
    destroy: vi.fn(),
    prop: vi.fn(),
    fetch: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
  } as unknown as InternalInstance
}

// Helper: apply directives to a root element
function apply(root: Element, state: StateRecord) {
  const inst = makeInstance(state)
  applyDirectives(root, state, state, inst)
}

// ── 3.1 data-text ─────────────────────────────────────────────────────────────

describe('3.1 data-text', () => {
  it('sets textContent from state', () => {
    const el = document.createElement('div')
    el.setAttribute('data-text', 'name')
    apply(el, { name: 'Alice' })
    expect(el.textContent).toBe('Alice')
  })

  it('updates textContent on re-apply', () => {
    const el = document.createElement('div')
    el.setAttribute('data-text', 'count')
    apply(el, { count: 1 })
    expect(el.textContent).toBe('1')
    apply(el, { count: 99 })
    expect(el.textContent).toBe('99')
  })

  it('null/undefined → empty string', () => {
    const el = document.createElement('div')
    el.setAttribute('data-text', 'val')
    apply(el, { val: null })
    expect(el.textContent).toBe('')
    apply(el, { val: undefined })
    expect(el.textContent).toBe('')
  })

  it('nested child gets directive applied', () => {
    const root = document.createElement('div')
    const child = document.createElement('span')
    child.setAttribute('data-text', 'msg')
    root.appendChild(child)
    apply(root, { msg: 'hello' })
    expect(child.textContent).toBe('hello')
  })
})

// ── 3.2 data-html ─────────────────────────────────────────────────────────────

describe('3.2 data-html', () => {
  it('sets innerHTML', () => {
    const el = document.createElement('div')
    el.setAttribute('data-html', 'content')
    apply(el, { content: '<b>bold</b>' })
    expect(el.innerHTML).toBe('<b>bold</b>')
  })

  it('updates innerHTML', () => {
    const el = document.createElement('div')
    el.setAttribute('data-html', 'content')
    apply(el, { content: '<b>A</b>' })
    apply(el, { content: '<i>B</i>' })
    expect(el.innerHTML).toBe('<i>B</i>')
  })

  it('null/undefined → empty innerHTML', () => {
    const el = document.createElement('div')
    el.setAttribute('data-html', 'content')
    apply(el, { content: null })
    expect(el.innerHTML).toBe('')
  })
})

// ── 3.3 data-if / data-show ───────────────────────────────────────────────────

describe('3.3 data-if / data-show', () => {
  it('data-if hides when falsy', () => {
    const el = document.createElement('div')
    el.setAttribute('data-if', 'show')
    apply(el, { show: false })
    expect((el as HTMLElement).style.display).toBe('none')
  })

  it('data-if shows when truthy', () => {
    const el = document.createElement('div')
    el.setAttribute('data-if', 'show')
    apply(el, { show: true })
    expect((el as HTMLElement).style.display).toBe('')
  })

  it('data-if toggles true→false→true', () => {
    const el = document.createElement('div')
    el.setAttribute('data-if', 'visible')
    apply(el, { visible: true })
    expect((el as HTMLElement).style.display).toBe('')
    apply(el, { visible: false })
    expect((el as HTMLElement).style.display).toBe('none')
    apply(el, { visible: true })
    expect((el as HTMLElement).style.display).toBe('')
  })

  it('data-if works with expressions', () => {
    const el = document.createElement('div')
    el.setAttribute('data-if', 'count > 0')
    apply(el, { count: 0 })
    expect((el as HTMLElement).style.display).toBe('none')
    apply(el, { count: 5 })
    expect((el as HTMLElement).style.display).toBe('')
  })

  it('data-show alias behaves identically to data-if', () => {
    const el = document.createElement('div')
    el.setAttribute('data-show', 'active')
    apply(el, { active: false })
    expect((el as HTMLElement).style.display).toBe('none')
    apply(el, { active: true })
    expect((el as HTMLElement).style.display).toBe('')
  })
})

// ── 3.4 data-bind ─────────────────────────────────────────────────────────────

describe('3.4 data-bind', () => {
  it('class attribute', () => {
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'class:klass')
    apply(el, { klass: 'foo bar' })
    expect(el.className).toBe('foo bar')
  })

  it('style as object', () => {
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'style:styles')
    apply(el, { styles: { color: 'red', fontSize: '16px' } })
    expect((el as HTMLElement).style.color).toBe('red')
    expect((el as HTMLElement).style.fontSize).toBe('16px')
  })

  it('style as string', () => {
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'style:s')
    apply(el, { s: 'color: blue;' })
    expect(el.getAttribute('style')).toBe('color: blue;')
  })

  it('boolean attribute — adds when true', () => {
    const el = document.createElement('button')
    el.setAttribute('data-bind', 'disabled:isDisabled')
    apply(el, { isDisabled: true })
    expect(el.hasAttribute('disabled')).toBe(true)
  })

  it('boolean attribute — removes when false', () => {
    const el = document.createElement('button')
    el.setAttribute('disabled', '')
    el.setAttribute('data-bind', 'disabled:isDisabled')
    apply(el, { isDisabled: false })
    expect(el.hasAttribute('disabled')).toBe(false)
  })

  it('regular attribute', () => {
    const el = document.createElement('a')
    el.setAttribute('data-bind', 'href:url')
    apply(el, { url: 'https://example.com' })
    expect(el.getAttribute('href')).toBe('https://example.com')
  })

  it('null value removes attribute', () => {
    const el = document.createElement('a')
    el.setAttribute('href', 'https://old.com')
    el.setAttribute('data-bind', 'href:url')
    apply(el, { url: null })
    expect(el.hasAttribute('href')).toBe(false)
  })
})

// ── 3.5 data-model ────────────────────────────────────────────────────────────

describe('3.5 data-model', () => {
  it('syncs input value from state', () => {
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-model', 'search')
    root.appendChild(input)
    apply(root, { search: 'hello' })
    expect(input.value).toBe('hello')
  })

  it('null/undefined → empty string in input', () => {
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-model', 'search')
    root.appendChild(input)
    apply(root, { search: null })
    expect(input.value).toBe('')
  })

  it('programmatic clear syncs even when input is focused', () => {
    const root = document.createElement('div')
    const input = document.createElement('input')
    input.setAttribute('data-model', 'q')
    root.appendChild(input)
    document.body.appendChild(root)

    apply(root, { q: 'task' })
    expect(input.value).toBe('task')

    input.focus()
    expect(document.activeElement).toBe(input)

    // Simulate the docs each-demo: code resets state.q to '' while input has focus.
    apply(root, { q: '' })
    expect(input.value).toBe('')
  })
})

// ── 3.5.bis validateDirectives — class binding conflict ──────────────────────

describe('3.5.bis class conflict warning', () => {
  it('warns when data-bind class: and data-class are on the same element', async () => {
    const { validateDirectives } = await import('../src/dom/directives')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'class:cls')
    el.setAttribute('data-class', 'active:isActive')
    validateDirectives(el)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('data-class'))
    warnSpy.mockRestore()
  })

  it('does NOT warn when only data-bind has class', async () => {
    const { validateDirectives } = await import('../src/dom/directives')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'class:cls')
    validateDirectives(el)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does NOT warn for unrelated data-bind keys + data-class', async () => {
    const { validateDirectives } = await import('../src/dom/directives')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const el = document.createElement('div')
    el.setAttribute('data-bind', 'href:url')
    el.setAttribute('data-class', 'active:isActive')
    validateDirectives(el)
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ── 3.6 data-class ────────────────────────────────────────────────────────────

describe('3.6 data-class', () => {
  it('toggles classes additively', () => {
    const el = document.createElement('div')
    el.className = 'base'
    el.setAttribute('data-class', 'active:isActive')
    apply(el, { isActive: true })
    expect(el.classList.contains('base')).toBe(true)  // preserved
    expect(el.classList.contains('active')).toBe(true)
  })

  it('removes class when false', () => {
    const el = document.createElement('div')
    el.className = 'base active'
    el.setAttribute('data-class', 'active:isActive')
    apply(el, { isActive: false })
    expect(el.classList.contains('base')).toBe(true)
    expect(el.classList.contains('active')).toBe(false)
  })

  it('toggles multiple classes independently', () => {
    const el = document.createElement('div')
    el.setAttribute('data-class', 'active:a, disabled:d')
    apply(el, { a: true, d: false })
    expect(el.classList.contains('active')).toBe(true)
    expect(el.classList.contains('disabled')).toBe(false)
    apply(el, { a: false, d: true })
    expect(el.classList.contains('active')).toBe(false)
    expect(el.classList.contains('disabled')).toBe(true)
  })
})
