# Lifecycle

## `onCreate`

`onCreate` runs once after the component mounts and after the first render.

```ts
Micra.define('users', {
  state: { users: [], loading: true },

  async onCreate() {
    this.state.users = await this.fetch('/api/users') as any[]
    this.state.loading = false
  },
})
```

Key points:

- it runs in a microtask, not inline during `mount()`
- the first render already happened, so refs and DOM are available
- it is safe to make it `async`

## `onDestroy`

`onDestroy` runs when `this.destroy()` is called.

```ts
Micra.define('clock', {
  state: { now: Date.now() },

  onCreate() {
    this.timer = window.setInterval(() => {
      this.state.now = Date.now()
    }, 1000)
  },

  onDestroy() {
    clearInterval(this.timer)
  },
})
```

Use it to clean up timers, manual DOM listeners, third-party widgets, and other external resources.

## `this.on()` auto-cleanup

Subscriptions created with `this.on()` are removed automatically on destroy.

```ts
onCreate() {
  this.on('modal:open', payload => {
    console.log(payload)
  })
}
```

You do not need to call the returned unsubscribe function unless you want to stop listening earlier.

## Manual destroy

Every instance has `destroy()`.

```ts
const modal = Micra.mount('#modal', definition)
modal?.destroy()
```

`destroy()`:

- unsubscribes handlers registered with `this.on()`
- calls `onDestroy` if present
- removes the instance from Micra's live instance map

It does not remove the root DOM element.

## Re-mount behavior

Mounting the same root twice returns the existing instance.

```ts
const a = Micra.mount('#counter', definition)
const b = Micra.mount('#counter', definition)

console.log(a === b) // true
```

This also makes `Micra.start()` safe to call multiple times. Already-mounted roots are skipped.

If you call `destroy()`, you can mount that root again and get a new instance.
