/**
 * tests/components-forms.test.ts — Combobox, Toggle, Tag-input, Date-picker, Slider.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '../src/core/mount'
import { registry, instances } from '../src/core/registry'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

function mountIn(html: string, def: object, props: Record<string, string> = {}) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html.trim()
  const root = wrap.firstElementChild as HTMLElement
  for (const [k, v] of Object.entries(props)) root.dataset[k] = v
  document.body.appendChild(root)
  return { root, inst: mount(root, def as never) as never }
}

const tick = () => Promise.resolve()

// ── Combobox ──────────────────────────────────────────────────────────────────

describe('Combobox (combobox-demo)', () => {
  type Opt = { label: string; value: string }
  const def = {
    state: {
      query: '',
      open: false,
      highlight: 0,
      selected: '',
      options: [
        { label: 'Argentina', value: 'AR' },
        { label: 'Brazil',    value: 'BR' },
        { label: 'Canada',    value: 'CA' },
        { label: 'France',    value: 'FR' },
      ] as Opt[],
    },
    filtered() {
      const self = this as never as { state: { query: string; options: Opt[] } }
      const q = self.state.query.trim().toLowerCase()
      if (!q) return self.state.options
      return self.state.options.filter(o => o.label.toLowerCase().includes(q))
    },
    onCreate() {
      const self = this as never as { $el: HTMLElement; state: { open: boolean }; _outside?: (e: MouseEvent) => void }
      self._outside = (e: MouseEvent) => {
        if (!self.$el.contains(e.target as Node)) self.state.open = false
      }
      document.addEventListener('click', self._outside)
    },
    onDestroy() {
      const self = this as never as { _outside?: (e: MouseEvent) => void }
      if (self._outside) document.removeEventListener('click', self._outside)
    },
    openList() {
      const self = this as never as { state: { open: boolean; highlight: number } }
      self.state.open = true
      self.state.highlight = 0
    },
    onKey(e: KeyboardEvent) {
      const self = this as never as { filtered: () => Opt[]; state: { open: boolean; highlight: number }; _select: (p: Opt) => void }
      const list = self.filtered()
      if (e.key === 'ArrowDown') {
        self.state.open = true
        self.state.highlight = (self.state.highlight + 1) % list.length
      } else if (e.key === 'ArrowUp') {
        self.state.highlight = (self.state.highlight - 1 + list.length) % list.length
      } else if (e.key === 'Enter') {
        const pick = list[self.state.highlight]
        if (pick) self._select(pick)
      } else if (e.key === 'Escape') {
        self.state.open = false
      }
    },
    _select(pick: Opt) {
      const self = this as never as { state: { selected: string; query: string; open: boolean }; emit: (e: string, p?: unknown) => void }
      self.state.selected = pick.value
      self.state.query = pick.label
      self.state.open = false
      self.emit('combobox:picked', pick)
    },
  }

  it('filtered() narrows by query — case insensitive', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { filtered: () => Opt[]; state: { query: string } } }
    expect(inst.filtered().length).toBe(4)
    inst.state.query = 'a'
    expect(inst.filtered().map(o => o.value).sort()).toEqual(['AR', 'BR', 'CA', 'FR'])
    inst.state.query = 'BRA'
    expect(inst.filtered().map(o => o.value)).toEqual(['BR'])
    inst.state.query = 'xx'
    expect(inst.filtered()).toEqual([])
  })

  it('arrow keys wrap highlight; Enter selects + closes', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { onKey: (e: KeyboardEvent) => void; state: { highlight: number; selected: string; open: boolean } } }
    inst.onKey(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(inst.state.highlight).toBe(1)
    inst.onKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
    inst.onKey(new KeyboardEvent('keydown', { key: 'ArrowUp' }))   // wraps to 3
    expect(inst.state.highlight).toBe(3)
    inst.onKey(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(inst.state.selected).toBe('FR')
    expect(inst.state.open).toBe(false)
  })

  it('outside click closes the list', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { openList: () => void; state: { open: boolean } } }
    await tick()
    inst.openList()
    expect(inst.state.open).toBe(true)
    document.body.appendChild(document.createElement('div')).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(inst.state.open).toBe(false)
  })
})

// ── Toggle ────────────────────────────────────────────────────────────────────

describe('Toggle (toggle-demo)', () => {
  const def = {
    state: { checked: false, label: '', disabled: false },
    onCreate() {
      const self = this as never as { state: { label: string; checked: boolean; disabled: boolean }; prop: (k: string, d?: unknown) => unknown }
      self.state.label = self.prop('label', '') as string
      self.state.checked = self.prop('checked', false) as boolean
      self.state.disabled = self.prop('disabled', false) as boolean
    },
    flip() {
      const self = this as never as { state: { checked: boolean; disabled: boolean; label: string }; emit: (e: string, p?: unknown) => void }
      if (self.state.disabled) return
      self.state.checked = !self.state.checked
      self.emit('toggle:changed', { label: self.state.label, checked: self.state.checked })
    },
  }

  it('reads label/checked/disabled from data-* with auto-cast', async () => {
    const { inst } = mountIn('<div></div>', def, { label: 'X', checked: 'true', disabled: 'false' }) as { inst: { state: { label: string; checked: boolean; disabled: boolean } } }
    await tick()
    expect(inst.state.label).toBe('X')
    expect(inst.state.checked).toBe(true)
    expect(inst.state.disabled).toBe(false)
  })

  it('flip() toggles checked', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { flip: () => void; state: { checked: boolean } } }
    inst.flip()
    expect(inst.state.checked).toBe(true)
    inst.flip()
    expect(inst.state.checked).toBe(false)
  })

  it('flip() is a no-op when disabled', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { flip: () => void; state: { checked: boolean; disabled: boolean } } }
    inst.state.disabled = true
    inst.flip()
    expect(inst.state.checked).toBe(false)
  })
})

// ── Tag input ─────────────────────────────────────────────────────────────────

describe('Tag input (tag-input-demo)', () => {
  type Tag = { id: string; text: string }
  const def = {
    state: { tags: [] as Tag[], draft: '' },
    onKey(e: KeyboardEvent) {
      const self = this as never as { state: { draft: string; tags: Tag[] }; commitDraft: () => void }
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        self.commitDraft()
      } else if (e.key === 'Backspace' && self.state.draft === '' && self.state.tags.length) {
        self.state.tags = self.state.tags.slice(0, -1)
      }
    },
    commitDraft() {
      const self = this as never as { state: { draft: string; tags: Tag[] }; _make: (t: string) => Tag; _dedupe: (l: Tag[]) => Tag[] }
      const text = self.state.draft.trim()
      if (!text) return
      self.state.tags = self._dedupe([...self.state.tags, self._make(text)])
      self.state.draft = ''
    },
    remove(e: Event) {
      const self = this as never as { state: { tags: Tag[] } }
      const id = (e.currentTarget as HTMLElement).dataset['id']!
      self.state.tags = self.state.tags.filter(t => t.id !== id)
    },
    _make(text: string) {
      return { id: Math.random().toString(36).slice(2), text }
    },
    _dedupe(list: Tag[]) {
      const seen = new Set<string>()
      return list.filter(t => {
        const k = t.text.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    },
  }

  it('Enter commits the draft as a new tag', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { draft: string; tags: Tag[] }; onKey: (e: KeyboardEvent) => void } }
    inst.state.draft = 'alpha'
    inst.onKey(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(inst.state.tags.map(t => t.text)).toEqual(['alpha'])
    expect(inst.state.draft).toBe('')
  })

  it('comma also commits', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { draft: string; tags: Tag[] }; onKey: (e: KeyboardEvent) => void } }
    inst.state.draft = 'beta'
    inst.onKey(new KeyboardEvent('keydown', { key: ',' }))
    expect(inst.state.tags.map(t => t.text)).toEqual(['beta'])
  })

  it('empty draft + Backspace removes the last tag', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { draft: string; tags: Tag[] }; onKey: (e: KeyboardEvent) => void; commitDraft: () => void } }
    inst.state.draft = 'a'; inst.commitDraft()
    inst.state.draft = 'b'; inst.commitDraft()
    expect(inst.state.tags.length).toBe(2)
    inst.onKey(new KeyboardEvent('keydown', { key: 'Backspace' }))
    expect(inst.state.tags.map(t => t.text)).toEqual(['a'])
  })

  it('dedup: same text (case-insensitive) is not added twice', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { draft: string; tags: Tag[] }; commitDraft: () => void } }
    inst.state.draft = 'Alpha';   inst.commitDraft()
    inst.state.draft = 'alpha';   inst.commitDraft()
    inst.state.draft = 'ALPHA';   inst.commitDraft()
    expect(inst.state.tags.map(t => t.text)).toEqual(['Alpha'])
  })

  it('remove() filters out the tag by id', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { draft: string; tags: Tag[] }; remove: (e: Event) => void; commitDraft: () => void } }
    inst.state.draft = 'a'; inst.commitDraft()
    inst.state.draft = 'b'; inst.commitDraft()
    const idA = inst.state.tags[0]!.id
    const btn = document.createElement('button')
    btn.dataset['id'] = idA
    inst.remove({ currentTarget: btn } as never)
    expect(inst.state.tags.map(t => t.text)).toEqual(['b'])
  })
})

// ── Date picker ───────────────────────────────────────────────────────────────

describe('Date picker (datepicker-demo)', () => {
  const def = {
    state: { today: '2026-05-25', selected: '', cursor: '2026-05' },
    days() {
      const self = this as never as { state: { cursor: string } }
      const [y, m] = self.state.cursor.split('-').map(Number) as [number, number]
      const first = new Date(y, m - 1, 1)
      const last = new Date(y, m, 0).getDate()
      const lead = (first.getDay() + 6) % 7
      const cells: Array<{ day: number | ''; iso: string; empty: boolean }> = []
      for (let i = 0; i < lead; i++) cells.push({ day: '', iso: `pad-${m}-${i}`, empty: true })
      for (let d = 1; d <= last; d++) {
        const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        cells.push({ day: d, iso, empty: false })
      }
      return cells
    },
    prevMonth() {
      const self = this as never as { state: { cursor: string } }
      const [y, m] = self.state.cursor.split('-').map(Number) as [number, number]
      self.state.cursor = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    },
    nextMonth() {
      const self = this as never as { state: { cursor: string } }
      const [y, m] = self.state.cursor.split('-').map(Number) as [number, number]
      self.state.cursor = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    },
    pick(e: Event) {
      const self = this as never as { state: { selected: string }; emit: (e: string, p?: unknown) => void }
      const iso = (e.currentTarget as HTMLElement).dataset['iso']!
      if (!iso || iso.startsWith('pad-')) return
      self.state.selected = iso
      self.emit('date:picked', iso)
    },
  }

  it('days() produces lead padding + month days with stable iso keys', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { days: () => Array<{ day: number | ''; iso: string; empty: boolean }> } }
    const cells = inst.days()
    const real = cells.filter(c => !c.empty)
    expect(real.length).toBe(31) // May 2026
    // 2026-05-01 is a Friday → Monday-aligned lead = 4 empty cells
    const lead = cells.filter(c => c.empty).length
    expect(lead).toBe(4)
    // iso uniqueness
    const ids = new Set(cells.map(c => c.iso))
    expect(ids.size).toBe(cells.length)
  })

  it('prev/next month roll over year boundary', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { cursor: string }; prevMonth: () => void; nextMonth: () => void } }
    inst.state.cursor = '2026-01'
    inst.prevMonth()
    expect(inst.state.cursor).toBe('2025-12')
    inst.state.cursor = '2026-12'
    inst.nextMonth()
    expect(inst.state.cursor).toBe('2027-01')
  })

  it('pick() ignores pad cells but sets real iso + emits', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { pick: (e: Event) => void; state: { selected: string } } }
    const pad = document.createElement('button'); pad.dataset['iso'] = 'pad-5-0'
    inst.pick({ currentTarget: pad } as never)
    expect(inst.state.selected).toBe('')

    const real = document.createElement('button'); real.dataset['iso'] = '2026-05-15'
    inst.pick({ currentTarget: real } as never)
    expect(inst.state.selected).toBe('2026-05-15')
  })
})

// ── Slider ────────────────────────────────────────────────────────────────────

describe('Slider (slider-demo)', () => {
  const def = {
    state: { label: '', value: 0, min: 0, max: 100, step: 1, suffix: '' },
    onCreate() {
      const self = this as never as { state: Record<string, unknown>; prop: (k: string, d?: unknown) => unknown }
      self.state['label']  = self.prop('label', '')
      self.state['suffix'] = self.prop('suffix', '')
      self.state['min']    = self.prop('min', 0)
      self.state['max']    = self.prop('max', 100)
      self.state['step']   = self.prop('step', 1)
      self.state['value']  = self.prop('value', self.state['min'])
    },
    percent() {
      const self = this as never as { state: { value: number; min: number; max: number } }
      const { value, min, max } = self.state
      if (max === min) return 0
      return Math.round(((value - min) / (max - min)) * 100)
    },
  }

  it('reads numeric props as numbers (no Number() cast needed)', async () => {
    const { inst } = mountIn('<div></div>', def, { label: 'Vol', min: '0', max: '200', step: '5', value: '50' }) as { inst: { state: { min: number; max: number; step: number; value: number; label: string } } }
    await tick()
    expect(typeof inst.state.min).toBe('number')
    expect(typeof inst.state.value).toBe('number')
    expect(inst.state.max).toBe(200)
    expect(inst.state.label).toBe('Vol')
  })

  it('percent() reflects value position between min and max', async () => {
    const { inst } = mountIn('<div></div>', def, { min: '0', max: '200', value: '50' }) as { inst: { state: { value: number }; percent: () => number } }
    await tick()
    expect(inst.percent()).toBe(25)
    inst.state.value = 100
    expect(inst.percent()).toBe(50)
    inst.state.value = 200
    expect(inst.percent()).toBe(100)
  })

  it('percent() returns 0 when min === max (no division by zero)', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { min: number; max: number; value: number }; percent: () => number } }
    inst.state.min = 5
    inst.state.max = 5
    inst.state.value = 5
    expect(inst.percent()).toBe(0)
  })
})
