/**
 * tests/recipe-resource.test.ts — the data `resource()` recipe.
 *
 * Loads the real recipe demo (site/recipes/data-resource.html) through the
 * bench harness and exercises the helper's lifecycle: loading → data → error,
 * plus refetch. The page ships its own `window.fetch` mock (a 120ms /api/users
 * stub), so this tests the exact artifact a user copies — no re-implementation.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — plain ESM harness helper, no .d.ts
import { loadPage } from '../bench-llm/lib/loadPage.mjs'
// @ts-expect-error — plain ESM harness helper, no .d.ts
import { normalizeMicraLoading } from '../bench-llm/lib/extract.mjs'

async function load() {
  const raw = readFileSync(join(process.cwd(), 'site', 'recipes', 'data-resource.html'), 'utf8')
  const { html } = normalizeMicraLoading(raw)
  return loadPage(html)
}

const rows = (api: any) => api.$$('[data-component="users-resource"] tbody tr')

describe('recipes/data-resource.html — resource() helper', () => {
  it('mounts cleanly and shows the loading state before data arrives', async () => {
    const api = await load()
    expect(api.errors).toEqual([])
    // resource() set loading synchronously in onCreate; the 120ms mock hasn't resolved yet
    const hint = api.$('[data-component="users-resource"] .hint')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/loading/i)
    expect(rows(api)).toHaveLength(0)
  })

  it('resolves to data: rows render and loading clears', async () => {
    const api = await load()
    await api.sleep(250) // past the 120ms mock
    expect(rows(api)).toHaveLength(4)
    expect(rows(api)[0].textContent).toContain('Ada Lovelace')
    // loading + error hints both gone once data is present
    expect(api.$('[data-component="users-resource"] .hint')).toBeNull()
  })

  it('refetch() re-runs the request and repopulates', async () => {
    const api = await load()
    await api.sleep(250)
    expect(rows(api)).toHaveLength(4)
    await api.click(api.button(/^reload$/i)) // @click="users.refetch()"
    // immediately back to loading
    await api.sleep(20)
    expect(api.$('[data-component="users-resource"] .hint')?.textContent).toMatch(/loading/i)
    await api.sleep(250)
    expect(rows(api)).toHaveLength(4)
  })

  it('surfaces the error state when the request fails', async () => {
    const api = await load()
    await api.sleep(250)
    await api.click(api.button(/simulate error/i)) // refetch({ fail: 1 }) → 500
    await api.sleep(250)
    const hint = api.$('[data-component="users-resource"] .hint')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/couldn't load/i)
    expect(rows(api)).toHaveLength(0)
  })
})
