/**
 * tasks.mjs — the 10 benchmark tasks: user-style prompts + assertion scripts.
 *
 * Prompts are phrased the way a real user asks, with concrete labels/data so
 * assertions have stable anchors. Assertions are deliberately markup-agnostic
 * (no required ids/classes) — they find controls by visible text and judge
 * behavior, not structure. Every assertion throws with a readable reason.
 *
 * Visibility model: Micra's data-if detaches nodes; data-show sets inline
 * display:none — `visible()` accounts for both.
 */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'])

/** Concatenated text of all VISIBLE text nodes. Hidden = data-if detached
 *  (not in DOM at all), computed display:none (inline OR stylesheet class —
 *  happy-dom resolves the cascade), visibility:hidden, or [hidden]. Text in
 *  script/style/template never counts. */
function visibleText(api) {
  const parts = []
  const isElHidden = el => {
    if (el.hasAttribute?.('hidden')) return true
    try {
      const cs = api.window.getComputedStyle(el)
      return cs.display === 'none' || cs.visibility === 'hidden'
    } catch {
      return el.style && el.style.display === 'none'
    }
  }
  const walk = (el, hidden) => {
    if (!el) return
    if (el.nodeType === 3) { if (!hidden) parts.push(el.textContent); return }
    if (SKIP_TAGS.has(el.tagName)) return
    const isHidden = hidden || isElHidden(el)
    for (const child of el.childNodes ?? []) walk(child, isHidden)
  }
  walk(api.document.body, false)
  return parts.join(' ').replace(/\s+/g, ' ')
}

function visible(api, pattern) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i')
  return re.test(visibleText(api))
}

function fail(msg) { throw new Error(msg) }

function inputOf(api) {
  return (
    api.$('input[type="text"]') ?? api.$('input:not([type])') ??
    api.$('input[type="search"]') ?? api.$('input[type="email"]') ?? api.$('input')
  )
}

export const tasks = [
  {
    id: 1,
    slug: 'counter',
    prompt:
      'Build a counter. It shows the current count (starting at 0), with a "+" button, a "−" button, and a "Reset" button.',
    async assert(load) {
      const api = await load()
      const plus = api.button(/^\s*[+]\s*$|increment|plus/) ?? fail('no "+" button found')
      const reset = api.button(/reset/) ?? fail('no Reset button found')
      // [^-\d] guards against sign-blind matches: "-1" must NOT count as "1"
      visible(api, /(^|[^-\d])0([^\d]|$)/) || fail('initial count 0 not shown')
      await api.click(plus)
      visible(api, /(^|[^-\d])1([^\d]|$)/) || fail('count did not become 1 after +')
      await api.click(plus)
      visible(api, /(^|[^-\d])2([^\d]|$)/) || fail('count did not become 2 after second +')
      await api.click(reset)
      visible(api, /(^|[^-\d])0([^\d]|$)/) || fail('Reset did not return count to 0')
      api.close()
    },
  },

  {
    id: 2,
    slug: 'todo',
    prompt:
      'Build a todo list. A text input and an "Add" button add a task. Each task has a checkbox to mark it done and a "Delete" button to remove it. Below the list, show how many tasks are not done yet, in the form "N left".',
    async assert(load) {
      const api = await load()
      const input = inputOf(api) ?? fail('no text input found')
      const add = api.button(/add/) ?? fail('no Add button found')
      await api.type(input, 'Buy milk')
      await api.click(add)
      visible(api, /Buy milk/) || fail('added task not rendered')
      await api.type(input, 'Walk dog')
      await api.click(add)
      visible(api, /2\s*left/i) || fail('"2 left" counter not shown after adding two tasks')
      const checkbox = api.$('input[type="checkbox"]') ?? fail('no checkbox rendered for a task')
      await api.click(checkbox)
      visible(api, /1\s*left/i) || fail('counter did not drop to "1 left" after toggling')
      const del = api.button(/delete|remove|^\s*[×✕x]\s*$/) ?? fail('no Delete button found')
      await api.click(del)
      const both = visible(api, /Buy milk/) && visible(api, /Walk dog/)
      both && fail('Delete did not remove a task')
      api.close()
    },
  },

  {
    id: 3,
    slug: 'filters',
    prompt:
      'Build a task list with filter buttons "All", "Active", "Done". Preload exactly these tasks: "Write report" (done), "Send invoice" (done), "Call client" (not done), "Book flights" (not done). The filter buttons control which tasks are visible.',
    async assert(load) {
      const api = await load()
      const all = api.button(/^\s*all\s*$/) ?? fail('no All button')
      const active = api.button(/^\s*active\s*$/) ?? fail('no Active button')
      const done = api.button(/^\s*done\s*$/) ?? fail('no Done button')
      visible(api, /Write report/) || fail('preloaded tasks not rendered')
      await api.click(active)
      visible(api, /Call client/) || fail('Active filter hides active task')
      !visible(api, /Write report/) || fail('Active filter still shows a done task')
      await api.click(done)
      visible(api, /Send invoice/) || fail('Done filter hides done task')
      !visible(api, /Book flights/) || fail('Done filter still shows an active task')
      await api.click(all)
      ;(visible(api, /Write report/) && visible(api, /Book flights/)) ||
        fail('All filter does not restore all tasks')
      api.close()
    },
  },

  {
    id: 4,
    slug: 'debounce-search',
    prompt:
      'Build a live search over this fixed list of names: Alice, Albert, Bob, Carol, Dave. Typing in the search input filters the list case-insensitively, but only after the user stops typing for 300 ms (debounce). Show all names when the input is empty.',
    async assert(load) {
      const api = await load()
      const input = inputOf(api) ?? fail('no search input found')
      visible(api, /Dave/) || fail('initial list not rendered')
      input.value = 'al'
      input.dispatchEvent(new api.window.Event('input', { bubbles: true }))
      await api.sleep(100)
      visible(api, /Dave/) || fail('list filtered immediately — debounce missing')
      await api.sleep(500)
      visible(api, /Alice/) || fail('filter did not apply after debounce window')
      !visible(api, /Dave/) || fail('non-matching name still visible after debounce')
      api.close()
    },
  },

  {
    id: 5,
    slug: 'form-validation',
    prompt:
      'Build a newsletter signup form with an email input and a "Subscribe" button. If the email is invalid on submit, show the error message "Please enter a valid email". On a valid email, show "Thanks for subscribing!" instead of the form error.',
    async assert(load) {
      const api = await load()
      const input = inputOf(api) ?? fail('no email input found')
      const btn = api.button(/subscribe/) ?? fail('no Subscribe button')
      await api.type(input, 'not-an-email')
      const form = api.$('form')
      form ? await api.submit(form) : await api.click(btn)
      await api.click(btn).catch(() => {})
      visible(api, /valid email/i) || fail('invalid submit did not show the error message')
      !visible(api, /thanks for subscribing/i) || fail('success shown for invalid email')
      await api.type(input, 'ada@example.com')
      form ? await api.submit(form) : await api.click(btn)
      await api.click(btn).catch(() => {})
      visible(api, /thanks for subscribing/i) || fail('valid submit did not show success message')
      api.close()
    },
  },

  {
    id: 6,
    slug: 'modal-bus',
    prompt:
      'Build two separate Micra components on one page: a "Delete account" button, and a confirmation modal (initially hidden) that shows the text "Are you sure?" with "Confirm" and "Cancel" buttons. Clicking "Delete account" must open the modal by sending an event between the two components (they must not share state directly). Cancel closes the modal.',
    async assert(load) {
      const api = await load()
      !visible(api, /are you sure/i) || fail('modal visible before opening')
      const open = api.button(/delete account/) ?? fail('no "Delete account" button')
      await api.click(open)
      visible(api, /are you sure/i) || fail('modal did not open')
      const cancel = api.button(/cancel/) ?? fail('no Cancel button')
      await api.click(cancel)
      !visible(api, /are you sure/i) || fail('Cancel did not close the modal')
      api.close()
    },
  },

  {
    id: 7,
    slug: 'tabs',
    prompt:
      'Build a tabs component with three tabs: "Overview", "Billing", "Settings". The Overview pane contains the text "Welcome to the overview." The Billing pane contains "Your next invoice is due soon." The Settings pane contains "Manage your preferences here." Only the active pane is visible; Overview is active initially.',
    async assert(load) {
      const api = await load()
      visible(api, /welcome to the overview/i) || fail('Overview pane not visible initially')
      !visible(api, /next invoice/i) || fail('Billing pane visible while Overview active')
      const billing = api.button(/billing/) ?? fail('no Billing tab control')
      await api.click(billing)
      visible(api, /next invoice/i) || fail('Billing pane did not appear')
      !visible(api, /welcome to the overview/i) || fail('Overview pane still visible')
      const settings = api.button(/settings/) ?? fail('no Settings tab control')
      await api.click(settings)
      visible(api, /manage your preferences/i) || fail('Settings pane did not appear')
      api.close()
    },
  },

  {
    id: 8,
    slug: 'sortable-table',
    prompt:
      'Build a table of people with columns Name and Age, preloaded with exactly: Alice 30, Bob 25, Carol 35. Clicking the "Age" column header sorts the rows by age ascending; clicking it again sorts descending.',
    async assert(load) {
      const api = await load()
      const order = () => {
        const t = visibleText(api)
        return ['Alice', 'Bob', 'Carol'].sort((a, b) => t.indexOf(a) - t.indexOf(b)).join(',')
      }
      const age = api.button(/age/) ??
        api.$$('th').find(h => /age/i.test(h.textContent)) ?? fail('no Age header control')
      await api.click(age)
      order() === 'Bob,Alice,Carol' || fail(`ascending sort wrong: got ${order()}`)
      await api.click(age)
      order() === 'Carol,Alice,Bob' || fail(`descending sort wrong: got ${order()}`)
      api.close()
    },
  },

  {
    id: 9,
    slug: 'fetch-states',
    prompt:
      'Build a user list that fetches /api/users on load (the endpoint returns a JSON array of objects with "id" and "name"). While the request is in flight, show the text "Loading…". On success, render the names. If the request fails, show "Something went wrong".',
    async assert(load) {
      // success path — slow fetch so the loading state is observable
      const slow = async () => {
        await new Promise(r => setTimeout(r, 200))
        return {
          ok: true, status: 200,
          headers: { get: () => 'application/json' },
          json: async () => [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
          text: async () => JSON.stringify([{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]),
        }
      }
      const ok = await load({ fetchImpl: slow })
      visible(ok, /loading/i) || fail('no Loading state while request in flight')
      await ok.sleep(400)
      visible(ok, /Alice/) || fail('fetched names not rendered')
      !visible(ok, /loading/i) || fail('Loading state stuck after success')
      ok.close()

      // error path
      const bad = async () => { await new Promise(r => setTimeout(r, 30)); throw new Error('network down') }
      const err = await load({ fetchImpl: bad })
      await err.sleep(300)
      visible(err, /something went wrong/i) || fail('error message not shown on failed request')
      err.close()
    },
  },

  {
    id: 10,
    slug: 'dropdowns',
    prompt:
      'Build a page with three independent dropdown components built from ONE Micra component definition. Their buttons are labeled "Sort", "Filter", "View". Each dropdown shows its own option list when its button is clicked (Sort: "Newest", "Oldest"; Filter: "Open", "Closed"; View: "Grid", "List") and clicking the same button again closes it. Opening one dropdown must not open or break the others.',
    async assert(load) {
      const api = await load()
      const sort = api.button(/^\s*sort\s*$/) ?? fail('no Sort button')
      const filter = api.button(/^\s*filter\s*$/) ?? fail('no Filter button')
      !visible(api, /newest/i) || fail('Sort dropdown open before any click')
      await api.click(sort)
      visible(api, /newest/i) || fail('Sort dropdown did not open')
      !visible(api, /(^|\s)open(\s|$)/i) || fail('Filter dropdown opened when Sort was clicked')
      await api.click(filter)
      visible(api, /closed/i) || fail('Filter dropdown did not open')
      await api.click(sort).catch(() => {})
      // toggle-close check on whichever is open now
      const sortOpen = visible(api, /newest/i)
      await api.click(sort)
      const sortAfter = visible(api, /newest/i)
      sortOpen === sortAfter && fail('clicking Sort button does not toggle its dropdown')
      api.close()
    },
  },
]
