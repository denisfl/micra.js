// Frame-side glue. Loaded by each frame HTML. Listens for postMessage
// commands from the parent runner and executes the appropriate scenario
// from the imported adapter. Posts measured samples back.

export function setupFrame(adapter) {
  window.addEventListener('message', async (event) => {
    if (event.source !== window.parent) return
    const msg = event.data
    if (!msg || msg.type !== 'run') return

    const { scenarioId, iters, requestId } = msg
    const impl = adapter.scenarios[scenarioId]

    const reply = (data) => {
      window.parent.postMessage(
        { type: 'result', requestId, name: adapter.name, scenarioId, ...data },
        '*'
      )
    }

    if (!impl) {
      reply({ na: true, reason: 'not supported by this adapter' })
      return
    }

    try {
      const samples = []
      for (let i = 0; i < iters; i++) {
        if (impl.setup) {
          const s = impl.setup()
          if (s && typeof s.then === 'function') await s
        }

        const t0 = performance.now()
        const r = impl.run()
        if (r && typeof r.then === 'function') await r
        const t1 = performance.now()

        samples.push(t1 - t0)

        if (impl.teardown) {
          const t = impl.teardown()
          if (t && typeof t.then === 'function') await t
        }

        // Yield + GC settle window between iters
        await new Promise(r => setTimeout(r, 16))
      }
      reply({ samples })
    } catch (err) {
      console.error(`[${adapter.name}/${scenarioId}]`, err)
      reply({ error: err.message })
    }
  })

  // Signal we're ready to receive commands
  window.parent.postMessage(
    { type: 'ready', name: adapter.name, version: adapter.version, notes: adapter.notes },
    '*'
  )
}
