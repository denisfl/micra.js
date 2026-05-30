/**
 * src/core/bus.ts — Global event bus.
 *
 * Responsibilities:
 *   - Publish events (emit)
 *   - Subscribe and unsubscribe (on / off)
 *   - Provide unsubscribe tokens for component cleanup
 *
 * LLM NOTE: The bus is a module-level singleton.
 * Component instances subscribe via `instance.on()` which auto-registers
 * the unsub token in `instance.__micraSubs` for cleanup on destroy().
 */

import type { EmitArgs, EventHandler, EventPayload, UnsubFn } from '../types'

// Module-level bus state — one bus per page load.
const _bus = new Map<string, Set<EventHandler>>()

/**
 * Subscribe to a named event. Returns an unsubscribe function.
 * Payload is typed via the `MicraEvents` interface (augmentable).
 *
 * @example
 * const unsub = on('user:login', (user) => console.log(user))
 * unsub()  // stop listening
 */
export function on<K extends string>(
  event: K,
  handler: (payload: EventPayload<K>) => void,
): UnsubFn {
  if (!_bus.has(event)) _bus.set(event, new Set())
  _bus.get(event)!.add(handler as EventHandler)
  return () => off(event, handler)
}

/**
 * Unsubscribe a specific handler from an event.
 */
export function off<K extends string>(
  event: K,
  handler: (payload: EventPayload<K>) => void,
): void {
  const set = _bus.get(event)
  if (!set) return
  set.delete(handler as EventHandler)
  if (set.size === 0) _bus.delete(event)
}

/**
 * Publish an event to all subscribers. Errors are caught per-handler.
 * Payload is typed via the `MicraEvents` interface (augmentable).
 *
 * @example
 * emit('user:updated', { id: 1, name: 'Alice' })
 */
export function emit<K extends string>(event: K, ...args: EmitArgs<K>): void {
  const payload = args[0]
  _bus.get(event)?.forEach(h => {
    try { h(payload) } catch (e) { console.error(`[Micra] bus error [${event}]:`, e) }
  })
}
