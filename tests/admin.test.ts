/**
 * tests/admin.test.ts — the flagship admin demo (site/admin/index.html).
 *
 * Loads the REAL admin page through the bench harness (against the built
 * bundle) and drives it like a user: filters, sorting, pagination, the
 * create/edit slide-over with validation, delete confirmation, and the
 * dashboard / detail views. Zero re-implementation — this is the exact
 * artifact shipped, so the tests fail if the demo regresses.
 *
 * The page loads Tailwind via the Play CDN; that <script src> can't run in
 * happy-dom and its inline `tailwind.config = …` throws "tailwind is not
 * defined". That single error is styling-only and filtered out — every other
 * error must be empty (i.e. Micra mounted clean).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
// @ts-expect-error — plain ESM harness helper, no .d.ts
import { loadPage } from '../bench-llm/lib/loadPage.mjs'
// @ts-expect-error — plain ESM harness helper, no .d.ts
import { normalizeMicraLoading } from '../bench-llm/lib/extract.mjs'

async function load() {
  const raw = readFileSync(join(process.cwd(), 'site', 'admin', 'index.html'), 'utf8')
  const { html } = normalizeMicraLoading(raw)
  return loadPage(html)
}

// Errors other than the (expected) Tailwind Play-CDN config failure.
const realErrors = (api: any) => api.errors.filter((e: string) => !/tailwind/i.test(e))
const inst = (api: any) => api.window.Micra.instances().get(api.$('[data-component="admin"]'))
const rows = (api: any) => api.$$('[data-component="admin"] tbody tr')
const rowName = (tr: any) => tr.querySelector('td button')?.textContent?.trim()
const rowCell = (tr: any, i: number) => tr.querySelectorAll('td')[i]?.textContent?.trim()
const rowBtn = (tr: any, label: string) =>
  [...tr.querySelectorAll('button')].find((b: any) => b.textContent.trim() === label)

describe('admin demo — mount', () => {
  it('mounts cleanly and renders the first page of users', async () => {
    const api = await load()
    expect(realErrors(api)).toEqual([])
    expect(rows(api)).toHaveLength(8) // pageSize 8 of 11 users
    expect(rowName(rows(api)[0])).toBe('Ada Lovelace') // default sort: name asc
  })
})

describe('admin demo — filters', () => {
  it('search narrows by name/email and shows an empty state for no matches', async () => {
    const api = await load()
    await api.type(api.$('[data-model="query"]'), 'esha')
    expect(rows(api)).toHaveLength(1)
    expect(rowName(rows(api)[0])).toBe('Esha Patel')

    await api.type(api.$('[data-model="query"]'), 'zzzzz')
    expect(rows(api)).toHaveLength(0)
    expect(api.$('[data-component="admin"]').textContent).toMatch(/no users match/i)
  })

  it('the role dropdown filters to a single role', async () => {
    const api = await load()
    await api.type(api.$('[data-model="role"]'), 'Viewer')
    const names = rows(api).map(rowName)
    expect(names).toEqual(['Carol White', 'Greta Lindberg', 'Jamal Carter'])
  })

  it('the status dropdown filters to a single status', async () => {
    const api = await load()
    await api.type(api.$('[data-model="status"]'), 'suspended')
    const names = rows(api).map(rowName).sort()
    expect(names).toEqual(['Finn O’Brien', 'Jamal Carter'])
  })

  it('combines search + role + status', async () => {
    const api = await load()
    await api.type(api.$('[data-model="role"]'), 'Admin')
    await api.type(api.$('[data-model="query"]'), 'ada')
    expect(rows(api)).toHaveLength(1)
    expect(rowName(rows(api)[0])).toBe('Ada Lovelace')
  })
})

describe('admin demo — sorting', () => {
  it('toggles sort direction and reflects it in aria-sort', async () => {
    const api = await load()
    await api.click(api.button(/^name/i)) // header is already sortKey=name asc → toggles desc
    expect(rowName(rows(api)[0])).toBe('Kira Novak') // last alphabetically
    expect(api.$('th[data-key="name"]').getAttribute('aria-sort')).toBe('descending')
  })
})

describe('admin demo — pagination', () => {
  it('pages through the filtered+sorted rows', async () => {
    const api = await load()
    expect(rows(api)).toHaveLength(8)
    await api.click(api.button(/^next$/i))
    expect(rows(api)).toHaveLength(3) // 9–11 of 11
    expect(api.$('[data-component="admin"]').textContent).toMatch(/9.11 of 11/)
  })
})

describe('admin demo — create / edit / delete', () => {
  it('rejects an empty form with validation messages', async () => {
    const api = await load()
    await api.click(api.button(/add user/i))
    await api.submit(api.$('#user-form form'))
    const panel = api.$('#user-form').textContent
    expect(panel).toMatch(/name is required/i)
    expect(panel).toMatch(/enter a valid email/i)
    expect(inst(api).state.formOpen).toBe(true) // stays open on error
  })

  it('creates a user via the slide-over', async () => {
    const api = await load()
    await api.click(api.button(/add user/i))
    await api.type(api.$('#user-form [data-model="form.name"]'), 'Aaron Test')
    await api.type(api.$('#user-form [data-model="form.email"]'), 'aaron@example.com')
    await api.submit(api.$('#user-form form'))
    expect(inst(api).state.users).toHaveLength(12)
    expect(inst(api).state.formOpen).toBe(false)
    expect(rowName(rows(api)[0])).toBe('Aaron Test') // sorts first
  })

  it('edits an existing user', async () => {
    const api = await load()
    await api.click(rowBtn(rows(api)[0], 'Edit')) // first row = Ada
    expect((api.$('#user-form [data-model="form.name"]') as any).value).toBe('Ada Lovelace')
    await api.type(api.$('#user-form [data-model="form.name"]'), 'Ada Edited')
    await api.submit(api.$('#user-form form'))
    expect(rowName(rows(api)[0])).toBe('Ada Edited')
  })

  it('deletes a user through the confirmation dialog', async () => {
    const api = await load()
    await api.click(rowBtn(rows(api)[0], 'Delete'))
    expect(inst(api).state.confirmOpen).toBe(true)
    const confirmBtn = [...api.$$('#delete-dialog button')].find(
      (b: any) => b.textContent.trim() === 'Delete',
    )
    await api.click(confirmBtn)
    expect(inst(api).state.users).toHaveLength(10)
    expect(inst(api).state.confirmOpen).toBe(false)
  })
})

describe('admin demo — views', () => {
  it('switches to the dashboard with stat cards and recent signups', async () => {
    const api = await load()
    await api.click(api.button(/dashboard/i)) // sidebar nav link
    expect(inst(api).state.view).toBe('dashboard')
    expect(rows(api)).toHaveLength(0) // users table detached via data-if
    expect(api.$$('[data-component="admin"] ul li')).toHaveLength(5) // recent signups
    expect(api.$('header h1').textContent).toBe('Dashboard')
  })

  it('opens a user detail view with role and status rendered', async () => {
    const api = await load()
    await api.click(rows(api)[0].querySelector('td button')) // click the name → openDetail
    expect(inst(api).state.view).toBe('detail')
    const dl = api.$('[data-component="admin"] dl')
    expect(dl).not.toBeNull()
    // guards the cap()/initials() regression — empty would mean the helper threw
    expect(dl.textContent).toContain('Admin')
    expect(dl.textContent).toContain('Active')
  })

  it('drills from a dashboard metric into the filtered users list', async () => {
    const api = await load()
    await api.click(api.button(/dashboard/i))
    const activeCard = api
      .$$('[data-component="admin"] button')
      .find((b: any) => b.textContent.includes('Active'))
    await api.click(activeCard) // @click="drill('all', 'active')"
    expect(inst(api).state.view).toBe('users')
    expect(inst(api).state.status).toBe('active')
    expect(inst(api).filtered().every((u: any) => u.status === 'active')).toBe(true)
  })

  it('opens detail from a recent-signup row on the dashboard', async () => {
    const api = await load()
    await api.click(api.button(/dashboard/i))
    await api.click(api.$('[data-component="admin"] ul li')) // @click="openDetail"
    expect(inst(api).state.view).toBe('detail')
    expect(inst(api).state.detail.name).toBeTruthy()
  })
})

describe('admin demo — customers', () => {
  it('renders a card grid and filters by search', async () => {
    const api = await load()
    await api.click(api.button(/customers/i))
    expect(inst(api).state.view).toBe('customers')
    expect(api.$('[data-component="admin"]').textContent).toContain('Northwind Traders')
    await api.type(api.$('[data-model="customerQuery"]'), 'globex')
    expect(inst(api).filteredCustomers().map((c: any) => c.name)).toEqual(['Globex'])
    const text = api.$('[data-component="admin"]').textContent
    expect(text).toContain('Globex')
    expect(text).not.toContain('Northwind Traders')
  })
})

describe('admin demo — settings', () => {
  it('toggles a setting and saves with a toast', async () => {
    const api = await load()
    await api.click(api.button(/settings/i))
    expect(inst(api).state.view).toBe('settings')
    const before = inst(api).state.settings.notifications
    await api.click(api.$$('[role="switch"]')[0]) // @click="toggleSetting('notifications')"
    expect(inst(api).state.settings.notifications).toBe(!before)
    await api.submit(api.$('main form')) // @submit.prevent="saveSettings"
    expect(inst(api).state.toast).toMatch(/saved settings/i)
  })
})
