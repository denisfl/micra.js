/**
 * tests/recipes-and-table.test.ts — Data component (Table) + 6 recipes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '../src/core/mount'
import { registry, instances } from '../src/core/registry'

beforeEach(() => {
  ;(registry() as Map<string, unknown>).clear()
  ;(instances() as Map<HTMLElement, unknown>).clear()
  document.body.innerHTML = ''
})

afterEach(() => vi.unstubAllGlobals())

function mountIn(html: string, def: object) {
  const wrap = document.createElement('div')
  wrap.innerHTML = html.trim()
  const root = wrap.firstElementChild as HTMLElement
  document.body.appendChild(root)
  return { root, inst: mount(root, def as never) as never }
}

const tick = () => Promise.resolve()

// ── Table ─────────────────────────────────────────────────────────────────────

describe('Table (table-demo)', () => {
  type Row = { id: number; name: string; signups: number }
  const def = {
    state: {
      rows: [
        { id: 1, name: 'Charlie', signups: 50 },
        { id: 2, name: 'Alice',   signups: 200 },
        { id: 3, name: 'Bob',     signups: 100 },
        { id: 4, name: 'Dave',    signups: 10 },
        { id: 5, name: 'Eve',     signups: 75 },
      ] as Row[],
      sortKey: 'name',
      sortDir: 'asc',
      page: 0,
      pageSize: 2,
    },
    sorted() {
      const self = this as never as { state: { rows: Row[]; sortKey: string; sortDir: string } }
      const { rows, sortKey, sortDir } = self.state
      const mult = sortDir === 'asc' ? 1 : -1
      return [...rows].sort((a, b) => {
        const av = (a as never as Record<string, number | string>)[sortKey]!
        const bv = (b as never as Record<string, number | string>)[sortKey]!
        return (av > bv ? 1 : av < bv ? -1 : 0) * mult
      })
    },
    visible() {
      const self = this as never as { state: { page: number; pageSize: number }; sorted: () => Row[] }
      const { page, pageSize } = self.state
      return self.sorted().slice(page * pageSize, (page + 1) * pageSize)
    },
    pageCount() {
      const self = this as never as { state: { rows: Row[]; pageSize: number } }
      return Math.max(1, Math.ceil(self.state.rows.length / self.state.pageSize))
    },
    sortBy(e: Event) {
      const self = this as never as { state: { sortKey: string; sortDir: string; page: number } }
      const key = (e.currentTarget as HTMLElement).dataset['key']!
      if (self.state.sortKey === key) self.state.sortDir = self.state.sortDir === 'asc' ? 'desc' : 'asc'
      else { self.state.sortKey = key; self.state.sortDir = 'asc' }
      self.state.page = 0
    },
    prev() { const s = (this as never as { state: { page: number } }).state; if (s.page > 0) s.page-- },
    next() {
      const self = this as never as { state: { page: number }; pageCount: () => number }
      if (self.state.page < self.pageCount() - 1) self.state.page++
    },
  }

  it('sorted() returns ascending by default and doesn\'t mutate rows', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { rows: Row[] }; sorted: () => Row[] } }
    const before = inst.state.rows.map(r => r.name)
    expect(inst.sorted().map(r => r.name)).toEqual(['Alice', 'Bob', 'Charlie', 'Dave', 'Eve'])
    expect(inst.state.rows.map(r => r.name)).toEqual(before)   // unchanged
  })

  it('sortBy() toggles direction on same key; resets to asc on new key', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { sortKey: string; sortDir: string }; sortBy: (e: Event) => void } }
    const th = (k: string) => { const el = document.createElement('th'); el.dataset['key'] = k; return el }
    inst.sortBy({ currentTarget: th('name') } as never)
    expect(inst.state.sortDir).toBe('desc')
    inst.sortBy({ currentTarget: th('signups') } as never)
    expect(inst.state.sortKey).toBe('signups')
    expect(inst.state.sortDir).toBe('asc')
  })

  it('visible() paginates derived rows; pageCount() reflects size', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { page: number }; visible: () => Row[]; pageCount: () => number } }
    expect(inst.pageCount()).toBe(3) // 5 / 2 = 3 pages
    expect(inst.visible().map(r => r.name)).toEqual(['Alice', 'Bob'])
    inst.state.page = 1
    expect(inst.visible().map(r => r.name)).toEqual(['Charlie', 'Dave'])
    inst.state.page = 2
    expect(inst.visible().map(r => r.name)).toEqual(['Eve'])
  })

  it('prev() / next() clamp at bounds', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { page: number }; prev: () => void; next: () => void } }
    inst.prev()
    expect(inst.state.page).toBe(0)
    inst.next(); inst.next(); inst.next(); inst.next()
    expect(inst.state.page).toBe(2) // can't go past pageCount - 1
  })
})

// ── Recipe: todo-app ──────────────────────────────────────────────────────────

describe('Recipe: todo-app', () => {
  type Todo = { id: string; text: string; done: boolean }
  let storage = new Map<string, string>()

  beforeEach(() => {
    storage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v) },
      removeItem: (k: string) => { storage.delete(k) },
      clear: () => storage.clear(),
    })
  })

  function makeDef() {
    return {
      state: {
        todos: JSON.parse((globalThis as never as { localStorage: { getItem: (k: string) => string | null } }).localStorage.getItem('todos') || '[]') as Todo[],
        newTask: '',
        filter: 'all' as 'all' | 'active' | 'done',
      },
      filtered() {
        const self = this as never as { state: { todos: Todo[]; filter: string } }
        const { todos, filter } = self.state
        if (filter === 'active') return todos.filter(t => !t.done)
        if (filter === 'done')   return todos.filter(t => t.done)
        return todos
      },
      hasDone() { return (this as never as { state: { todos: Todo[] } }).state.todos.some(t => t.done) },
      save() {
        const self = this as never as { state: { todos: Todo[] } }
        ;(globalThis as never as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage.setItem('todos', JSON.stringify(self.state.todos))
      },
      nextId() { return Math.random().toString(36).slice(2) },
      itemId(e: Event) { return (e.currentTarget as HTMLElement).closest('[data-id]')!.getAttribute('data-id')! },
      addTask() {
        const self = this as never as { state: { newTask: string; todos: Todo[] }; nextId: () => string; save: () => void }
        const text = self.state.newTask.trim()
        if (!text) return
        self.state.todos = [{ id: self.nextId(), text, done: false }, ...self.state.todos]
        self.state.newTask = ''
        self.save()
      },
      toggleItem(e: Event) {
        const self = this as never as { state: { todos: Todo[] }; itemId: (e: Event) => string; save: () => void }
        const id = self.itemId(e)
        self.state.todos = self.state.todos.map(t => t.id === id ? { ...t, done: !t.done } : t)
        self.save()
      },
      remove(e: Event) {
        const self = this as never as { state: { todos: Todo[] }; itemId: (e: Event) => string; save: () => void }
        const id = self.itemId(e)
        self.state.todos = self.state.todos.filter(t => t.id !== id)
        self.save()
      },
      clearDone() {
        const self = this as never as { state: { todos: Todo[] }; save: () => void }
        self.state.todos = self.state.todos.filter(t => !t.done)
        self.save()
      },
    }
  }

  it('addTask() prepends a new todo and clears newTask + persists', () => {
    const { inst } = mountIn('<div></div>', makeDef()) as { inst: { state: { newTask: string; todos: Todo[] }; addTask: () => void } }
    inst.state.newTask = 'Buy milk'
    inst.addTask()
    expect(inst.state.todos.length).toBe(1)
    expect(inst.state.todos[0]!.text).toBe('Buy milk')
    expect(inst.state.newTask).toBe('')
    expect(JSON.parse(storage.get('todos')!).length).toBe(1)
  })

  it('addTask() with blank input is a no-op', () => {
    const { inst } = mountIn('<div></div>', makeDef()) as { inst: { state: { newTask: string; todos: Todo[] }; addTask: () => void } }
    inst.state.newTask = '   '
    inst.addTask()
    expect(inst.state.todos.length).toBe(0)
  })

  it('filtered() respects the filter; clearDone() removes only completed', () => {
    const { inst } = mountIn('<div></div>', makeDef()) as { inst: { state: { todos: Todo[]; filter: string }; filtered: () => Todo[]; clearDone: () => void; hasDone: () => boolean } }
    inst.state.todos = [
      { id: '1', text: 'a', done: false },
      { id: '2', text: 'b', done: true },
      { id: '3', text: 'c', done: true },
    ]
    expect(inst.hasDone()).toBe(true)
    inst.state.filter = 'done'
    expect(inst.filtered().map(t => t.id)).toEqual(['2', '3'])
    inst.state.filter = 'active'
    expect(inst.filtered().map(t => t.id)).toEqual(['1'])
    inst.clearDone()
    expect(inst.state.todos.map(t => t.id)).toEqual(['1'])
  })

  it('toggleItem() / remove() locate row by data-id via closest', () => {
    const { root, inst } = mountIn('<div></div>', makeDef()) as { root: HTMLElement; inst: { state: { todos: Todo[]; newTask: string }; addTask: () => void; toggleItem: (e: Event) => void; remove: (e: Event) => void } }
    inst.state.newTask = 'a'; inst.addTask()
    const id = inst.state.todos[0]!.id
    root.innerHTML = `<div data-id="${id}"><button id="x"></button></div>`
    const btn = root.querySelector('#x')!
    inst.toggleItem({ currentTarget: btn } as never)
    expect(inst.state.todos[0]!.done).toBe(true)
    inst.remove({ currentTarget: btn } as never)
    expect(inst.state.todos.length).toBe(0)
  })
})

// ── Recipe: SSE (live-price) ──────────────────────────────────────────────────

describe('Recipe: SSE (live-price)', () => {
  let latest: FakeEventSource | null = null
  class FakeEventSource {
    onopen: ((e: Event) => void) | null = null
    onmessage: ((e: MessageEvent) => void) | null = null
    onerror: ((e: Event) => void) | null = null
    closed = false
    constructor(public url: string) { latest = this }
    close() { this.closed = true }
  }
  beforeEach(() => {
    latest = null
    vi.stubGlobal('EventSource', FakeEventSource)
  })

  const def = {
    state: { price: 0, status: 'connecting' as string },
    onCreate() {
      const self = this as never as { _es: FakeEventSource; state: { price: number; status: string } }
      // @ts-expect-error stubGlobal
      self._es = new EventSource('/api/prices/stream') as FakeEventSource
      self._es.onopen    = () => { self.state.status = 'live' }
      self._es.onmessage = (e: MessageEvent) => { self.state.price = JSON.parse(e.data).price }
      self._es.onerror   = () => { self.state.status = 'reconnecting' }
    },
    onDestroy() {
      const self = this as never as { _es: FakeEventSource }
      self._es?.close()
    },
  }

  it('opens an EventSource on the documented URL', async () => {
    mountIn('<div></div>', def)
    await tick()
    expect(latest!.url).toBe('/api/prices/stream')
  })

  it('onopen → status="live"; onmessage → price = payload.price', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; price: number } } }
    await tick()
    latest!.onopen!(new Event('open'))
    expect(inst.state.status).toBe('live')
    latest!.onmessage!({ data: JSON.stringify({ price: 42.5 }) } as MessageEvent)
    expect(inst.state.price).toBe(42.5)
  })

  it('onerror → status="reconnecting" (NOT close — EventSource auto-retries)', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string } } }
    await tick()
    latest!.onerror!(new Event('error'))
    expect(inst.state.status).toBe('reconnecting')
    expect(latest!.closed).toBe(false)
  })

  it('destroy() closes the stream', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { destroy: () => void } }
    await tick()
    inst.destroy()
    expect(latest!.closed).toBe(true)
  })
})

// ── Recipe: form-validation (signup-recipe) ───────────────────────────────────

describe('Recipe: form-validation', () => {
  function mockFetch(handler: (url: string, init: RequestInit) => Promise<Response>) {
    vi.stubGlobal('fetch', vi.fn((u: string, init: RequestInit) => handler(u, init)))
  }

  const def = {
    state: { name: '', email: '', password: '', errors: {} as Record<string, string>, status: 'idle' as string },
    errorFor(field: string) { return (this as never as { state: { errors: Record<string, string> } }).state.errors[field] || '' },
    async submit() {
      const self = this as never as { state: { name: string; email: string; password: string; errors: Record<string, string>; status: string }; fetch: (url: string, opts?: object) => Promise<unknown> }
      self.state.status = 'submitting'
      self.state.errors = {}
      try {
        await self.fetch('/api/signup', {
          method: 'POST',
          body: { name: self.state.name, email: self.state.email, password: self.state.password },
        })
        self.state.status = 'success'
      } catch (e) {
        const err = e as { status?: number; response?: Response }
        if (err.status === 422) {
          const body = await err.response!.json().catch(() => ({}))
          self.state.errors = (body as { errors?: Record<string, string> }).errors || {}
          self.state.status = 'idle'
        } else {
          self.state.status = 'error'
        }
      }
    },
  }

  it('success path: 200 → status="success", no errors', async () => {
    mockFetch(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }))
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; errors: Record<string, string> }; submit: () => Promise<void> } }
    await inst.submit()
    expect(inst.state.status).toBe('success')
    expect(inst.state.errors).toEqual({})
  })

  it('422 path: parses e.response.json() into state.errors', async () => {
    mockFetch(async () => new Response(JSON.stringify({ errors: { email: 'is taken' } }), {
      status: 422, headers: { 'content-type': 'application/json' },
    }))
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; errors: Record<string, string> }; errorFor: (k: string) => string; submit: () => Promise<void> } }
    await inst.submit()
    expect(inst.state.status).toBe('idle')
    expect(inst.errorFor('email')).toBe('is taken')
  })

  it('500 path: generic "error" banner', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }))
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; errors: Record<string, string> }; submit: () => Promise<void> } }
    await inst.submit()
    expect(inst.state.status).toBe('error')
  })

  it('submit() always clears stale errors before re-validating', async () => {
    mockFetch(async () => new Response(JSON.stringify({ errors: { email: 'bad' } }), {
      status: 422, headers: { 'content-type': 'application/json' },
    }))
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { errors: Record<string, string> }; submit: () => Promise<void> } }
    inst.state.errors = { stale: 'previous run' }
    await inst.submit()
    expect(inst.state.errors).toEqual({ email: 'bad' })
    expect(inst.state.errors['stale']).toBeUndefined()
  })
})

// ── Recipe: search-debounce ───────────────────────────────────────────────────

describe('Recipe: search-debounce', () => {
  type Row = { code: string; name: string }
  const COUNTRIES: Row[] = [
    { code: 'AR', name: 'Argentina' },
    { code: 'BR', name: 'Brazil' },
    { code: 'DE', name: 'Germany' },
    { code: 'JP', name: 'Japan' },
  ]

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => new Promise<Response>((resolve, reject) => {
      const q = new URL('http://x' + url).searchParams.get('q') || ''
      const t = setTimeout(() => resolve(new Response(
        JSON.stringify(COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase()))),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )), 350)
      init.signal?.addEventListener('abort', () => {
        clearTimeout(t)
        const err = new Error('aborted'); (err as { name: string }).name = 'AbortError'
        reject(err)
      })
    })))
  })
  afterEach(() => vi.useRealTimers())

  const def = {
    state: { query: '', results: [] as Row[], status: 'idle' as string },
    onDestroy() {
      const self = this as never as { _timer?: ReturnType<typeof setTimeout>; _controller?: AbortController }
      if (self._timer) clearTimeout(self._timer)
      self._controller?.abort()
    },
    onInput(e: Event) {
      const self = this as never as { state: { query: string; results: Row[]; status: string }; _timer?: ReturnType<typeof setTimeout>; _controller?: AbortController; _search: () => void }
      self.state.query = (e.target as HTMLInputElement).value
      if (self._timer) clearTimeout(self._timer)
      if (!self.state.query.trim()) {
        self._controller?.abort()
        self.state.results = []
        self.state.status = 'idle'
        return
      }
      self.state.status = 'loading'
      self._timer = setTimeout(() => self._search(), 300)
    },
    async _search() {
      const self = this as never as { state: { query: string; results: Row[]; status: string }; _controller?: AbortController; fetch: (url: string, opts: object) => Promise<Row[]> }
      self._controller?.abort()
      self._controller = new AbortController()
      try {
        const rows = await self.fetch('/api/countries?q=' + encodeURIComponent(self.state.query), { signal: self._controller.signal })
        self.state.results = rows
        self.state.status = rows.length ? 'done' : 'empty'
      } catch (e) {
        if ((e as { name: string }).name === 'AbortError') return
        self.state.status = 'idle'
      }
    },
  }

  function input(value: string) {
    const i = document.createElement('input')
    i.value = value
    return i
  }

  it('debounces 300ms then resolves with filtered rows', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; results: Row[] }; onInput: (e: Event) => void } }
    inst.onInput({ target: input('ger') } as never)
    expect(inst.state.status).toBe('loading')
    await vi.advanceTimersByTimeAsync(300)   // debounce fires
    await vi.advanceTimersByTimeAsync(350)   // fetch resolves
    expect(inst.state.status).toBe('done')
    expect(inst.state.results.map(r => r.name)).toEqual(['Germany'])
  })

  it('a second keystroke aborts the in-flight request', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; results: Row[] }; onInput: (e: Event) => void; _controller?: AbortController } }
    inst.onInput({ target: input('arg') } as never)         // would match Argentina
    await vi.advanceTimersByTimeAsync(300)                  // debounce fires → fetch1
    inst.onInput({ target: input('japa') } as never)        // would match Japan
    await vi.advanceTimersByTimeAsync(300)                  // debounce 2 → fetch1 aborted, fetch2 starts
    await vi.advanceTimersByTimeAsync(400)                  // fetch2 resolves (350ms)
    expect(inst.state.results.map(r => r.name)).toEqual(['Japan'])
  })

  it('empty query clears results and goes to idle', () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { status: string; results: Row[] }; onInput: (e: Event) => void } }
    inst.state.results = [{ code: 'JP', name: 'Japan' }]
    inst.onInput({ target: input('   ') } as never)
    expect(inst.state.status).toBe('idle')
    expect(inst.state.results).toEqual([])
  })
})

// ── Recipe: optimistic-updates ────────────────────────────────────────────────

describe('Recipe: optimistic-updates', () => {
  type Post = { id: string; liked: boolean; likes: number }

  function makeDef(succeed: boolean) {
    return {
      state: { items: [{ id: 'p1', liked: false, likes: 10 }] as Post[] },
      async toggleLike(e: Event) {
        const self = this as never as { state: { items: Post[] }; fetch: (url: string, opts: object) => Promise<unknown>; emit: (e: string, p?: unknown) => void }
        const id = (e.currentTarget as HTMLElement).dataset['id']!
        const snapshot = self.state.items
        self.state.items = self.state.items.map(p =>
          p.id === id ? { ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) } : p,
        )
        try {
          if (!succeed) throw new Error('boom')
          await Promise.resolve()
        } catch {
          self.state.items = snapshot
          self.emit('toast', { title: 'Could not save', severity: 'error' })
        }
      },
    }
  }

  function btn(id: string) {
    const b = document.createElement('button'); b.dataset['id'] = id; return b
  }

  it('success: state stays at the optimistic value', async () => {
    const { inst } = mountIn('<div></div>', makeDef(true)) as { inst: { state: { items: Post[] }; toggleLike: (e: Event) => Promise<void> } }
    await inst.toggleLike({ currentTarget: btn('p1') } as never)
    expect(inst.state.items[0]!.liked).toBe(true)
    expect(inst.state.items[0]!.likes).toBe(11)
  })

  it('failure: state rolls back to the snapshot', async () => {
    const { inst } = mountIn('<div></div>', makeDef(false)) as { inst: { state: { items: Post[] }; toggleLike: (e: Event) => Promise<void> } }
    await inst.toggleLike({ currentTarget: btn('p1') } as never)
    expect(inst.state.items[0]!.liked).toBe(false)
    expect(inst.state.items[0]!.likes).toBe(10)
  })

  it('snapshot identity: rollback restores the exact previous array reference', async () => {
    const { inst } = mountIn('<div></div>', makeDef(false)) as { inst: { state: { items: Post[] }; toggleLike: (e: Event) => Promise<void> } }
    const before = inst.state.items
    await inst.toggleLike({ currentTarget: btn('p1') } as never)
    expect(inst.state.items).toBe(before)
  })
})

// ── Recipe: routing (URL sync) ────────────────────────────────────────────────

describe('Recipe: routing', () => {
  beforeEach(() => {
    window.location.hash = ''
  })

  const def = {
    state: { route: 'home', filter: 'all', url: '#/home' },
    onCreate() {
      const self = this as never as { _sync: () => void; _readUrl: () => void }
      self._sync = () => self._readUrl()
      window.addEventListener('hashchange', self._sync)
      window.addEventListener('popstate', self._sync)
      self._readUrl()
    },
    onDestroy() {
      const self = this as never as { _sync: () => void }
      window.removeEventListener('hashchange', self._sync)
      window.removeEventListener('popstate', self._sync)
    },
    _readUrl() {
      const self = this as never as { state: { route: string; filter: string; url: string } }
      const hash = window.location.hash.slice(1) || '/home'
      const [path, qs] = hash.split('?')
      const route = (path!.replace(/^\//, '') || 'home').split('/')[0]!
      const params = new URLSearchParams(qs || '')
      const filter = params.get('filter') || 'all'
      self.state.route  = ['home', 'projects', 'settings'].includes(route) ? route : 'home'
      self.state.filter = ['all', 'active', 'archived'].includes(filter) ? filter : 'all'
      self.state.url    = '#' + (window.location.hash.slice(1) || '/home')
    },
    _writeUrl(route: string, filter: string) {
      const qs = filter !== 'all' ? '?filter=' + encodeURIComponent(filter) : ''
      const next = '#/' + route + qs
      if (window.location.hash !== next) window.location.hash = next
    },
    navigate(e: Event) {
      const self = this as never as { state: { filter: string }; _writeUrl: (r: string, f: string) => void }
      self._writeUrl((e.currentTarget as HTMLElement).dataset['route']!, self.state.filter)
    },
    setFilter(e: Event) {
      const self = this as never as { state: { route: string }; _writeUrl: (r: string, f: string) => void }
      self._writeUrl(self.state.route, (e.currentTarget as HTMLElement).dataset['filter']!)
    },
  }

  function btn(attr: 'route' | 'filter', val: string) {
    const b = document.createElement('button')
    b.dataset[attr] = val
    return b
  }

  it('initial _readUrl falls back to home / all when hash is empty', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { route: string; filter: string } } }
    await tick()
    expect(inst.state.route).toBe('home')
    expect(inst.state.filter).toBe('all')
  })

  // Happy-dom doesn't always fire hashchange on programmatic hash assignment.
  // We test the read/write pair directly (which is what the listener calls
  // anyway) — this still exercises the same logic and the same state pipeline.
  it('navigate() writes URL; calling _readUrl mirrors it into state', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { route: string }; navigate: (e: Event) => void; _readUrl: () => void } }
    await tick()
    inst.navigate({ currentTarget: btn('route', 'projects') } as never)
    expect(window.location.hash).toBe('#/projects')
    inst._readUrl()
    expect(inst.state.route).toBe('projects')
  })

  it('setFilter() encodes filter into querystring; default "all" is omitted', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { route: string; filter: string }; navigate: (e: Event) => void; setFilter: (e: Event) => void; _readUrl: () => void } }
    await tick()
    inst.navigate({ currentTarget: btn('route', 'projects') } as never)
    inst._readUrl()
    inst.setFilter({ currentTarget: btn('filter', 'archived') } as never)
    inst._readUrl()
    expect(window.location.hash).toBe('#/projects?filter=archived')
    expect(inst.state.filter).toBe('archived')

    inst.setFilter({ currentTarget: btn('filter', 'all') } as never)
    inst._readUrl()
    expect(window.location.hash).toBe('#/projects')
    expect(inst.state.filter).toBe('all')
  })

  it('unknown route falls back to home (whitelist guard)', async () => {
    const { inst } = mountIn('<div></div>', def) as { inst: { state: { route: string }; _readUrl: () => void } }
    await tick()
    window.location.hash = '#/admin'
    inst._readUrl()
    expect(inst.state.route).toBe('home')
  })
})
