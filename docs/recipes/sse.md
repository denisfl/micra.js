# Recipe: Server-Sent Events (SSE) with Micra.js

This recipe is the canonical answer to "I have an SSE endpoint, how do I wire it
to a Micra component?". It uses **only what's already in Micra** — `state`,
`onCreate`, `onDestroy` — plus the browser's native `EventSource`.

> No `Micra.stream(...)` helper exists. The hard part of SSE — open, parse,
> handle errors, close — is exactly the kind of thing `onCreate`/`onDestroy`
> already cover. A built-in helper would hide reconnect/auth/named-event
> concerns without buying much, so we ship a recipe instead.

## 1. Minimal — one stream, JSON payload

Server route emits `data: {"price": 123.45}\n\n` lines. Component subscribes
on create, closes on destroy.

```html
<div data-component="live-price">
  <strong data-text="price"></strong>
  <small data-text="status"></small>
</div>
```

```js
Micra.define('live-price', {
  state: {
    price: 0,
    status: 'connecting',
  },

  onCreate() {
    this._es = new EventSource('/api/prices/stream')

    this._es.onopen = () => {
      this.state.status = 'live'
    }

    this._es.onmessage = (e) => {
      const payload = JSON.parse(e.data)
      this.state.price = payload.price
    }

    this._es.onerror = () => {
      // EventSource auto-reconnects with exponential backoff. We just update
      // the UI; we don't close on error or it won't retry.
      this.state.status = 'reconnecting'
    }
  },

  onDestroy() {
    this._es?.close()
  },
})

Micra.start()
```

Key points:

- `EventSource` **reconnects automatically** — don't `close()` on error.
- `e.data` is always a string. Parse JSON yourself; don't assume the server
  sends JSON.
- The stream is stored on `this._es` (underscore prefix marks it as instance
  bookkeeping, not state). Closing it in `onDestroy` is **mandatory** —
  otherwise it survives `instance.destroy()` and silently reconnects forever.

## 2. Named events (`event: name\ndata: …\n\n`)

Production SSE feeds usually split traffic by event name. Use
`addEventListener` per event:

```js
Micra.define('order-feed', {
  state: { orders: [], status: 'connecting' },

  onCreate() {
    const es = new EventSource('/api/orders/stream')
    this._es = es

    es.addEventListener('open', () => {
      this.state.status = 'live'
    })

    es.addEventListener('order:created', (e) => {
      const order = JSON.parse(e.data)
      // Replace, don't mutate — Micra tracks top-level writes only.
      this.state.orders = [order, ...this.state.orders]
    })

    es.addEventListener('order:updated', (e) => {
      const order = JSON.parse(e.data)
      this.state.orders = this.state.orders.map(o =>
        o.id === order.id ? order : o,
      )
    })

    es.addEventListener('error', () => {
      this.state.status = 'reconnecting'
    })
  },

  onDestroy() {
    this._es?.close()
  },
})
```

## 3. Stream URL from a server-rendered `data-*` attribute

SSR-friendly pattern: the server picks the stream URL per page (different
tenant, different feed), Micra reads it via `this.prop()`:

```html
<div data-component="notification-feed"
     data-stream="/api/notifications/stream?token=abc123"></div>
```

```js
Micra.define('notification-feed', {
  state: { items: [], status: 'connecting' },

  onCreate() {
    const url = this.prop('stream')
    if (!url) return  // server didn't render a URL — nothing to do
    this._es = new EventSource(url, { withCredentials: true })
    this._es.onmessage = (e) => {
      this.state.items = [JSON.parse(e.data), ...this.state.items]
    }
    this._es.onopen = () => { this.state.status = 'live' }
    this._es.onerror = () => { this.state.status = 'reconnecting' }
  },

  onDestroy() {
    this._es?.close()
  },
})
```

## 4. Manual reconnect with backoff (when native auto-retry isn't enough)

If your endpoint needs custom auth refresh or a `Last-Event-ID` header (which
the native `EventSource` does send automatically, but only for plain reconnects),
swap in a manual loop. This is more code — only use it when needed.

```js
Micra.define('audit-stream', {
  state: { events: [], status: 'connecting' },

  onCreate() {
    this._closed = false
    this._connect()
  },

  _connect() {
    if (this._closed) return
    const es = new EventSource('/api/audit/stream')
    this._es = es

    es.onopen = () => { this.state.status = 'live' }
    es.onmessage = (e) => {
      this.state.events = [JSON.parse(e.data), ...this.state.events].slice(0, 100)
    }
    es.onerror = () => {
      es.close()
      this.state.status = 'reconnecting'
      this._retry = setTimeout(() => this._connect(), 3000)
    }
  },

  onDestroy() {
    this._closed = true
    clearTimeout(this._retry)
    this._es?.close()
  },
})
```

## 5. Multiple streams in one component

`state` is shared, but you can hold multiple `EventSource` references:

```js
Micra.define('dashboard', {
  state: { price: 0, volume: 0 },

  onCreate() {
    this._streams = [
      new EventSource('/api/price/stream'),
      new EventSource('/api/volume/stream'),
    ]
    this._streams[0].onmessage = (e) => { this.state.price = JSON.parse(e.data).value }
    this._streams[1].onmessage = (e) => { this.state.volume = JSON.parse(e.data).value }
  },

  onDestroy() {
    this._streams?.forEach(es => es.close())
  },
})
```

## Things to avoid

- **Don't call `this.state.X = ...` inside a method bound to `EventSource`
  via `addEventListener` if `this` is the EventSource.** Use arrow functions
  (as above) so `this` stays the component instance.

- **Don't forget `onDestroy`.** A leaked `EventSource` keeps reconnecting in
  the background, holds a server connection, and keeps writing to a state
  that may belong to a destroyed instance (Micra ignores writes after
  destroy, so the UI is silent — but the network traffic is real).

- **Don't render lists by hand.** When the stream pushes an item, mutate
  state and let `<template data-each>` render. Same rule as everything else
  in Micra.

  ```js
  // ❌ DON'T
  es.onmessage = (e) => {
    document.getElementById('list').innerHTML += `<li>${e.data}</li>`
  }

  // ✅ DO
  es.onmessage = (e) => {
    this.state.items = [JSON.parse(e.data), ...this.state.items]
  }
  ```

- **Don't auto-parse all `e.data` blindly.** SSE bodies are strings. Some
  endpoints emit `data: heartbeat\n\n` (no JSON). Guard with `try/catch` or
  filter on event name before parsing.

## Backend tips (server-side, not Micra)

- Always send `Content-Type: text/event-stream` and disable buffering
  (`X-Accel-Buffering: no` for nginx).
- Heartbeats: emit `:ping\n\n` every ~15s so proxies don't drop the
  connection. Comments (`:`) are ignored by `EventSource`.
- `retry: 5000\n\n` lets the server suggest a reconnect interval to the
  browser when it disconnects.
- For Rails: `ActionController::Live` + `response.stream.write`. For
  Laravel: `Symfony\Component\HttpFoundation\StreamedResponse`. For Django:
  `StreamingHttpResponse`. For Node/Express: write to `res` directly with
  the right headers.
