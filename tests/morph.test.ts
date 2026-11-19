/**
 * tests/morph.test.ts — a live component is a boundary for DOM morphing.
 *
 * Morphing (htmx 4 morph swaps, Turbo 8 page refresh, idiomorph) patches the
 * existing DOM toward the server's HTML, which inside a component is the
 * pre-render template. The component root must be skipped, so its rendered
 * rows, values and listeners survive. Real-library behavior is checked in a
 * browser stand; these tests pin the two hooks.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { registry, instances } from '../src/core/registry'
import { mountForTest } from './helpers/mount'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

const turboMorph = (target: Element, newElement?: Element) => {
  const e = new CustomEvent('turbo:before-morph-element', { bubbles: true, cancelable: true, detail: { currentElement: target, newElement } })
  target.dispatchEvent(e)
  return e.defaultPrevented
}

describe('htmx 4: hx-morph-skip', () => {
  it('is set on a mounted root and removed on destroy', () => {
    const { root, inst } = mountForTest('<div></div>', { state: {} })
    expect(root.hasAttribute('hx-morph-skip')).toBe(true)
    inst.destroy()
    expect(root.hasAttribute('hx-morph-skip')).toBe(false)
  })
})

describe('Turbo 8: turbo:before-morph-element', () => {
  it('cancels a morph of a live component root', () => {
    const { root } = mountForTest('<div><p>x</p></div>', { state: {} })
    expect(turboMorph(root, document.createElement('div'))).toBe(true)
  })

  it('leaves elements inside or outside a component alone', () => {
    const { root } = mountForTest('<div><p>x</p></div>', { state: {} })
    const other = document.body.appendChild(document.createElement('section'))
    expect(turboMorph(root.querySelector('p')!, document.createElement('p'))).toBe(false)
    expect(turboMorph(other, document.createElement('section'))).toBe(false)
  })

  it('lets a removal through (Turbo sends no newElement), so the component goes', () => {
    const { root } = mountForTest('<div></div>', { state: {} })
    expect(turboMorph(root)).toBe(false)
  })

  it('morphs a destroyed component normally', () => {
    const { root, inst } = mountForTest('<div></div>', { state: {} })
    inst.destroy()
    expect(turboMorph(root, document.createElement('div'))).toBe(false)
  })
})
