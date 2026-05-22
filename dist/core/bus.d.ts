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
import type { EventHandler, UnsubFn } from '../types';
/**
 * Subscribe to a named event. Returns an unsubscribe function.
 *
 * @example
 * const unsub = on('user:login', (user) => console.log(user))
 * unsub()  // stop listening
 */
export declare function on<T = unknown>(event: string, handler: EventHandler<T>): UnsubFn;
/**
 * Unsubscribe a specific handler from an event.
 */
export declare function off(event: string, handler: EventHandler): void;
/**
 * Publish an event to all subscribers. Errors are caught per-handler.
 *
 * @example
 * emit('user:updated', { id: 1, name: 'Alice' })
 */
export declare function emit(event: string, payload?: unknown): void;
