/**
 * tests/perf.test.ts — Performance tests (section 11)
 *
 * These are "timing budget" tests — they check that operations complete
 * within a generous threshold, not exact timing. On CI/slow machines they
 * will always pass since we use large budgets (10× expected).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '../src/core/mount'
import { instances } from '../src/core/registry'

beforeEach(() => {
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

// Build a root with N keyed rows
function buildRoot(n: number) {
  const root = document.createElement('div')
  const tmpl = document.createElement('template')
  tmpl.setAttribute('data-each', 'items')
  tmpl.setAttribute('data-key', 'id')
  tmpl.innerHTML = `<div><span data-text="item.name"></span></div>`
  root.appendChild(tmpl)
  document.body.appendChild(root)
  return root
}

// Build a root with N rows but no data-key — exercises the positional-reuse path.
function buildNoKeyRoot(_n: number) {
  const root = document.createElement('div')
  const tmpl = document.createElement('template')
  tmpl.setAttribute('data-each', 'items')
  tmpl.innerHTML = `<div><span data-text="item.name"></span></div>`
  root.appendChild(tmpl)
  document.body.appendChild(root)
  return root
}

function makeItems(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))
}

// ── 11.1 Render time ──────────────────────────────────────────────────────────

describe('11.1 render time', () => {
  it('100 items render < 200ms', async () => {
    const root = buildRoot(100)
    const t0 = performance.now()
    const inst = mount(root, { state: { items: makeItems(100) } })!
    await Promise.resolve()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(200)
  })

  it('500 items render < 1000ms', async () => {
    const root = buildRoot(500)
    const t0 = performance.now()
    mount(root, { state: { items: makeItems(500) } })
    await Promise.resolve()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(1000)
  })

  it('100-item keyed re-render (all updated) < 200ms', async () => {
    const root = buildRoot(100)
    const inst = mount(root, { state: { items: makeItems(100) } })!
    await Promise.resolve()

    const t0 = performance.now()
    inst.state.items = makeItems(100).map(it => ({ ...it, name: `Updated ${it.id}` }))
    await Promise.resolve()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(200)
  })

  it('500-item keyed re-render (all reversed) < 500ms', async () => {
    const root = buildRoot(500)
    const inst = mount(root, { state: { items: makeItems(500) } })!
    await Promise.resolve()

    const t0 = performance.now()
    inst.state.items = [...makeItems(500)].reverse()
    await Promise.resolve()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(500)
  })

  it('500-item non-keyed re-render (positional reuse, all updated) < 200ms', async () => {
    // Pins the positional-reuse win for non-keyed lists. Before B5 this
    // path removed and re-cloned every node — same operation took >500ms
    // for 500 rows. With reuse the budget is the keyed-update budget.
    const root = buildNoKeyRoot(500)
    const inst = mount(root, { state: { items: makeItems(500) } })!
    await Promise.resolve()

    const t0 = performance.now()
    inst.state.items = makeItems(500).map(it => ({ ...it, name: `Updated ${it.id}` }))
    await Promise.resolve()
    const elapsed = performance.now() - t0
    expect(elapsed).toBeLessThan(200)
  })
})

// ── 11.2 Scheduler batching ───────────────────────────────────────────────────

describe('11.2 scheduler batching', () => {
  it('10 rapid mutations → only 1 render call', async () => {
    const renderSpy = vi.fn()
    const root = document.createElement('div')
    document.body.appendChild(root)

    const inst = mount(root, {
      state: { a: 0, b: 0, c: 0, d: 0, e: 0 },
    })!

    // Patch render to count calls after mount
    const origRender = inst.render.bind(inst)
    inst.render = vi.fn(origRender)

    inst.state.a = 1
    inst.state.b = 2
    inst.state.c = 3
    inst.state.d = 4
    inst.state.e = 5
    inst.state.a = 6
    inst.state.b = 7
    inst.state.c = 8
    inst.state.d = 9
    inst.state.e = 10

    await Promise.resolve()
    expect((inst.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeLessThanOrEqual(1)
  })
})
