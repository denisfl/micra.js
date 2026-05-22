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

import type { EventHandler, UnsubFn } from '../types'

// Module-level bus state — one bus per page load.
const _bus = new Map<string, Set<EventHandler>>()

/**
 * Subscribe to a named event. Returns an unsubscribe function.
 *
 * @example
 * const unsub = on('user:login', (user) => console.log(user))
 * unsub()  // stop listening
 */
export function on<T = unknown>(event: string, handler: EventHandler<T>): UnsubFn {
  if (!_bus.has(event)) _bus.set(event, new Set())
  _bus.get(event)!.add(handler as EventHandler)
  return () => off(event, handler as EventHandler)
}

/**
 * Unsubscribe a specific handler from an event.
 */
export function off(event: string, handler: EventHandler): void {
  _bus.get(event)?.delete(handler)
}

/**
 * Publish an event to all subscribers. Errors are caught per-handler.
 *
 * @example
 * emit('user:updated', { id: 1, name: 'Alice' })
 */
export function emit(event: string, payload?: unknown): void {
  _bus.get(event)?.forEach(h => {
    try { h(payload) } catch (e) { console.error(`[Micra] bus error [${event}]:`, e) }
  })
}
