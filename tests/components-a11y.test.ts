/**
 * tests/components-a11y.test.ts — accessibility contract of the site component
 * catalog (site/components/*.html).
 *
 * Loads each shipped component page through the bench harness: it strips the
 * `../dist/micra.js` <script> and injects the locally built dist bundle, then
 * runs the page's own inline script in happy-dom. So the thing under test is
 * the exact catalog page a user reads and copies — no inline re-implementation,
 * no drift between the docs and the suite.
 *
 * Scope is the a11y contract added/verified during the accessibility pass
 * (roles, ARIA state, keyboard, focus movement), not styling.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — plain ESM helpers from the bench harness, no .d.ts
import { loadPage } from '../bench-llm/lib/loadPage.mjs'
// @ts-expect-error — plain ESM helpers from the bench harness, no .d.ts
import { normalizeMicraLoading } from '../bench-llm/lib/extract.mjs'

const COMPONENTS_DIR = join(process.cwd(), 'site', 'components')

async function load(file: string) {
  const raw = readFileSync(join(COMPONENTS_DIR, file), 'utf8')
  const { html } = normalizeMicraLoading(raw)
  return loadPage(html)
}

/** Dispatch a bubbling keydown on an element in the page's window realm. */
function press(api: any, el: Element, key: string, opts: Record<string, unknown> = {}) {
  el.dispatchEvent(new api.window.KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
}
const active = (api: any) => api.window.document.activeElement
/** Scope a query to the demo component (skip the page's sidebar etc.). */
const within = (api: any, root: string, sel: string) =>
  [...api.$(root).querySelectorAll(sel)]

// ── Modal (modal-demo) ──────────────────────────────────────────────────────

describe('components/modal.html — Modal', () => {
  it('mounts with the dialog absent and a labelled trigger', async () => {
    const api = await load('modal.html')
    expect(api.errors).toEqual([])
    expect(api.$('[role="dialog"]')).toBeNull()
    expect(api.button(/open dialog/i)).not.toBeNull()
  })

  it('opens, exposes dialog semantics, moves focus inside, locks scroll', async () => {
    const api = await load('modal.html')
    await api.click(api.button(/open dialog/i))
    await api.sleep(20)
    const dialog = api.$('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('m-title')
    expect(dialog.contains(active(api))).toBe(true) // focus landed inside
    expect(active(api).tagName).toBe('BUTTON')
    expect(api.window.document.body.style.overflow).toBe('hidden')
  })

  it('closes on Escape (document listener) and restores focus + scroll', async () => {
    const api = await load('modal.html')
    const trigger = api.button(/open dialog/i)
    trigger.focus() // a real click focuses the trigger; happy-dom's .click() does not
    await api.click(trigger)
    await api.sleep(20)
    press(api, api.window.document, 'Escape')
    await api.sleep(20)
    expect(api.$('[role="dialog"]')).toBeNull()
    expect(api.window.document.body.style.overflow).toBe('')
    expect(active(api)).toBe(trigger)
  })

  it('backdrop click closes; dialog click does not', async () => {
    const api = await load('modal.html')
    await api.click(api.button(/open dialog/i))
    await api.sleep(20)
    api.$('[role="dialog"]').click()
    await api.sleep(20)
    expect(api.$('[role="dialog"]')).not.toBeNull()
    api.$('.modal-backdrop').click()
    await api.sleep(20)
    expect(api.$('[role="dialog"]')).toBeNull()
  })

  it('traps Tab and Shift+Tab at the edges', async () => {
    const api = await load('modal.html')
    await api.click(api.button(/open dialog/i))
    await api.sleep(20)
    const dialog = api.$('[role="dialog"]')
    const f = [...dialog.querySelectorAll('button')]
    const first = f[0], last = f[f.length - 1]
    last.focus()
    press(api, last, 'Tab')
    expect(active(api)).toBe(first)
    first.focus()
    press(api, first, 'Tab', { shiftKey: true })
    expect(active(api)).toBe(last)
  })
})

// ── Tabs (tabs-demo) ────────────────────────────────────────────────────────

describe('components/tabs.html — Tabs', () => {
  it('renders a roving-tablist with true/false aria-selected and panel wiring', async () => {
    const api = await load('tabs.html')
    expect(api.errors).toEqual([])
    const tabs = api.$$('[role="tab"]')
    expect(tabs).toHaveLength(3)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(tabs[0].getAttribute('tabindex')).toBe('0')
    expect(tabs[1].getAttribute('aria-selected')).toBe('false')
    expect(tabs[1].getAttribute('tabindex')).toBe('-1')
    // cross-links
    expect(tabs[0].getAttribute('id')).toBe('tab-overview')
    expect(tabs[0].getAttribute('aria-controls')).toBe('panel-overview')
    const panel = api.$('[role="tabpanel"]') // only the active panel is in the DOM (data-if)
    expect(panel.getAttribute('id')).toBe('panel-overview')
    expect(panel.getAttribute('aria-labelledby')).toBe('tab-overview')
  })

  it('moves selection + focus with ArrowRight / ArrowLeft / Home / End', async () => {
    const api = await load('tabs.html')
    const tabs = api.$$('[role="tab"]')
    tabs[0].focus()
    press(api, tabs[0], 'ArrowRight')
    await api.sleep(20)
    expect(tabs[1].getAttribute('aria-selected')).toBe('true')
    expect(active(api)).toBe(tabs[1])
    expect(api.$('[role="tabpanel"]').getAttribute('id')).toBe('panel-billing')

    press(api, tabs[1], 'End')
    await api.sleep(20)
    expect(tabs[2].getAttribute('aria-selected')).toBe('true')

    press(api, tabs[2], 'Home')
    await api.sleep(20)
    expect(tabs[0].getAttribute('aria-selected')).toBe('true')
    expect(active(api)).toBe(tabs[0])
  })
})

// ── Dropdown (dropdown-demo) ────────────────────────────────────────────────

describe('components/dropdown.html — Dropdown (listbox)', () => {
  it('reports collapsed state with the listbox absent', async () => {
    const api = await load('dropdown.html')
    expect(api.errors).toEqual([])
    expect(api.$('[aria-haspopup="listbox"]').getAttribute('aria-expanded')).toBe('false')
    expect(api.$('[role="listbox"]')).toBeNull()
  })

  it('opens on click, focuses an option, exposes role=option items', async () => {
    const api = await load('dropdown.html')
    await api.click(api.$('[aria-haspopup="listbox"]'))
    await api.sleep(20)
    expect(api.$('[aria-haspopup="listbox"]').getAttribute('aria-expanded')).toBe('true')
    const opts = api.$$('[role="option"]')
    expect(opts).toHaveLength(3)
    expect(active(api)).toBe(opts[0])
    expect(opts[0].getAttribute('tabindex')).toBe('0')
    expect(opts[1].getAttribute('tabindex')).toBe('-1')
  })

  it('rovers focus with ArrowDown / ArrowUp (wrapping)', async () => {
    const api = await load('dropdown.html')
    const trigger = api.$('[aria-haspopup="listbox"]')
    await api.click(trigger)
    await api.sleep(20)
    const listbox = api.$('[role="listbox"]')
    const opts = api.$$('[role="option"]')
    press(api, listbox, 'ArrowDown')
    await api.sleep(20)
    expect(active(api)).toBe(opts[1])
    expect(opts[1].getAttribute('tabindex')).toBe('0')
    press(api, listbox, 'ArrowUp')
    press(api, listbox, 'ArrowUp') // 1 → 0 → wrap to 2
    await api.sleep(20)
    expect(active(api)).toBe(opts[2])
  })

  it('Escape closes and returns focus to the trigger', async () => {
    const api = await load('dropdown.html')
    const trigger = api.$('[aria-haspopup="listbox"]')
    await api.click(trigger)
    await api.sleep(20)
    press(api, api.$('[role="listbox"]'), 'Escape')
    await api.sleep(20)
    expect(api.$('[role="listbox"]')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(active(api)).toBe(trigger)
  })

  it('selecting an option updates the label, marks aria-selected, closes', async () => {
    const api = await load('dropdown.html')
    await api.click(api.$('[aria-haspopup="listbox"]'))
    await api.sleep(20)
    await api.click(api.$$('[role="option"]')[1]) // "Oldest first"
    await api.sleep(20)
    expect(api.$('[role="listbox"]')).toBeNull()
    expect(api.$('.dropdown-toggle').textContent.trim()).toContain('Oldest first')
    // reopen: the chosen option is now aria-selected="true"
    await api.click(api.$('[aria-haspopup="listbox"]'))
    await api.sleep(20)
    expect(api.$$('[role="option"]')[1].getAttribute('aria-selected')).toBe('true')
    expect(api.$$('[role="option"]')[0].getAttribute('aria-selected')).toBe('false')
  })
})

// ── Combobox (combobox-demo) ────────────────────────────────────────────────

describe('components/combobox.html — Combobox', () => {
  it('mounts collapsed with combobox semantics', async () => {
    const api = await load('combobox.html')
    expect(api.errors).toEqual([])
    const input = api.$('[role="combobox"]')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-controls')).toBe('cb-listbox')
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(api.$('[role="listbox"]')).toBeNull()
  })

  it('opens on focus and filters as you type, exposing role=option items', async () => {
    const api = await load('combobox.html')
    const input = api.$('[role="combobox"]')
    input.focus()
    input.dispatchEvent(new api.window.Event('focus')) // @focus="openList"
    await api.sleep(20)
    expect(input.getAttribute('aria-expanded')).toBe('true')
    await api.type(input, 'ca')
    const opts = api.$$('[role="option"]')
    expect(opts).toHaveLength(1)
    expect(opts[0].textContent.trim()).toBe('Canada')
    expect(opts[0].getAttribute('role')).toBe('option')
  })

  it('tracks the highlight via aria-activedescendant; focus stays on the input', async () => {
    const api = await load('combobox.html')
    const input = api.$('[role="combobox"]')
    input.focus()
    input.dispatchEvent(new api.window.Event('focus'))
    await api.sleep(20)
    // openList set highlight=0 → first option is active descendant
    expect(input.getAttribute('aria-activedescendant')).toBe('cb-opt-0')
    const opts = api.$$('[role="option"]')
    expect(opts[0].getAttribute('id')).toBe('cb-opt-0')
    expect(opts[0].getAttribute('aria-selected')).toBe('true')
    expect(opts[0].getAttribute('tabindex')).toBe('-1') // focus stays on input
    expect(active(api)).toBe(input)
  })

  it('Enter picks the highlighted option and closes', async () => {
    const api = await load('combobox.html')
    const input = api.$('[role="combobox"]')
    input.focus()
    input.dispatchEvent(new api.window.Event('focus'))
    await api.sleep(20)
    await api.type(input, 'swe') // Sweden
    press(api, input, 'Enter')
    await api.sleep(20)
    expect(input.value).toBe('Sweden')
    expect(api.$('[role="listbox"]')).toBeNull()
  })

  it('shows an empty state when nothing matches', async () => {
    const api = await load('combobox.html')
    const input = api.$('[role="combobox"]')
    input.focus()
    input.dispatchEvent(new api.window.Event('focus'))
    await api.sleep(20)
    await api.type(input, 'zzzz')
    expect(api.$$('[role="option"]')).toHaveLength(0)
    expect(api.$('.combobox-empty')).not.toBeNull()
  })
})

// ── Toast (toast-stack + toast-trigger) ─────────────────────────────────────

describe('components/toast.html — Toast', () => {
  it('mounts a polite live region with no toasts', async () => {
    const api = await load('toast.html')
    expect(api.errors).toEqual([])
    const region = api.$('[role="status"]')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(api.$$('.toast').length).toBe(0)
  })

  it('shows a toast with title, message, and severity class', async () => {
    const api = await load('toast.html')
    await api.click(api.button(/show success/i))
    await api.sleep(20)
    const toast = api.$('.toast')
    expect(toast).not.toBeNull()
    expect(toast.className).toContain('toast-success')
    expect(api.$('.toast-title').textContent).toBe('Saved')
    expect(api.$('.toast-message').textContent).toContain('persisted')
  })

  it('dismisses on the close button', async () => {
    const api = await load('toast.html')
    await api.click(api.button(/show error/i))
    await api.sleep(20)
    expect(api.$$('.toast').length).toBe(1)
    await api.click(api.$('[aria-label="Dismiss"]'))
    await api.sleep(20)
    expect(api.$$('.toast').length).toBe(0)
  })

  it('accepts toasts fired over the event bus', async () => {
    const api = await load('toast.html')
    api.window.Micra.emit('toast', { title: 'Bus', message: 'From the bus', severity: 'info' })
    await api.sleep(20)
    expect(api.$('.toast-title').textContent).toBe('Bus')
  })
})

// ── Toggle (toggle-demo) ────────────────────────────────────────────────────

describe('components/toggle.html — Switch', () => {
  it('binds aria-checked as a "true"/"false" string and flips on click', async () => {
    const api = await load('toggle.html')
    expect(api.errors).toEqual([])
    const sw = api.$('[role="switch"]')
    const before = sw.getAttribute('aria-checked')
    expect(['true', 'false']).toContain(before) // regression: NOT "" / null
    await api.click(sw)
    await api.sleep(20)
    expect(sw.getAttribute('aria-checked')).toBe(before === 'true' ? 'false' : 'true')
  })

  it('exposes aria-disabled as a string on the disabled instance', async () => {
    const api = await load('toggle.html')
    expect(api.$$('[role="switch"]')[1].getAttribute('aria-disabled')).toBe('true')
  })
})

// ── Accordion (accordion-demo) ──────────────────────────────────────────────

describe('components/accordion.html — Accordion', () => {
  it('triggers carry string aria-expanded + aria-controls; opening reveals a labelled region', async () => {
    const api = await load('accordion.html')
    expect(api.errors).toEqual([])
    const triggers = api.$$('.accordion-trigger')
    expect(triggers.length).toBeGreaterThan(0)
    const closed = triggers.find((t: Element) => t.getAttribute('aria-expanded') === 'false')
    expect(closed).toBeTruthy()
    const controls = closed!.getAttribute('aria-controls')
    expect(controls).toBeTruthy()
    await api.click(closed!)
    await api.sleep(20)
    expect(closed!.getAttribute('aria-expanded')).toBe('true')
    const panel = api.$('#' + controls)
    expect(panel).not.toBeNull()
    expect(panel.getAttribute('role')).toBe('region')
    expect(panel.getAttribute('aria-labelledby')).toBe(closed!.getAttribute('id'))
  })
})

// ── Slider (slider-demo) ────────────────────────────────────────────────────

describe('components/slider.html — Slider', () => {
  it('native range input has an accessible name', async () => {
    const api = await load('slider.html')
    expect(api.errors).toEqual([])
    const input = api.$('input[type="range"]')
    expect(input.getAttribute('aria-label')).toBeTruthy()
  })
})

// ── Tag input (tag-input-demo) ──────────────────────────────────────────────

describe('components/tag-input.html — Tag input', () => {
  it('names the input and each remove button names its specific tag', async () => {
    const api = await load('tag-input.html')
    expect(api.errors).toEqual([])
    const input = api.$('.tag-input-inner')
    expect(input.getAttribute('aria-label')).toBe('Add a tag')
    // add a tag, then its remove button should name it specifically
    await api.type(input, 'React')
    press(api, input, 'Enter')
    await api.sleep(20)
    const removes = api.$$('.tag-remove')
    expect(removes.length).toBeGreaterThan(0)
    expect(removes[removes.length - 1].getAttribute('aria-label')).toBe('Remove React')
  })
})

// ── Breadcrumb (breadcrumb-demo) ────────────────────────────────────────────

describe('components/breadcrumb.html — Breadcrumb', () => {
  it('uses nav > ol > li with aria-current on the current page', async () => {
    const api = await load('breadcrumb.html')
    expect(api.errors).toEqual([])
    const nav = api.$('nav.breadcrumb')
    expect(nav.getAttribute('aria-label')).toBe('Breadcrumb')
    expect(nav.querySelector('ol')).not.toBeNull()
    expect(nav.querySelectorAll('ol > li').length).toBeGreaterThan(0)
    expect(api.$('[aria-current="page"]')).not.toBeNull()
  })
})

// ── Tooltip (tooltip-demo) ──────────────────────────────────────────────────

describe('components/tooltip.html — Tooltip', () => {
  it('links trigger↔bubble via aria-describedby + role=tooltip and dismisses on Escape', async () => {
    const api = await load('tooltip.html')
    expect(api.errors).toEqual([])
    const btn = api.$('.tooltip-wrap button')
    const describedby = btn.getAttribute('aria-describedby')
    expect(describedby).toMatch(/^tt-/)
    expect(api.$('[role="tooltip"]')).toBeNull() // hidden until shown
    btn.dispatchEvent(new api.window.Event('focus')) // @focus="show"
    await api.sleep(260) // 200ms show delay
    const bubble = api.$('[role="tooltip"]')
    expect(bubble).not.toBeNull()
    expect(bubble.getAttribute('id')).toBe(describedby)
    press(api, btn, 'Escape')
    await api.sleep(20)
    expect(api.$('[role="tooltip"]')).toBeNull()
  })
})

// ── Table (table-demo) ──────────────────────────────────────────────────────

describe('components/table.html — Sortable table', () => {
  it('sortable headers expose string aria-sort and are keyboard-operable', async () => {
    const api = await load('table.html')
    expect(api.errors).toEqual([])
    const ths = api.$$('th.sortable')
    expect(ths).toHaveLength(4)
    const nameTh = ths.find((t: Element) => /Name/.test(t.textContent || ''))!
    expect(nameTh.getAttribute('aria-sort')).toBe('ascending') // initial sort
    expect(ths.find((t: Element) => /Role/.test(t.textContent || ''))!.getAttribute('aria-sort')).toBe('none')
    expect(nameTh.getAttribute('tabindex')).toBe('0')
    press(api, nameTh, 'Enter') // keyboard toggles direction
    await api.sleep(20)
    expect(nameTh.getAttribute('aria-sort')).toBe('descending')
  })
})

// ── Command palette (cmdk-demo) ─────────────────────────────────────────────

describe('components/command-palette.html — Command palette', () => {
  it('opens as a combobox-in-dialog with listbox/option roles and aria-activedescendant', async () => {
    const api = await load('command-palette.html')
    expect(api.errors).toEqual([])
    await api.click(api.button(/open palette/i))
    await api.sleep(30)
    const input = api.$('[role="combobox"]')
    expect(input).not.toBeNull()
    expect(input.getAttribute('aria-controls')).toBe('cmdk-listbox')
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(api.$('#cmdk-listbox').getAttribute('role')).toBe('listbox')
    const opts = api.$$('[role="option"]')
    expect(opts.length).toBeGreaterThan(0)
    expect(opts[0].getAttribute('id')).toBe('cmdk-opt-0')
    expect(opts[0].getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe('cmdk-opt-0')
  })

  it('Escape closes and restores focus to the trigger', async () => {
    const api = await load('command-palette.html')
    const trigger = api.button(/open palette/i)
    trigger.focus()
    await api.click(trigger)
    await api.sleep(30)
    press(api, api.$('[role="combobox"]'), 'Escape')
    await api.sleep(20)
    expect(api.$('[role="dialog"]')).toBeNull()
    expect(active(api)).toBe(trigger)
  })
})

// ── Date picker (datepicker-demo) ───────────────────────────────────────────

describe('components/date-picker.html — Date picker (grid)', () => {
  /** Local-time ISO shift, mirroring the component's own date math so
   *  assertions stay exact even when a move crosses a month boundary. */
  const addDays = (iso: string, n: number) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d + n)
    const p = (x: number) => String(x).padStart(2, '0')
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
  }
  const days = (api: any) => within(api, '.datepicker', '.datepicker-day')

  it('exposes grid / row / gridcell roles, 7 columnheaders, and a month-labelled grid', async () => {
    const api = await load('date-picker.html')
    expect(api.errors).toEqual([])
    const grid = api.$('[role="grid"]')
    expect(grid).not.toBeNull()
    expect(grid.getAttribute('aria-label')).toBeTruthy() // bound to title()
    expect(api.$$('[role="columnheader"]')).toHaveLength(7)
    // one header row + one row per displayed week
    expect(api.$$('[role="row"]').length).toBeGreaterThanOrEqual(5)
    expect(api.$$('[role="gridcell"]').length).toBeGreaterThanOrEqual(28)
  })

  it('uses roving tabindex — exactly one day is tabbable, the rest are -1', async () => {
    const api = await load('date-picker.html')
    const tabbable = days(api).filter((b: Element) => b.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
    expect(days(api).filter((b: Element) => b.getAttribute('tabindex') === '-1').length).toBeGreaterThan(0)
  })

  it('binds aria-selected as the string "true" on the picked day, "false" elsewhere', async () => {
    const api = await load('date-picker.html')
    const focused = days(api).find((b: Element) => b.getAttribute('tabindex') === '0')!
    expect(focused).toBeTruthy()
    await api.click(focused)
    await api.sleep(20)
    expect(focused.getAttribute('aria-selected')).toBe('true')
    // regression: every other real day reports the literal "false", not "" / null
    const others = days(api).filter((b: Element) => b !== focused && !b.hasAttribute('disabled'))
    expect(others.length).toBeGreaterThan(0)
    expect(others.every((b: Element) => b.getAttribute('aria-selected') === 'false')).toBe(true)
  })

  it('moves focus + roving tabindex with ArrowRight (next day) and ArrowDown (next week)', async () => {
    const api = await load('date-picker.html')
    const start = days(api).find((b: Element) => b.getAttribute('tabindex') === '0')!
    const startIso = start.getAttribute('data-iso')!

    press(api, start, 'ArrowRight')
    await api.sleep(30)
    const rightIso = addDays(startIso, 1)
    const right = api.$(`[data-iso="${rightIso}"]`)
    expect(right).not.toBeNull()
    expect(active(api)).toBe(right)
    expect(right.getAttribute('tabindex')).toBe('0')
    expect(api.$(`[data-iso="${startIso}"]`)?.getAttribute('tabindex')).toBe('-1')

    press(api, right, 'ArrowDown')
    await api.sleep(30)
    const downIso = addDays(rightIso, 7)
    const down = api.$(`[data-iso="${downIso}"]`)
    expect(down).not.toBeNull()
    expect(active(api)).toBe(down)
    expect(down.getAttribute('tabindex')).toBe('0')
  })
})
