/**
 * tests/components-navigation.test.ts — Tabs, Accordion, Breadcrumb demos.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '../src/core/mount'
import { registry, instances } from '../src/core/registry'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

function mountIn(html: string, def: object) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html.trim()
  const root = wrap.firstElementChild as HTMLElement
  document.body.appendChild(root)
  return { root, inst: mount(root, def as never) as never }
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

describe('Tabs (tabs-demo)', () => {
  const def = {
    state: { active: 'overview' },
    ids() { return ['overview', 'billing', 'security'] },
    select(e: Event) {
      const self = this as never as { state: { active: string } }
      self.state.active = (e.currentTarget as HTMLElement).dataset['id']!
    },
    onKey(e: KeyboardEvent) {
      const self = this as never as { ids: () => string[]; state: { active: string } }
      const ids = self.ids()
      const i = ids.indexOf(self.state.active)
      if (e.key === 'ArrowRight') self.state.active = ids[(i + 1) % ids.length]!
      else if (e.key === 'ArrowLeft') self.state.active = ids[(i - 1 + ids.length) % ids.length]!
      else if (e.key === 'Home') self.state.active = ids[0]!
      else if (e.key === 'End') self.state.active = ids[ids.length - 1]!
    },
  }

  it('select() reads data-id from currentTarget', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { select: (e: Event) => void; state: { active: string } } }
    const btn = document.createElement('button')
    btn.dataset['id'] = 'billing'
    inst.select({ currentTarget: btn } as never)
    expect(inst.state.active).toBe('billing')
  })

  it('ArrowRight wraps from last to first', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { onKey: (e: KeyboardEvent) => void; state: { active: string } } }
    inst.state.active = 'security'
    inst.onKey(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(inst.state.active).toBe('overview')
  })

  it('ArrowLeft wraps from first to last', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { onKey: (e: KeyboardEvent) => void; state: { active: string } } }
    inst.onKey(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(inst.state.active).toBe('security')
  })

  it('Home / End jump to bounds', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { onKey: (e: KeyboardEvent) => void; state: { active: string } } }
    inst.state.active = 'billing'
    inst.onKey(new KeyboardEvent('keydown', { key: 'Home' }))
    expect(inst.state.active).toBe('overview')
    inst.onKey(new KeyboardEvent('keydown', { key: 'End' }))
    expect(inst.state.active).toBe('security')
  })

  it('non-navigation keys are ignored', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { onKey: (e: KeyboardEvent) => void; state: { active: string } } }
    inst.onKey(new KeyboardEvent('keydown', { key: 'a' }))
    expect(inst.state.active).toBe('overview')
  })
})

// ── Accordion ─────────────────────────────────────────────────────────────────

describe('Accordion (accordion-demo)', () => {
  const def = {
    state: {
      multi: false,
      open: ['shipping'] as string[],
      items: [
        { id: 'shipping', title: '?', body: '.' },
        { id: 'returns',  title: '?', body: '.' },
        { id: 'support',  title: '?', body: '.' },
      ],
    },
    isOpen(id: string) {
      const self = this as never as { state: { open: string[] } }
      return self.state.open.includes(id)
    },
    toggle(e: Event) {
      const self = this as never as { state: { open: string[]; multi: boolean }; isOpen: (id: string) => boolean }
      const id = (e.currentTarget as HTMLElement).dataset['id']!
      const wasOpen = self.isOpen(id)
      if (self.state.multi) {
        self.state.open = wasOpen ? self.state.open.filter(x => x !== id) : [...self.state.open, id]
      } else {
        self.state.open = wasOpen ? [] : [id]
      }
    },
  }

  function btn(id: string) {
    const b = document.createElement('button')
    b.dataset['id'] = id
    return b
  }

  it('single-mode: clicking another closes the first', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { toggle: (e: Event) => void; state: { open: string[] } } }
    inst.toggle({ currentTarget: btn('returns') } as never)
    expect(inst.state.open).toEqual(['returns'])
  })

  it('single-mode: clicking the open one closes it', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { toggle: (e: Event) => void; state: { open: string[] } } }
    inst.toggle({ currentTarget: btn('shipping') } as never)
    expect(inst.state.open).toEqual([])
  })

  it('multi-mode: clicks accumulate without closing others', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { toggle: (e: Event) => void; state: { open: string[]; multi: boolean } } }
    inst.state.multi = true
    inst.toggle({ currentTarget: btn('returns') } as never)
    expect(inst.state.open.sort()).toEqual(['returns', 'shipping'])
    inst.toggle({ currentTarget: btn('shipping') } as never)
    expect(inst.state.open).toEqual(['returns'])
  })

  it('isOpen() reflects state without mirroring', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { isOpen: (id: string) => boolean; state: Record<string, unknown> } }
    expect(inst.isOpen('shipping')).toBe(true)
    expect(inst.isOpen('returns')).toBe(false)
    expect(inst.state['isOpen']).toBeUndefined()
  })
})

// ── Breadcrumb ────────────────────────────────────────────────────────────────

describe('Breadcrumb (breadcrumb-demo)', () => {
  type Trail = { label: string; href: string }
  const def = {
    state: {
      trail: [] as Trail[],
      showAll: false,
      maxSegments: 4,
    },
    visible() {
      const self = this as never as { state: { trail: Trail[]; showAll: boolean; maxSegments: number } }
      const { trail, showAll, maxSegments } = self.state
      const len = trail.length
      const tail = (item: Trail, i: number) => ({ ...item, current: i === len - 1, key: 'c-' + i })
      if (showAll || len <= maxSegments) return trail.map(tail)
      return [
        tail(trail[0]!, 0),
        { ellipsis: true, key: 'ellipsis' },
        tail(trail[len - 2]!, len - 2),
        tail(trail[len - 1]!, len - 1),
      ]
    },
    expand() {
      const self = this as never as { state: { showAll: boolean } }
      self.state.showAll = true
    },
  }

  it('short trail: all segments visible, last marked current', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { trail: Trail[] }; visible: () => Array<{ current?: boolean; ellipsis?: boolean }> } }
    inst.state.trail = [
      { label: 'A', href: '/a' },
      { label: 'B', href: '/a/b' },
      { label: 'C', href: '/a/b/c' },
    ]
    const v = inst.visible()
    expect(v.length).toBe(3)
    expect(v[0]!.current).toBe(false)
    expect(v[2]!.current).toBe(true)
    expect(v.some(x => x.ellipsis)).toBe(false)
  })

  it('long trail: collapses middle into ellipsis (first + … + last two)', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { trail: Trail[] }; visible: () => Array<{ ellipsis?: boolean; label?: string }> } }
    inst.state.trail = [
      { label: 'A', href: '/a' },
      { label: 'B', href: '/a/b' },
      { label: 'C', href: '/a/b/c' },
      { label: 'D', href: '/a/b/c/d' },
      { label: 'E', href: '/a/b/c/d/e' },
    ]
    const v = inst.visible()
    expect(v.length).toBe(4)
    expect(v[0]!.label).toBe('A')
    expect(v[1]!.ellipsis).toBe(true)
    expect(v[2]!.label).toBe('D')
    expect(v[3]!.label).toBe('E')
  })

  it('expand() shows all segments even when long', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { trail: Trail[] }; expand: () => void; visible: () => Array<{ ellipsis?: boolean }> } }
    inst.state.trail = [
      { label: 'A', href: '/a' },
      { label: 'B', href: '/a/b' },
      { label: 'C', href: '/a/b/c' },
      { label: 'D', href: '/a/b/c/d' },
      { label: 'E', href: '/a/b/c/d/e' },
    ]
    inst.expand()
    const v = inst.visible()
    expect(v.length).toBe(5)
    expect(v.some(x => x.ellipsis)).toBe(false)
  })

  it('visible() never mutates the source trail', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { trail: Trail[] }; visible: () => unknown[] } }
    inst.state.trail = [
      { label: 'A', href: '/a' },
      { label: 'B', href: '/a/b' },
    ]
    const snap = JSON.stringify(inst.state.trail)
    inst.visible()
    expect(JSON.stringify(inst.state.trail)).toBe(snap)
  })
})
