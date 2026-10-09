/**
 * tests/pairs.test.ts — `name:expr` pair lists in data-bind / data-class / data-on.
 *
 * Pairs split on top-level commas only: a comma inside (), [], {} or quotes
 * belongs to the expression. A quoted key may contain colons, so Tailwind
 * variant classes work in data-class: `'md:hidden': collapsed`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const tick = () => Promise.resolve()

describe('pair lists with commas inside the expression', () => {
  it('data-bind: a method call with two args is one pair', async () => {
    const { root } = mountForTest(
      `<div><span data-bind="title:label(a, b), href:url"></span></div>`,
      {
        state: { a: 'x', b: 'y', url: '/z' },
        label(a: string, b: string) { return a + '-' + b },
      },
    )
    await tick()
    const span = root.querySelector('span')!
    expect(span.getAttribute('title')).toBe('x-y')
    expect(span.getAttribute('href')).toBe('/z')
  })

  it('data-class: a call with two args drives one class', async () => {
    const { root } = mountForTest(
      `<div><span data-class="on:both(a, b), off:!a"></span></div>`,
      {
        state: { a: true, b: true },
        both(a: boolean, b: boolean) { return a && b },
      },
    )
    await tick()
    const span = root.querySelector('span')!
    expect(span.classList.contains('on')).toBe(true)
    expect(span.classList.contains('off')).toBe(false)
  })

  it('data-on: a handler call with two args fires once with both', async () => {
    const got: unknown[] = []
    const { root } = mountForTest(
      `<div><button data-on="click:pick(1, 'a,b'), focus:pick(2, 'f')">x</button></div>`,
      { state: {}, pick(n: number, s: string) { got.push([n, s]) } },
    )
    await tick()
    const btn = root.querySelector('button')!
    btn.click()
    btn.dispatchEvent(new FocusEvent('focus'))
    expect(got).toEqual([[1, 'a,b'], [2, 'f']])
  })
})

describe('quoted keys', () => {
  it("data-class: 'md:hidden' toggles the full class name", async () => {
    const { root, inst } = mountForTest(
      `<div><span data-class="'md:hidden': collapsed, &quot;data-[open]:block&quot;: open"></span></div>`,
      { state: { collapsed: true, open: false } },
    )
    await tick()
    const span = root.querySelector('span')!
    expect(span.classList.contains('md:hidden')).toBe(true)
    expect(span.classList.contains('data-[open]:block')).toBe(false)
    ;(inst.state as Record<string, unknown>).collapsed = false
    ;(inst.state as Record<string, unknown>).open = true
    await tick()
    expect(span.classList.contains('md:hidden')).toBe(false)
    expect(span.classList.contains('data-[open]:block')).toBe(true)
  })

  it('unquoted keys keep splitting on the first colon (ternary values intact)', async () => {
    const { root } = mountForTest(
      `<div><span data-bind="title: a ? 'yes' : 'no'"></span></div>`,
      { state: { a: true } },
    )
    await tick()
    expect(root.querySelector('span')!.getAttribute('title')).toBe('yes')
  })
})
